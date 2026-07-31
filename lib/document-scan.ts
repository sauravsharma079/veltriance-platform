import type { SupplierOnboardingProfile } from "@prisma/client";
import { validateTaxOrBankField, type TaxIdType } from "@/lib/validators";

// "Scan" here means automated *format and consistency* checks — file type/size, and
// cross-referencing the doc type against the tax/bank field already captured for this
// supplier (e.g. uploading a PAN Card when the recorded PAN fails format validation).
// It does NOT read the file's contents (no OCR/AI extraction wired up — that needs a
// paid provider like AWS Textract or Google Document AI, not configured here), so it
// can't confirm the uploaded file is actually a PAN card, that the name matches, etc.
// Framed honestly in the UI as "automated checks", not "verified" or "scanned".

export type DocScanResult = { passed: boolean; notes: string[] };

// Which onboarding-profile field (and validator) a given document type corresponds
// to, so an upload can be cross-checked against data already on file.
const DOC_TYPE_FIELD_MAP: Record<string, { field: keyof SupplierOnboardingProfile; validator: TaxIdType; label: string }> = {
  PAN_CARD: { field: "panNumber", validator: "PAN", label: "PAN number" },
  GST_CERTIFICATE: { field: "gstNumber", validator: "GST", label: "GST number" },
  VAT_CERTIFICATE: { field: "taxIdValue", validator: "VAT", label: "VAT number" },
};

export function scanDocument(opts: {
  docType: string; mimeType: string; fileSize: number; profile: SupplierOnboardingProfile | null;
}): DocScanResult {
  const notes: string[] = [];
  let passed = true;

  if (opts.fileSize > 10 * 1024 * 1024) { notes.push("File exceeds the 10MB size limit."); passed = false; }
  if (!["application/pdf", "image/jpeg", "image/jpg", "image/png"].includes(opts.mimeType)) {
    notes.push(`Unexpected file type (${opts.mimeType}) for a compliance document.`); passed = false;
  }

  const mapping = DOC_TYPE_FIELD_MAP[opts.docType];
  if (mapping) {
    const value = opts.profile?.[mapping.field] as string | null | undefined;
    if (!value) {
      notes.push(`No ${mapping.label} recorded on the onboarding profile to cross-check this document against.`);
    } else {
      const result = validateTaxOrBankField(mapping.validator, value);
      if (!result.valid) { notes.push(`Recorded ${mapping.label} (${value}) fails format validation: ${result.message}`); passed = false; }
      else notes.push(`Recorded ${mapping.label} (${value}) is correctly formatted.`);
    }
  }

  if (notes.length === 0) notes.push("File type and size checks passed. No content verification performed — a human reviewer should still confirm this document is genuine.");
  return { passed, notes };
}
