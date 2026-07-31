import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "supplier-documents";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);

// 10-year signed URL. The bucket is private (holds tax/bank documents), so reads
// need a signed URL rather than a public one; a proper refresh-on-view flow would
// be more correct for very-long-lived documents but is out of scope here — this
// pragmatic long expiry avoids needing a background refresh job.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

let bucketEnsured = false;

async function ensureBucket() {
  if (bucketEnsured) return;
  const admin = createAdminClient();
  const { data: existing } = await admin.storage.getBucket(BUCKET);
  if (!existing) {
    await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_FILE_BYTES });
  }
  bucketEnsured = true;
}

export type FileValidation = { ok: boolean; error?: string };

export function validateFile(mimeType: string, size: number): FileValidation {
  if (!ALLOWED_MIME.has(mimeType)) return { ok: false, error: "Only PDF, JPG, and PNG files are accepted." };
  if (size > MAX_FILE_BYTES) return { ok: false, error: "File is larger than the 10MB limit." };
  if (size === 0) return { ok: false, error: "File is empty." };
  return { ok: true };
}

export async function uploadSupplierDocument(opts: {
  organizationId: string; supplierId: string; fileName: string; mimeType: string; bytes: Uint8Array;
}): Promise<{ ok: true; url: string; path: string; size: number } | { ok: false; error: string }> {
  await ensureBucket();
  const admin = createAdminClient();
  const safeName = opts.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${opts.organizationId}/${opts.supplierId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, opts.bytes, {
    contentType: opts.mimeType, upsert: false,
  });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) return { ok: false, error: signError?.message ?? "Could not create a signed URL for the uploaded file." };

  return { ok: true, url: signed.signedUrl, path, size: opts.bytes.byteLength };
}
