import { XMLParser } from "fast-xml-parser";

export function escapeXml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Defense-in-depth: fast-xml-parser has no DTD/entity-expansion support by
 * default, but we reject anything declaring a DOCTYPE/ENTITY outright before
 * it's even parsed, in case a hostile or compromised "supplier" tries an
 * XXE / entity-expansion style attack against the punchout callback.
 */
export function hasDangerousXmlDeclarations(raw: string): boolean {
  return /<!DOCTYPE/i.test(raw) || /<!ENTITY/i.test(raw);
}

function xmlParser() {
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", isArray: (name) => name === "ItemIn" });
}

export type PunchOutSetupParams = {
  buyerCookie: string;
  fromDomain: string; fromIdentity: string;
  toDomain: string; toIdentity: string;
  senderDomain: string; senderIdentity: string; sharedSecret: string;
  browserFormPostUrl: string;
  userEmail: string;
};

/**
 * Builds a cXML 1.2 PunchOutSetupRequest. Every value sourced from
 * admin-entered config or user data is escaped — none of it can be trusted
 * to be free of XML metacharacters.
 */
export function buildPunchOutSetupRequest(p: PunchOutSetupParams): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd">
<cXML payloadID="${escapeXml(p.buyerCookie)}@veltriance" timestamp="${now}">
  <Header>
    <From><Credential domain="${escapeXml(p.fromDomain)}"><Identity>${escapeXml(p.fromIdentity)}</Identity></Credential></From>
    <To><Credential domain="${escapeXml(p.toDomain)}"><Identity>${escapeXml(p.toIdentity)}</Identity></Credential></To>
    <Sender>
      <Credential domain="${escapeXml(p.senderDomain)}">
        <Identity>${escapeXml(p.senderIdentity)}</Identity>
        <SharedSecret>${escapeXml(p.sharedSecret)}</SharedSecret>
      </Credential>
      <UserAgent>Veltriance/1.0</UserAgent>
    </Sender>
  </Header>
  <Request>
    <PunchOutSetupRequest operation="create">
      <BuyerCookie>${escapeXml(p.buyerCookie)}</BuyerCookie>
      <Extrinsic name="UserEmail">${escapeXml(p.userEmail)}</Extrinsic>
      <BrowserFormPost>
        <URL>${escapeXml(p.browserFormPostUrl)}</URL>
      </BrowserFormPost>
      <SupplierSetup/>
    </PunchOutSetupRequest>
  </Request>
</cXML>`;
}

export type PunchOutSetupResult =
  | { ok: true; startPageUrl: string }
  | { ok: false; statusCode: string; statusText: string };

export function parsePunchOutSetupResponse(xml: string): PunchOutSetupResult {
  if (hasDangerousXmlDeclarations(xml)) {
    return { ok: false, statusCode: "400", statusText: "Response contained a disallowed DOCTYPE/ENTITY declaration" };
  }
  let doc: any;
  try { doc = xmlParser().parse(xml); } catch { return { ok: false, statusCode: "502", statusText: "Malformed XML response" }; }

  const response = doc?.cXML?.Response;
  const status = response?.Status;
  const code = String(status?.["@_code"] ?? "");
  if (code !== "200") {
    return { ok: false, statusCode: code || "502", statusText: String(status?.["@_text"] ?? status?.["#text"] ?? "Unknown error from supplier") };
  }
  const startPageUrl = response?.PunchOutSetupResponse?.StartPage?.URL;
  if (!startPageUrl || typeof startPageUrl !== "string") {
    return { ok: false, statusCode: "502", statusText: "Response missing PunchOutSetupResponse/StartPage/URL" };
  }
  return { ok: true, startPageUrl };
}

export type PunchOutCartItem = {
  supplierPartId: string; description: string; unitPrice: number; currency: string; quantity: number; unitOfMeasure: string;
};
export type PunchOutOrderMessage = { buyerCookie: string; items: PunchOutCartItem[] };

function textOf(node: any): string {
  if (node == null) return "";
  if (typeof node === "object") return String(node["#text"] ?? "");
  return String(node);
}

export function parsePunchOutOrderMessage(xml: string): PunchOutOrderMessage {
  if (hasDangerousXmlDeclarations(xml)) throw new Error("Payload contains a disallowed DOCTYPE/ENTITY declaration");
  const doc = xmlParser().parse(xml);
  const msg = doc?.cXML?.Message?.PunchOutOrderMessage;
  if (!msg) throw new Error("Not a PunchOutOrderMessage");

  const buyerCookie = String(msg.BuyerCookie ?? "").trim();
  if (!buyerCookie) throw new Error("Missing BuyerCookie");

  const rawItems: any[] = Array.isArray(msg.ItemIn) ? msg.ItemIn : msg.ItemIn ? [msg.ItemIn] : [];
  const items: PunchOutCartItem[] = rawItems.map((it) => {
    const money = it?.ItemDetail?.UnitPrice?.Money;
    return {
      supplierPartId: textOf(it?.ItemID?.SupplierPartID) || "N/A",
      description: textOf(it?.ItemDetail?.Description) || "Punchout item",
      unitPrice: parseFloat(textOf(money)) || 0,
      currency: (typeof money === "object" ? money?.["@_currency"] : null) || "INR",
      quantity: parseFloat(String(it?.["@_quantity"] ?? "1")) || 1,
      unitOfMeasure: textOf(it?.ItemDetail?.UnitOfMeasure) || "EA",
    };
  });
  return { buyerCookie, items };
}
