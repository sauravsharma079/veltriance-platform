import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateBudget } from "@/lib/budget";
import { evaluatePolicies, type PolicyFacts, type RequestFacts } from "@/lib/policy";
import { threeWayMatch, type MatchInput } from "@/lib/invoice-match";
import { signLink, verifyLink } from "@/lib/signed-links";
import { rateLimit, limitFor } from "@/lib/rate-limit";

process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-key";

// ── budgets ──
test("budget: ok, warn, over, exact fit, float-safe", () => {
  assert.equal(evaluateBudget({ amount: 1000, warnPct: 80 }, 0, 500).status, "OK");
  assert.equal(evaluateBudget({ amount: 1000, warnPct: 80 }, 700, 100).status, "WARN");
  assert.equal(evaluateBudget({ amount: 1000, warnPct: 80 }, 900, 200).status, "OVER");
  assert.equal(evaluateBudget({ amount: 1000, warnPct: 80 }, 900, 100).status, "WARN"); // exactly on budget is not over
  assert.equal(evaluateBudget({ amount: 0.3, warnPct: 99 }, 0.1, 0.2).status, "WARN"); // 0.1+0.2 float trap
  assert.equal(evaluateBudget({ amount: 1000, warnPct: 80 }, 900, 200).overBy, 100);
});

// ── policy ──
const req: RequestFacts = { amount: 4000, currency: "INR", category: "Laptops", department: "Eng", requestorId: "u1", supplierIds: ["s1"] };
const facts: PolicyFacts = { suppliers: { s1: { status: "ACTIVE", preferred: true } }, contractedSupplierIds: [], recent: [] };
const base = [{ stepType: "MANAGER", stepLabel: "Manager", sequence: 1, assignedUserId: null, approverUserIds: [], approverMode: "ANY" }] as never;
const rule = (type: string, params: object, name = type) => ({ id: name, type, name, params });

test("policy: auto-approve needs preferred supplier and low amount", () => {
  const r = [rule("AUTO_APPROVE", { maxAmount: 5000 })];
  const ok = evaluatePolicies(r, req, facts, base, null);
  assert.equal(ok.autoApproved, true); assert.equal(ok.steps.length, 0);
  assert.equal(evaluatePolicies(r, { ...req, amount: 6000 }, facts, base, null).autoApproved, false);
  assert.equal(evaluatePolicies(r, req, { ...facts, suppliers: { s1: { status: "ACTIVE", preferred: false } } }, base, null).autoApproved, false);
});
test("policy: sourcing required above threshold unless contracted", () => {
  const r = [rule("REQUIRE_SOURCING", { minAmount: 50000 })];
  assert.equal(evaluatePolicies(r, { ...req, amount: 60000 }, facts, base, null).requireSourcing, true);
  assert.equal(evaluatePolicies(r, { ...req, amount: 60000 }, { ...facts, contractedSupplierIds: ["s1"] }, base, null).requireSourcing, false);
  assert.equal(evaluatePolicies(r, req, facts, base, null).requireSourcing, false);
});
test("policy: split purchases are flagged and never auto-approved", () => {
  const r = [rule("AUTO_APPROVE", { maxAmount: 5000 }), rule("SPLIT_ORDER", { thresholdAmount: 5000, windowDays: 30 })];
  const d = evaluatePolicies(r, req, { ...facts, recent: [{ amount: 3000, category: "Laptops", supplierIds: [], ageDays: 3 }] }, base, null);
  assert.equal(d.flags[0]?.code, "SPLIT_ORDER"); assert.equal(d.autoApproved, false);
});
test("policy: malformed rules are skipped, not fatal", () => {
  const d = evaluatePolicies([rule("AUTO_APPROVE", { maxAmount: "lots" }), rule("NOPE", {})], req, facts, base, null);
  assert.equal(d.autoApproved, false); assert.equal(d.steps.length, 1);
});
test("policy: hard-stop budget blocks", () => {
  const v = evaluateBudget({ amount: 1000, warnPct: 80 }, 900, 200);
  const b = { checks: [], worst: "OVER", blocking: { budgetId: "b", name: "Eng", hardStop: true, verdict: v }, over: [], warn: [] } as never;
  assert.match(evaluatePolicies([], req, facts, base, b).blocked ?? "", /over budget/);
});

// ── three-way match ──
const line = { poLineId: "l1", description: "Laptop", quantity: 2, unitPrice: 100, lineTotal: 200 };
const inv = (o: Partial<MatchInput["invoice"]> = {}): MatchInput => ({
  invoice: { supplierId: "s", currency: "INR", invoiceDate: new Date(), subtotal: 200, taxAmount: 0, totalAmount: 200, lines: [line], ...o },
  po: { supplierId: "s", currency: "INR", status: "SENT", lines: [{ id: "l1", description: "Laptop", quantity: 2, unitPrice: 100, receivedQty: 2 }] },
  invoicedElsewhere: {}, similarInvoices: [], tolerances: { pricePct: 2, qtyPct: 0 }, supplierStatus: "ACTIVE",
});
test("match: clean invoice matches", () => assert.equal(threeWayMatch(inv()).status, "MATCHED"));
test("match: not received holds it", () => {
  const i = inv(); i.po!.lines[0].receivedQty = 0;
  assert.equal(threeWayMatch(i).status, "EXCEPTION");
});
test("match: price over tolerance, wrong supplier, no PO, unapproved vendor, bad arithmetic", () => {
  assert.equal(threeWayMatch(inv({ lines: [{ ...line, unitPrice: 110, lineTotal: 220 }], subtotal: 220, totalAmount: 220 })).status, "EXCEPTION");
  assert.ok(threeWayMatch(inv({ supplierId: "other" })).issues.some(x => x.code === "SUPPLIER_MISMATCH"));
  assert.ok(threeWayMatch({ ...inv(), po: null }).issues.some(x => x.code === "NO_PO"));
  assert.ok(threeWayMatch({ ...inv(), supplierStatus: "PENDING_APPROVAL" }).issues.some(x => x.code === "SUPPLIER_NOT_ACTIVE"));
  assert.ok(threeWayMatch(inv({ totalAmount: 999 })).issues.some(x => x.code === "TOTAL_MISMATCH"));
});
test("match: duplicate bill is flagged", () => {
  const i = inv(); i.similarInvoices = [{ invoiceNumber: "INV-1" }];
  assert.ok(threeWayMatch(i).issues.some(x => x.code === "POSSIBLE_DUPLICATE"));
});

// ── signed links ──
test("links: round-trip, expiry, kind, tampering", () => {
  const t = signLink("approval", { s: "step1" }, 1, 1000);
  assert.equal(verifyLink<{ s: string }>(t, "approval", 2000)?.s, "step1");
  assert.equal(verifyLink(t, "approval", 1000 + 2 * 86_400_000), null);
  assert.equal(verifyLink(t, "receive", 2000), null);
  const [p, s] = t.split(".");
  assert.equal(verifyLink(`${p}x.${s}`, "approval", 2000), null);
  assert.equal(verifyLink(`${p}.${s.slice(0, -2)}AA`, "approval", 2000), null);
  assert.equal(verifyLink("garbage", "approval", 2000), null);
});

// ── rate limiting ──
test("rate limit: blocks after the cap, resets after the window", () => {
  for (let i = 0; i < 3; i++) assert.equal(rateLimit("k1", 3, 1000, 0).ok, true);
  const r = rateLimit("k1", 3, 1000, 10); assert.equal(r.ok, false); assert.ok(r.retryAfterSec >= 1);
  assert.equal(rateLimit("k1", 3, 1000, 1001).ok, true);
  assert.equal(rateLimit("k2", 3, 1000, 10).ok, true); // other clients unaffected
});
test("rate limit: applies to public and auth routes only", () => {
  assert.ok(limitFor("/api/public/receive/x", "POST"));
  assert.ok(limitFor("/api/auth/forgot-password", "POST"));
  assert.equal(limitFor("/api/requisitions", "GET"), null);
});
