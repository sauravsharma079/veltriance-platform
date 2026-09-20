// Three-way match: does the supplier's invoice agree with what we ORDERED (the PO), what we
// RECEIVED (accepted goods) and what has ALREADY been invoiced? Pure and deterministic — no
// database, no model — so every rule is explainable to an auditor and testable on its own.
//
// Money is compared in whole cents. Comparing floats directly would flag 0.1 + 0.2 ≠ 0.3.

export type MatchTolerances = { pricePct: number; qtyPct: number };

export type MatchInput = {
  invoice: {
    supplierId: string; currency: string; invoiceDate: Date;
    subtotal: number; taxAmount: number; totalAmount: number;
    lines: { poLineId: string | null; description: string; quantity: number; unitPrice: number; lineTotal: number }[];
  };
  po: { supplierId: string | null; currency: string; status: string; lines: { id: string; description: string; quantity: number; unitPrice: number; receivedQty: number }[] } | null;
  /** Quantity per PO line already sitting on OTHER live (not rejected) invoices. */
  invoicedElsewhere: Record<string, number>;
  /** Other invoices from the same supplier on the same PO for the same total — a likely re-send of the same bill. */
  similarInvoices: { invoiceNumber: string }[];
  tolerances: MatchTolerances;
  /** The supplier's onboarding status — we don't pay vendors who aren't approved. */
  supplierStatus?: string;
  now?: Date;
};

export type MatchIssue = { code: string; blocking: boolean; message: string; poLineId?: string };
export type LineMatch = {
  poLineId: string | null; description: string;
  ordered: number | null; received: number | null; invoicedBefore: number; invoicedNow: number;
  poUnitPrice: number | null; invoiceUnitPrice: number; priceVariancePct: number | null; ok: boolean;
};
export type MatchResult = { status: "MATCHED" | "EXCEPTION"; issues: MatchIssue[]; lines: LineMatch[]; checkedAt: string };

const cents = (n: number) => Math.round(n * 100);
const money = (n: number, cur: string) => `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function threeWayMatch(input: MatchInput): MatchResult {
  const { invoice, po, tolerances } = input;
  const issues: MatchIssue[] = [];
  const lines: LineMatch[] = [];
  const add = (code: string, message: string, blocking = true, poLineId?: string) => issues.push({ code, blocking, message, ...(poLineId && { poLineId }) });

  // ── header ──
  if (input.supplierStatus && input.supplierStatus !== "ACTIVE")
    add("SUPPLIER_NOT_ACTIVE", input.supplierStatus === "PENDING_APPROVAL" ? "This supplier hasn't completed onboarding, so they can't be paid yet." : `This supplier is ${input.supplierStatus.toLowerCase()} and can't be paid.`);
  if (!po) add("NO_PO", "This invoice isn't linked to a purchase order, so there is nothing to match it against.");
  else {
    if (po.supplierId && po.supplierId !== invoice.supplierId) add("SUPPLIER_MISMATCH", "The invoice is from a different supplier than the one the purchase order was placed with.");
    if (po.currency !== invoice.currency) add("CURRENCY_MISMATCH", `The invoice is in ${invoice.currency} but the purchase order is in ${po.currency}.`);
    if (["DRAFT", "CANCELLED"].includes(po.status)) add("PO_NOT_ISSUED", `The purchase order is ${po.status.toLowerCase()} — nothing was ever ordered on it.`);
  }

  // ── arithmetic: the document has to add up on its own ──
  const sumLines = invoice.lines.reduce((s, l) => s + cents(l.lineTotal), 0);
  const slack = Math.max(1, invoice.lines.length); // one cent of rounding per line is normal
  if (Math.abs(sumLines - cents(invoice.subtotal)) > slack) add("SUBTOTAL_MISMATCH", `The lines add up to ${money(sumLines / 100, invoice.currency)} but the invoice subtotal says ${money(invoice.subtotal, invoice.currency)}.`);
  if (Math.abs(cents(invoice.subtotal) + cents(invoice.taxAmount) - cents(invoice.totalAmount)) > 1) add("TOTAL_MISMATCH", `Subtotal plus tax is ${money((cents(invoice.subtotal) + cents(invoice.taxAmount)) / 100, invoice.currency)} but the invoice total says ${money(invoice.totalAmount, invoice.currency)}.`);
  const now = input.now ?? new Date();
  if (invoice.invoiceDate.getTime() > now.getTime() + 86_400_000) add("FUTURE_DATED", "The invoice is dated in the future.", false);
  for (const s of input.similarInvoices) add("POSSIBLE_DUPLICATE", `Same supplier, purchase order and amount as invoice ${s.invoiceNumber} — this may be the same bill sent again.`);

  // ── lines: price and quantity ──
  const poLines = new Map((po?.lines ?? []).map(l => [l.id, l]));
  for (const l of invoice.lines) {
    if (cents(l.quantity * l.unitPrice) !== cents(l.lineTotal) && Math.abs(cents(l.quantity * l.unitPrice) - cents(l.lineTotal)) > 1)
      add("LINE_MATH", `"${l.description}": ${l.quantity} × ${l.unitPrice} is not ${l.lineTotal}.`, true, l.poLineId ?? undefined);

    const pl = l.poLineId ? poLines.get(l.poLineId) : undefined;
    if (!pl) {
      if (po) add("LINE_NOT_ON_PO", `"${l.description}" isn't a line on the purchase order.`, true, l.poLineId ?? undefined);
      lines.push({ poLineId: l.poLineId, description: l.description, ordered: null, received: null, invoicedBefore: 0, invoicedNow: l.quantity, poUnitPrice: null, invoiceUnitPrice: l.unitPrice, priceVariancePct: null, ok: false });
      continue;
    }
    let ok = true;
    const before = input.invoicedElsewhere[pl.id] ?? 0;
    const variance = pl.unitPrice > 0 ? ((l.unitPrice - pl.unitPrice) / pl.unitPrice) * 100 : null;
    if (variance !== null && variance > tolerances.pricePct + 1e-9) {
      ok = false; add("PRICE_HIGHER", `"${pl.description}": invoiced at ${l.unitPrice} but the purchase order price is ${pl.unitPrice} (${variance.toFixed(1)}% over; ${tolerances.pricePct}% is allowed).`, true, pl.id);
    } else if (variance !== null && variance < -(tolerances.pricePct + 1e-9)) {
      add("PRICE_LOWER", `"${pl.description}": invoiced at ${l.unitPrice}, below the purchase order price of ${pl.unitPrice}.`, false, pl.id);
    }
    const allowed = pl.receivedQty * (1 + tolerances.qtyPct / 100);
    if (l.quantity + before > allowed + 1e-9) {
      ok = false;
      add(pl.receivedQty === 0 ? "NOT_RECEIVED" : "OVER_INVOICED",
        pl.receivedQty === 0
          ? `"${pl.description}": nothing has been received yet, so it can't be invoiced.`
          : `"${pl.description}": invoiced ${l.quantity}${before ? ` (plus ${before} on earlier invoices)` : ""} but only ${pl.receivedQty} received.`, true, pl.id);
    }
    lines.push({ poLineId: pl.id, description: pl.description, ordered: pl.quantity, received: pl.receivedQty, invoicedBefore: before, invoicedNow: l.quantity, poUnitPrice: pl.unitPrice, invoiceUnitPrice: l.unitPrice, priceVariancePct: variance, ok });
  }
  if (invoice.lines.length === 0) add("NO_LINES", "The invoice has no lines.");

  return { status: issues.some(i => i.blocking) ? "EXCEPTION" : "MATCHED", issues, lines, checkedAt: now.toISOString() };
}
