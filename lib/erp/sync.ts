import { prisma } from "@/lib/prisma";
import type { Integration, Supplier } from "@prisma/client";

// Generic outbound supplier sync. This is deliberately NOT a certified per-vendor SAP/
// Oracle/Workday/NetSuite connector — each of those needs a real OAuth2 token dance,
// vendor-specific payload shape, and a live tenant to test against, none of which are
// available here. What this genuinely does: POST the supplier as JSON to whatever
// endpoint + credentials the org configured on the Connect an Integration page
// (/dashboard/integrations), using whichever auth material is present. In practice
// this is how most enterprises actually land ERP integrations anyway — through an
// iPaaS/middleware layer (SAP BTP, Oracle Integration Cloud, MuleSoft, etc.) that
// exposes a single REST endpoint in front of the real ERP. Point that endpoint at the
// values captured on connect and this will work end to end; a raw SAP/Oracle/Workday
// tenant URL entered directly will need that middleware layer in between.

export type ErpSyncResult = { ok: boolean; message: string; erpSupplierId?: string };

function buildAuthHeaders(config: Record<string, unknown>): Record<string, string> {
  const headers: Record<string, string> = {};
  const str = (k: string) => (typeof config[k] === "string" ? (config[k] as string) : undefined);

  const username = str("username"), password = str("password");
  const apiKey = str("apiKey"), accessToken = str("accessToken");
  const clientId = str("clientId"), clientSecret = str("clientSecret");

  if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  } else if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (clientId && clientSecret) {
    // No token endpoint is known for arbitrary vendors — send credentials as headers
    // for a middleware layer to consume, rather than guessing an OAuth2 token URL.
    headers["X-Client-Id"] = clientId;
    headers["X-Client-Secret"] = clientSecret;
  }
  return headers;
}

function targetUrl(config: Record<string, unknown>): string | null {
  for (const key of ["baseUrl", "systemUrl", "instanceUrl", "environmentUrl", "middlewareUrl", "apiUrl", "gatewayUrl"]) {
    const v = config[key];
    if (typeof v === "string" && v.trim()) return v.replace(/\/$/, "");
  }
  return null;
}

function buildSupplierPayload(supplier: Supplier) {
  // Reasonably common vendor-master field names; the receiving middleware/ERP should
  // remap to its own schema. Not a substitute for a certified per-vendor field map.
  return {
    externalId: supplier.id,
    name: supplier.name,
    code: supplier.code,
    taxId: supplier.taxId,
    dunsNumber: supplier.dunsNumber,
    address: {
      line1: supplier.addressLine1, line2: supplier.addressLine2,
      city: supplier.city, state: supplier.state, postalCode: supplier.postalCode, country: supplier.country,
    },
    contact: { name: supplier.contactName, email: supplier.contactEmail, phone: supplier.contactPhone },
    paymentTerms: supplier.paymentTerms,
    currency: supplier.currency,
    bank: { name: supplier.bankName, accountNumber: supplier.bankAccountNumber, routingNumber: supplier.bankRoutingNumber },
    category: supplier.category,
    status: supplier.status,
  };
}

export async function syncSupplierToErp(supplier: Supplier, integration: Integration): Promise<ErpSyncResult> {
  const config = (integration.config as Record<string, unknown>) ?? {};
  const url = targetUrl(config);
  if (!url) return { ok: false, message: `No endpoint URL configured for ${integration.name}. Set it on the integration's connection page.` };

  const headers: Record<string, string> = { "Content-Type": "application/json", ...buildAuthHeaders(config) };
  const payload = buildSupplierPayload(supplier);

  try {
    const res = await fetch(`${url}/veltriance/suppliers`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) return { ok: false, message: `${integration.name} responded ${res.status}: ${text.slice(0, 300) || res.statusText}` };
    let erpSupplierId: string | undefined;
    try {
      const json = JSON.parse(text);
      erpSupplierId = json?.id ?? json?.supplierId ?? json?.vendorId ?? undefined;
    } catch { /* non-JSON response is fine, still a success */ }
    return { ok: true, message: `Synced to ${integration.name}${erpSupplierId ? ` as ${erpSupplierId}` : ""}.`, erpSupplierId };
  } catch (e: any) {
    return { ok: false, message: `Could not reach ${integration.name}: ${e?.message ?? "network error"}` };
  }
}

export async function syncSupplierAndLog(supplierId: string, integrationId: string): Promise<ErpSyncResult> {
  const [supplier, integration] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId } }),
    prisma.integration.findUnique({ where: { id: integrationId } }),
  ]);
  if (!supplier) return { ok: false, message: "Supplier not found." };
  if (!integration) return { ok: false, message: "Integration not found." };
  if (integration.organizationId !== supplier.organizationId) return { ok: false, message: "Integration does not belong to this organization." };
  if (integration.status !== "CONNECTED") return { ok: false, message: `${integration.name} is not connected — connect it first from Integrations.` };

  await prisma.supplier.update({ where: { id: supplierId }, data: { erpSyncStatus: "SYNCING" } });
  const result = await syncSupplierToErp(supplier, integration);

  await Promise.all([
    prisma.supplier.update({
      where: { id: supplierId },
      data: {
        erpSyncStatus: result.ok ? "SYNCED" : "FAILED",
        erpSyncedAt: result.ok ? new Date() : supplier.erpSyncedAt,
        ...(result.erpSupplierId && { erpSupplierId: result.erpSupplierId }),
      },
    }),
    prisma.integration.update({
      where: { id: integrationId },
      data: result.ok
        ? { lastSyncAt: new Date(), syncCount: { increment: 1 }, lastError: null }
        : { errorCount: { increment: 1 }, lastError: result.message },
    }),
    prisma.integrationLog.create({
      data: {
        integrationId,
        level: result.ok ? "SUCCESS" : "ERROR",
        event: result.ok ? "SYNC_SUCCESS" : "SYNC_ERROR",
        message: result.message,
        meta: { supplierId, supplierName: supplier.name },
      },
    }),
  ]);

  return result;
}
