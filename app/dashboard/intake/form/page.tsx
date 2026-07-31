"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus, Trash2, AlertTriangle, CheckCircle, Search } from "lucide-react";
import { GlCodingPanel } from "@/components/GlCodingPanel";
import { DynamicFieldsPanel, CustomFieldDef, FieldAnswers } from "@/components/DynamicFieldsPanel";

type Supplier = { id: string; name: string; contactEmail: string | null; preferred: boolean };
type LookupValue = { code: string; label: string };

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED"];
const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-gray-100 text-gray-600" },
  { value: "MEDIUM", label: "Medium", color: "bg-blue-50 text-blue-700" },
  { value: "HIGH", label: "High", color: "bg-amber-50 text-amber-700" },
  { value: "CRITICAL", label: "Critical", color: "bg-red-50 text-red-700" },
];

type LineItem = {
  description: string; partNumber: string; category: string; commodity: string;
  quantity: string; unitPrice: string; taxRate: string;
  supplierId: string; supplierSearch: string;
  glAccount: string; costCenter: string; contractReference: string; notes: string;
  glCoaId: string; glCoding: Record<string, string>;
};

const EMPTY_LINE: LineItem = {
  description: "", partNumber: "", category: "", commodity: "",
  quantity: "1", unitPrice: "0", taxRate: "0",
  supplierId: "", supplierSearch: "",
  glAccount: "", costCenter: "", contractReference: "", notes: "",
  glCoaId: "", glCoding: {},
};

const STEPS = ["Header", "Line Items", "Review & Submit"];

export default function IntakeFormPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Header fields
  const [header, setHeader] = useState({
    title: "", description: "", category: "", commodity: "", priority: "MEDIUM",
    businessUnit: "", department: "", project: "", budget: "",
    costCenter: "", deliveryLocation: "", requiredDate: "",
    currency: "USD", businessJustification: "", policyException: false, policyExceptionNote: "",
  });

  // Category-specific dynamic fields
  const [customFieldAnswers, setCustomFieldAnswers] = useState<FieldAnswers>({});
  const [dynamicFieldDefs, setDynamicFieldDefs] = useState<CustomFieldDef[]>([]);

  // Line items
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);

  // Reference data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<LookupValue[]>([]);
  const [supplierDropdown, setSupplierDropdown] = useState<{ idx: number; open: boolean }>({ idx: -1, open: false });

  useEffect(() => {
    fetch("/api/suppliers?status=ACTIVE")
      .then(r => r.json())
      .then(d => setSuppliers(d.suppliers ?? []));
    fetch("/api/admin/lookups")
      .then(r => r.json())
      .then(d => {
        const all: LookupValue[] = d.lookups ?? [];
        setCategories(all.filter((l: LookupValue & { type: string }) => (l as { type: string }).type === "CATEGORY"));
      });
  }, []);

  function setH<K extends keyof typeof header>(k: K, v: typeof header[K]) {
    setHeader(h => ({ ...h, [k]: v }));
  }

  function setLine(idx: number, key: keyof LineItem, value: string) {
    setLines(prev => prev.map((li, i) => i === idx ? { ...li, [key]: value } : li));
  }

  function addLine() { setLines(prev => [...prev, { ...EMPTY_LINE }]); }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)); }

  const filteredSuppliers = useCallback((search: string) =>
    suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6),
  [suppliers]);

  // Totals
  const lineTotals = lines.map(li => {
    const sub = Number(li.quantity) * Number(li.unitPrice);
    const tax = sub * (Number(li.taxRate) / 100);
    return { sub, tax, total: sub + tax };
  });
  const grandSubtotal = lineTotals.reduce((s, l) => s + l.sub, 0);
  const grandTax = lineTotals.reduce((s, l) => s + l.tax, 0);
  const grandTotal = grandSubtotal + grandTax;

  // Budget warning
  const budgetNum = Number(header.budget);
  const overBudget = budgetNum > 0 && grandTotal > budgetNum;

  function canProceed() {
    if (step === 0) {
      if (!header.title.trim() || !header.category.trim()) return false;
      return dynamicFieldDefs.filter(f => f.required).every(f => {
        const v = customFieldAnswers[f.fieldKey];
        return v !== undefined && v !== "";
      });
    }
    if (step === 1) return lines.every(li => li.description.trim() && Number(li.quantity) > 0);
    return true;
  }

  async function handleSubmit() {
    // Fix 1: Validate supplier is set on every line item
    const missingSupplier = lines.findIndex(li => !li.supplierId);
    if (missingSupplier !== -1) {
      setError(`Please select a supplier for line item ${missingSupplier + 1}.`);
      setLoading(false);
      return;
    }
    setLoading(true); setError(null); setWarning(null);
    const res = await fetch("/api/intake/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...header,
        budget: header.budget ? Number(header.budget) : undefined,
        intakeSource: "FORM",
        customFieldAnswers: Object.keys(customFieldAnswers).length > 0 ? customFieldAnswers : undefined,
        lineItems: lines.map((li) => ({
          description: li.description,
          partNumber: li.partNumber || undefined,
          category: li.category || header.category,
          commodity: li.commodity || undefined,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          taxRate: Number(li.taxRate) / 100,
          supplierId: li.supplierId || undefined,
          glAccount: li.glAccount || undefined,
          costCenter: li.costCenter || undefined,
          contractReference: li.contractReference || undefined,
          notes: li.notes || undefined,
          glCoaId: li.glCoaId || undefined,
          glCoding: Object.keys(li.glCoding).length > 0 ? li.glCoding : undefined,
        })),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Submission failed"); return; }
    if (data.warning) { setWarning(data.warning); }
    router.push(`/dashboard/requisitions/${data.requisition.id}`);
  }

  const priority = PRIORITIES.find(p => p.value === header.priority)!;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <Link href="/dashboard/intake" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="size-3.5" /> Back
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Purchase Request</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fill in the details below to submit for approval.</p>
        </div>
        {/* Step indicator */}
        <div className="hidden sm:flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <button onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  i === step ? "bg-[#1A2A52] text-white" :
                  i < step ? "bg-green-50 text-green-700 cursor-pointer" :
                  "bg-gray-100 text-gray-400"
                }`}>
                {i < step ? <CheckCircle className="size-3" /> : <span>{i + 1}</span>}
                {s}
              </button>
              {i < STEPS.length - 1 && <div className="size-1 rounded-full bg-gray-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── STEP 0: Header ── */}
      {step === 0 && (
        <div className="space-y-5">
          <Section title="Request Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Request title *">
                  <input required value={header.title} onChange={e => setH("title", e.target.value)}
                    className="input" placeholder="e.g. Laptops for new engineering hires — Q3 2026" />
                </Field>
              </div>
              <Field label="Category *">
                {categories.length > 0 ? (
                  <select value={header.category} onChange={e => { setH("category", e.target.value); setCustomFieldAnswers({}); }} className="input">
                    <option value="">— Select category —</option>
                    {categories.map(c => <option key={c.code} value={c.label}>{c.label}</option>)}
                  </select>
                ) : (
                  <input value={header.category} onChange={e => { setH("category", e.target.value); setCustomFieldAnswers({}); }}
                    className="input" placeholder="IT Hardware" />
                )}
              </Field>
              <Field label="Commodity / Sub-category">
                <input value={header.commodity} onChange={e => setH("commodity", e.target.value)}
                  className="input" placeholder="Laptops & Workstations" />
              </Field>
              <Field label="Priority">
                <div className="flex gap-2">
                  {PRIORITIES.map(p => (
                    <button key={p.value} type="button" onClick={() => setH("priority", p.value)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        header.priority === p.value
                          ? `${p.color} border-current ring-1 ring-current`
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Currency">
                <select value={header.currency} onChange={e => setH("currency", e.target.value)} className="input">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea rows={3} value={header.description} onChange={e => setH("description", e.target.value)}
                className="input resize-none" placeholder="Describe what you need and why…" />
            </Field>
          </Section>

          {header.category && (
            <Section title="Category-specific details">
              <DynamicFieldsPanel
                entity="REQUISITION"
                category={header.category}
                answers={customFieldAnswers}
                onChange={setCustomFieldAnswers}
                onFieldsLoaded={setDynamicFieldDefs}
              />
            </Section>
          )}

          <Section title="Organisation">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Business unit">
                <input value={header.businessUnit} onChange={e => setH("businessUnit", e.target.value)}
                  className="input" placeholder="Product & Technology" />
              </Field>
              <Field label="Department">
                <input value={header.department} onChange={e => setH("department", e.target.value)}
                  className="input" placeholder="Engineering" />
              </Field>
              <Field label="Project (optional)">
                <input value={header.project} onChange={e => setH("project", e.target.value)}
                  className="input" placeholder="Project Titan" />
              </Field>
            </div>
          </Section>

          <Section title="Delivery & Timing">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Delivery location">
                <input value={header.deliveryLocation} onChange={e => setH("deliveryLocation", e.target.value)}
                  className="input" placeholder="Noida office, Sector 62" />
              </Field>
              <Field label="Required by date">
                <input type="date" value={header.requiredDate} onChange={e => setH("requiredDate", e.target.value)} className="input" />
              </Field>
              <Field label="Approved budget (optional)">
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:border-[#1A2A52] focus-within:ring-1 focus-within:ring-[#1A2A52]">
                  <span className="px-3 text-sm text-gray-500 bg-gray-50 border-r border-gray-300 whitespace-nowrap">{header.currency}</span>
                  <input type="number" min="0" value={header.budget} onChange={e => setH("budget", e.target.value)}
                    className="flex-1 px-3 py-2 text-sm outline-none bg-white" placeholder="0.00" />
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Justification">
            <Field label="Business justification">
              <textarea rows={3} value={header.businessJustification} onChange={e => setH("businessJustification", e.target.value)}
                className="input resize-none" placeholder="Why is this purchase needed? What business objective does it serve?" />
            </Field>
            <label className="flex items-start gap-2.5 cursor-pointer mt-3">
              <input type="checkbox" checked={header.policyException} onChange={e => setH("policyException", e.target.checked)}
                className="mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">This request requires a policy exception</p>
                <p className="text-xs text-gray-500">Check this if the purchase falls outside standard procurement policy.</p>
              </div>
            </label>
            {header.policyException && (
              <Field label="Exception justification" className="mt-3">
                <textarea rows={2} value={header.policyExceptionNote} onChange={e => setH("policyExceptionNote", e.target.value)}
                  className="input resize-none" placeholder="Explain why this exception is needed…" />
              </Field>
            )}
          </Section>
        </div>
      )}

      {/* ── STEP 1: Line Items ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Line items</p>
              <p className="text-sm text-gray-500">Add every item or service you need. Each line has its own supplier and GL coding.</p>
            </div>
            <button onClick={addLine}
              className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#243766] transition-colors shrink-0">
              <Plus className="size-3.5" /> Add another line
              {lines.length > 1 && <span className="bg-white/20 text-white text-xs px-1.5 rounded-full">{lines.length}</span>}
            </button>
          </div>

          {lines.map((li, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Line {idx + 1}</p>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Field label="Description *">
                    <input required value={li.description} onChange={e => setLine(idx, "description", e.target.value)}
                      className="input" placeholder="MacBook Pro 14-inch M4, 16GB RAM, 512GB SSD" />
                  </Field>
                </div>
                <Field label="Part / SKU number">
                  <input value={li.partNumber} onChange={e => setLine(idx, "partNumber", e.target.value)}
                    className="input" placeholder="APPLE-MBP14-M4" />
                </Field>
                <Field label="Category">
                  <input value={li.category} onChange={e => setLine(idx, "category", e.target.value)}
                    className="input" placeholder={header.category || "IT Hardware"} />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Quantity *">
                  <input required type="number" min="0.01" step="0.01" value={li.quantity}
                    onChange={e => setLine(idx, "quantity", e.target.value)} className="input" />
                </Field>
                <Field label="Unit price">
                  <input type="number" min="0" step="0.01" value={li.unitPrice}
                    onChange={e => setLine(idx, "unitPrice", e.target.value)} className="input" />
                </Field>
                <Field label="Tax rate (%)">
                  <input type="number" min="0" max="100" step="0.1" value={li.taxRate}
                    onChange={e => setLine(idx, "taxRate", e.target.value)} className="input" placeholder="0" />
                </Field>
              </div>

              {/* Inline supplier search — required */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  {li.supplierId ? (
                    /* Selected state — shows name with clear button */
                    <div className="flex items-center justify-between border-2 border-green-400 bg-green-50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="size-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                          <svg className="size-3 text-white" viewBox="0 0 12 12" fill="currentColor"><path d="M10 3L5 8.5 2 5.5"/><path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{li.supplierSearch}</span>
                      </div>
                      <button type="button" onClick={() => { setLine(idx, "supplierId", ""); setLine(idx, "supplierSearch", ""); }}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                        Change
                      </button>
                    </div>
                  ) : (
                    /* Search state */
                    <>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#1A2A52]" />
                      <input
                        value={li.supplierSearch}
                        onChange={e => { setLine(idx, "supplierSearch", e.target.value); setLine(idx, "supplierId", ""); }}
                        onFocus={() => setSupplierDropdown({ idx, open: true })}
                        onBlur={() => setTimeout(() => setSupplierDropdown(s => ({ ...s, open: false })), 150)}
                        className="w-full border-2 border-[#1A2A52]/30 focus:border-[#1A2A52] rounded-lg pl-9 pr-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-gray-400 bg-white"
                        placeholder="Type to search active suppliers…" />
                      {supplierDropdown.idx === idx && supplierDropdown.open && (
                        <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                          {suppliers.length === 0 ? (
                            <p className="text-xs text-gray-400 px-3 py-3">No active suppliers. Add one under Suppliers first.</p>
                          ) : filteredSuppliers(li.supplierSearch).length === 0 ? (
                            <p className="text-xs text-gray-400 px-3 py-3">No suppliers match &ldquo;{li.supplierSearch}&rdquo;</p>
                          ) : (
                            filteredSuppliers(li.supplierSearch).map(s => (
                              <button key={s.id} type="button"
                                onClick={() => { setLine(idx, "supplierId", s.id); setLine(idx, "supplierSearch", s.name); setSupplierDropdown({ idx: -1, open: false }); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#1A2A52]/5 text-left transition-colors border-b border-gray-50 last:border-0">
                                <div className="size-7 rounded-lg bg-[#1A2A52]/10 flex items-center justify-center text-[#1A2A52] font-bold text-xs shrink-0">
                                  {s.name[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                                  {s.preferred && <span className="text-[10px] text-[#C8A04D] font-medium">★ Preferred supplier</span>}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Contract ref">
                  <input value={li.contractReference} onChange={e => setLine(idx, "contractReference", e.target.value)}
                    className="input" placeholder="CTR-2026-001" />
                </Field>
              </div>

              {/* Per-line COA coding */}
              <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">GL / Account coding for this line</p>
                <GlCodingPanel
                  chartOfAccountId={li.glCoaId}
                  glCoding={li.glCoding}
                  onCoaChange={v => setLines(prev => prev.map((l, i) => i === idx ? { ...l, glCoaId: v, glCoding: {} } : l))}
                  onCodingChange={v => setLines(prev => prev.map((l, i) => i === idx ? { ...l, glCoding: v } : l))}
                  compact
                />
              </div>

              <div className="flex justify-end pt-1 text-sm">
                <span className="text-gray-400 mr-2">Line total:</span>
                <span className="font-semibold text-gray-800">
                  {header.currency} {lineTotals[idx]?.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}

          {/* Grand total */}
          <div className={`rounded-2xl p-5 border ${overBudget ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
            {overBudget && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
                <AlertTriangle className="size-4" />
                This request exceeds the approved budget of {header.currency} {Number(header.budget).toLocaleString()}
              </div>
            )}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{header.currency} {grandSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Tax</span>
                <span>{header.currency} {grandTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100 text-base">
                <span>Total</span>
                <span>{header.currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Review ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <p className="font-semibold text-gray-900 mb-3">Request summary</p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <ReviewRow label="Title" value={header.title} />
              <ReviewRow label="Category" value={header.category} />
              <ReviewRow label="Priority">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priority.color}`}>{priority.label}</span>
              </ReviewRow>
              <ReviewRow label="Currency" value={header.currency} />
              {header.businessUnit && <ReviewRow label="Business unit" value={header.businessUnit} />}
              {header.department && <ReviewRow label="Department" value={header.department} />}
              {header.costCenter && <ReviewRow label="Cost center" value={header.costCenter} />}
              {header.project && <ReviewRow label="Project" value={header.project} />}
              {header.requiredDate && <ReviewRow label="Required by" value={new Date(header.requiredDate).toLocaleDateString()} />}
              {header.deliveryLocation && <ReviewRow label="Delivery" value={header.deliveryLocation} />}
              {header.budget && <ReviewRow label="Approved budget" value={`${header.currency} ${Number(header.budget).toLocaleString()}`} />}
            </div>
            {header.businessJustification && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Business justification</p>
                <p className="text-sm text-gray-700">{header.businessJustification}</p>
              </div>
            )}
            {header.policyException && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs mt-3">
                <AlertTriangle className="size-3.5 shrink-0" /> Policy exception requested: {header.policyExceptionNote}
              </div>
            )}
            {dynamicFieldDefs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {dynamicFieldDefs.map(f => (
                  <ReviewRow key={f.id} label={f.name} value={String(customFieldAnswers[f.fieldKey] ?? "—")} />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="font-semibold text-gray-900">{lines.length} line item{lines.length > 1 ? "s" : ""}</p>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-xs text-gray-500 text-left">
                <th className="px-5 py-2.5 font-medium">Description</th>
                <th className="px-5 py-2.5 font-medium">Qty</th>
                <th className="px-5 py-2.5 font-medium">Unit price</th>
                <th className="px-5 py-2.5 font-medium text-right">Total</th>
              </tr></thead>
              <tbody>
                {lines.map((li, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-2.5 text-gray-800">{li.description}</td>
                    <td className="px-5 py-2.5 text-gray-500">{li.quantity}</td>
                    <td className="px-5 py-2.5 text-gray-500">{header.currency} {Number(li.unitPrice).toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-gray-800 text-right font-medium">
                      {header.currency} {lineTotals[i]?.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="px-5 py-3 text-right font-bold text-gray-900">Grand Total</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">
                    {header.currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {overBudget && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle className="size-4 shrink-0" />
              This request ({header.currency} {grandTotal.toLocaleString()}) exceeds the approved budget of {header.currency} {Number(header.budget).toLocaleString()}.
            </div>
          )}
          {warning && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle className="size-4 shrink-0" /> {warning}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-200">
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="size-3.5" /> Back
          </button>
        ) : <div />}

        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}
            className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-[#243766] transition-colors disabled:opacity-40">
            Continue <ArrowRight className="size-3.5" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-[#243766] transition-colors disabled:opacity-50">
            {loading ? "Submitting…" : "Submit for approval"}
          </button>
        )}
      </div>

      <style jsx global>{`
        .input{width:100%;border:1px solid #d1d5db;border-radius:.5rem;padding:.5rem .875rem;font-size:.875rem;outline:none;background:white}
        .input:focus{border-color:#1a2a52;box-shadow:0 0 0 1px #1a2a52}
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function ReviewRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 border-b border-gray-50 last:border-0">
      <span className="text-gray-500 shrink-0">{label}</span>
      {children ?? <span className="font-medium text-gray-800 text-right truncate">{value || "—"}</span>}
    </div>
  );
}
