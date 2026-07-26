"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, Loader2, CheckCircle2, ArrowRight, RotateCcw, FileText, Package, ShoppingCart, ChevronRight } from "lucide-react";

type Supplier = { id: string; name: string; code: string; category: string | null; tier: string | null; preferred: boolean; rating: number | null; };
type Address = { code: string; label: string; };
type LineItem = { description: string; quantity: number; unit_price: number; supplier_id: string; supplier_name: string; gl_account: string; gl_label: string; };
type ReqData = { title?: string; category?: string; priority?: string; department?: string; justification?: string; required_date?: string; delivery_location?: string; line_items: LineItem[]; };

type Step = "WELCOME"|"WHAT"|"SUPPLIER_SEARCH"|"SUPPLIER_PICK"|"QUANTITY"|"PRICE"|"GL_ACCOUNT"|"MORE_ITEMS"|"CATEGORY"|"PRIORITY"|"DEPARTMENT"|"DATE"|"DELIVERY"|"JUSTIFY"|"CONFIRM"|"CREATED"|"APPROVED"|"PO_DONE"|"STATUS"|"PENDING";
type Msg = { role:"bot"|"user"|"status"; text:string; options?:{label:string;value:string}[]; card?:"summary"|"created"|"approved"|"po"; };

const GL_ACCOUNTS = [
  { value:"6100", label:"6100 — IT Hardware & Equipment" },
  { value:"6200", label:"6200 — Software & Licenses" },
  { value:"6300", label:"6300 — Cloud & Hosting Services" },
  { value:"6400", label:"6400 — Professional & Consulting" },
  { value:"6500", label:"6500 — Facilities & Infrastructure" },
  { value:"6600", label:"6600 — Office Supplies" },
  { value:"6700", label:"6700 — Travel & Expenses" },
  { value:"6800", label:"6800 — Marketing & Advertising" },
  { value:"6900", label:"6900 — Training & Development" },
];

const CATEGORIES = ["IT Hardware","Software & Licenses","Cloud Services","Consulting","Facilities & Infra","Office Supplies","Marketing","Training"];
const PRIORITIES = [{ label:"🔴 High — Urgent", value:"HIGH" },{ label:"🟡 Medium — Normal", value:"MEDIUM" },{ label:"🟢 Low — Flexible", value:"LOW" }];
const DEPARTMENTS = ["Engineering","Finance","IT","Operations","HR","Marketing","Sales","Product","Legal","Executive"];

export default function IntakeBot() {
  const [step, setStep] = useState<Step>("WELCOME");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [data, setData] = useState<ReqData>({ line_items: [] });
  const [currentItem, setCurrentItem] = useState<Partial<LineItem>>({});
  const [createdReqId, setCreatedReqId] = useState<string|null>(null);
  const [createdReqNum, setCreatedReqNum] = useState<string|null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  // Fetch suppliers
  const fetchSuppliers = useCallback(async (q?: string) => {
    try {
      const res = await fetch(`/api/suppliers?status=ACTIVE${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      const d = await res.json();
      setSuppliers(Array.isArray(d.suppliers) ? d.suppliers : []);
    } catch { setSuppliers([]); }
  }, []);

  // Fetch delivery addresses
  const fetchAddresses = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/lookups?type=DELIVERY_ADDRESS");
      const d = await res.json();
      const items = Array.isArray(d.lookups) ? d.lookups : [];
      setAddresses(items.map((l: any) => ({ code: l.code, label: l.label })));
    } catch { setAddresses([]); }
  }, []);

  const bot = (text: string, options?: Msg["options"], card?: Msg["card"]) => {
    setMsgs(m => [...m, { role: "bot", text, options, card }]);
  };
  const usr = (text: string) => setMsgs(m => [...m, { role: "user", text }]);
  const status = (text: string) => setMsgs(m => [...m, { role: "status", text }]);

  // Start flow
  useEffect(() => {
    bot(
      "Hello! 👋 I'm your procurement assistant.\n\nI'll help you create a purchase requisition. Let's start — what do you need to purchase today?",
      undefined
    );
    setStep("WHAT");
  }, []);

  function restart() {
    setStep("WELCOME");
    setData({ line_items: [] });
    setCurrentItem({});
    setCreatedReqId(null);
    setCreatedReqNum(null);
    setMsgs([]);
    setTimeout(() => {
      bot("Let's start fresh! What do you need to purchase today?");
      setStep("WHAT");
    }, 100);
  }

  async function handleOption(value: string, label: string) {
    usr(label);
    await advance(value, label);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    usr(text);
    await advance(text, text);
  }

  async function advance(value: string, label: string) {
    switch (step) {
      case "WHAT": {
        setData(d => ({ ...d, title: value }));
        setCurrentItem(ci => ({ ...ci, description: value }));
        setLoading(true);
        await fetchSuppliers(value);
        setLoading(false);
        setStep("SUPPLIER_SEARCH");
        bot("Got it! Let me find suppliers for this. Search by name or type anything to filter:", undefined);
        break;
      }
      case "SUPPLIER_SEARCH": {
        setSupplierSearch(value);
        setLoading(true);
        await fetchSuppliers(value);
        setLoading(false);
        setStep("SUPPLIER_PICK");
        const opts = suppliers.slice(0, 8).map(s => ({
          label: `${s.preferred ? "⭐ " : ""}${s.name}${s.category ? ` — ${s.category}` : ""}`,
          value: `${s.id}|${s.name}`,
        }));
        if (opts.length === 0) {
          bot("No suppliers found. Please try a different search term:");
          setStep("SUPPLIER_SEARCH");
        } else {
          bot("Select a supplier:", opts);
        }
        break;
      }
      case "SUPPLIER_PICK": {
        const [supplierId, supplierName] = value.split("|");
        setCurrentItem(ci => ({ ...ci, supplier_id: supplierId, supplier_name: supplierName }));
        bot("How many units do you need?");
        setStep("QUANTITY");
        break;
      }
      case "QUANTITY": {
        const qty = parseFloat(value);
        if (isNaN(qty) || qty <= 0) { bot("Please enter a valid quantity (e.g. 1, 5, 10):"); return; }
        setCurrentItem(ci => ({ ...ci, quantity: qty }));
        bot(`What is the unit price in ₹? (Estimated cost per item)`);
        setStep("PRICE");
        break;
      }
      case "PRICE": {
        const price = parseFloat(value.replace(/[^0-9.]/g, ""));
        if (isNaN(price) || price < 0) { bot("Please enter a valid price (e.g. 50000):"); return; }
        setCurrentItem(ci => ({ ...ci, unit_price: price }));
        bot(
          "Select the GL Account for this item:",
          GL_ACCOUNTS.map(g => ({ label: g.label, value: `${g.value}|${g.label}` }))
        );
        setStep("GL_ACCOUNT");
        break;
      }
      case "GL_ACCOUNT": {
        const [glCode, glLabel] = value.split("|");
        const completedItem: LineItem = {
          description: currentItem.description ?? data.title ?? "",
          quantity: currentItem.quantity ?? 1,
          unit_price: currentItem.unit_price ?? 0,
          supplier_id: currentItem.supplier_id ?? "",
          supplier_name: currentItem.supplier_name ?? "",
          gl_account: glCode,
          gl_label: glLabel ?? glCode,
        };
        const newItems = [...data.line_items, completedItem];
        setData(d => ({ ...d, line_items: newItems }));
        setCurrentItem({});
        const total = newItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
        bot(
          `Added! Running total: ₹${total.toLocaleString("en-IN")}\n\nDo you need to add another item?`,
          [{ label: "➕ Yes, add another item", value: "yes" }, { label: "✅ No, continue", value: "no" }]
        );
        setStep("MORE_ITEMS");
        break;
      }
      case "MORE_ITEMS": {
        if (value === "yes") {
          bot("What else do you need to purchase?");
          setCurrentItem({});
          setStep("WHAT");
          break;
        }
        bot("What is the category for this requisition?", CATEGORIES.map(c => ({ label: c, value: c })));
        setStep("CATEGORY");
        break;
      }
      case "CATEGORY": {
        setData(d => ({ ...d, category: value }));
        bot("What priority is this request?", PRIORITIES);
        setStep("PRIORITY");
        break;
      }
      case "PRIORITY": {
        setData(d => ({ ...d, priority: value }));
        bot("Which department is this for?", DEPARTMENTS.map(d => ({ label: d, value: d })));
        setStep("DEPARTMENT");
        break;
      }
      case "DEPARTMENT": {
        setData(d => ({ ...d, department: value }));
        bot("When do you need delivery by? (e.g. 30 Sep 2025 — or type 'ASAP')");
        setStep("DATE");
        break;
      }
      case "DATE": {
        setData(d => ({ ...d, required_date: value }));
        // Fetch addresses then show them
        setLoading(true);
        await fetchAddresses();
        setLoading(false);
        const addrOpts = addresses.length > 0
          ? addresses.map(a => ({ label: a.label, value: a.label }))
          : [
              { label: "Ace HQ — Bengaluru", value: "Ace HQ — Bengaluru" },
              { label: "Ace Delhi Office", value: "Ace Delhi Office" },
              { label: "Ace Mumbai Office", value: "Ace Mumbai Office" },
            ];
        bot("📍 Select delivery location — this is required:", addrOpts);
        setStep("DELIVERY");
        break;
      }
      case "DELIVERY": {
        if (!value || value.trim() === "") {
          bot("⚠️ Delivery location is required. Please select a location:", addresses.map(a => ({ label: a.label, value: a.label })));
          return;
        }
        setData(d => ({ ...d, delivery_location: value }));
        bot("Finally, why is this purchase needed? (brief business justification)");
        setStep("JUSTIFY");
        break;
      }
      case "JUSTIFY": {
        setData(d => ({ ...d, justification: value }));
        // Show summary
        const d2 = { ...data, justification: value };
        const total = d2.line_items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
        bot(
          `📋 Here's your requisition summary:\n\n` +
          `**Title:** ${d2.title}\n` +
          `**Category:** ${d2.category}\n` +
          `**Priority:** ${d2.priority}\n` +
          `**Department:** ${d2.department}\n` +
          `**Delivery To:** ${d2.delivery_location}\n` +
          `**Required By:** ${d2.required_date}\n\n` +
          `**Line Items (${d2.line_items.length}):**\n` +
          d2.line_items.map(li => `  • ${li.description} × ${li.quantity} @ ₹${li.unit_price.toLocaleString("en-IN")} — GL: ${li.gl_account} — ${li.supplier_name}`).join("\n") +
          `\n\n**Total (excl. GST):** ₹${total.toLocaleString("en-IN")}`,
          [{ label: "✅ Submit Requisition", value: "submit" }, { label: "↩ Start Over", value: "restart" }],
          "summary"
        );
        setStep("CONFIRM");
        break;
      }
      case "CONFIRM": {
        if (value === "restart") { restart(); return; }
        await submitRequisition();
        break;
      }
    }
  }

  async function submitRequisition() {
    setLoading(true);
    status("Submitting your requisition...");
    try {
      const total = data.line_items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const payload = {
        title: data.title,
        category: data.category ?? "General",
        priority: data.priority ?? "MEDIUM",
        department: data.department,
        businessJustification: data.justification,
        requiredDate: data.required_date,
        deliveryLocation: data.delivery_location ?? "",
        currency: "INR",
        intakeSource: "CHATBOT",
        lineItems: data.line_items.map(li => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unit_price,
          supplierId: li.supplier_id,
          glAccount: li.gl_account,          // ← This is the key fix
          category: data.category,
        })),
      };

      const res = await fetch("/api/intake/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const respData = await res.json();
      if (!res.ok) throw new Error(respData.error ?? "Submission failed");

      const reqId = respData.requisition?.id;
      const reqNum = respData.requisition?.requisitionNumber ?? "REQ-NEW";
      setCreatedReqId(reqId);
      setCreatedReqNum(reqNum);
      setStep("CREATED");

      bot(
        `✅ Requisition **${reqNum}** submitted successfully!\n\n` +
        `Total: ₹${total.toLocaleString("en-IN")} + GST\n` +
        `GL Accounts: ${[...new Set(data.line_items.map(l => l.gl_account))].join(", ")}\n` +
        `Delivery: ${data.delivery_location}\n\n` +
        `It's now pending manager approval. You'll be notified on any updates.`,
        [{ label: "📄 View Requisition", value: "view" }, { label: "➕ New Requisition", value: "new" }],
        "created"
      );
    } catch (e: any) {
      bot(`❌ Submission failed: ${e.message}\n\nPlease try again or contact your procurement team.`,
        [{ label: "🔄 Try Again", value: "retry" }, { label: "↩ Start Over", value: "restart" }]);
    }
    setLoading(false);
  }

  async function handlePostCreate(value: string) {
    if (value === "view" && createdReqId) { window.location.href = `/dashboard/requisitions/${createdReqId}`; return; }
    if (value === "new" || value === "restart" || value === "retry") { restart(); return; }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1A2A52] to-[#2D5A9B] px-5 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Sparkles className="size-5 text-[#C8A04D]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Procurement Assistant</p>
              <p className="text-[10px] text-white/60">Create a requisition with AI guidance</p>
            </div>
          </div>
          <button onClick={restart} className="size-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20">
            <RotateCcw className="size-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* Progress */}
      {["CATEGORY","PRIORITY","DEPARTMENT","DATE","DELIVERY","JUSTIFY","CONFIRM","CREATED"].includes(step) && (
        <div className="px-5 py-2 bg-white border-b border-gray-50">
          <div className="flex items-center gap-1.5">
            {["Items","Category","Priority","Dept","Date","Delivery","Justification","Review"].map((s, i) => {
              const steps2 = ["CATEGORY","PRIORITY","DEPARTMENT","DATE","DELIVERY","JUSTIFY","CONFIRM","CREATED"];
              const done = steps2.indexOf(step) > i;
              const current = steps2.indexOf(step) === i;
              return (
                <div key={s} className="flex items-center gap-1.5 flex-1">
                  <div className={`flex-1 h-1 rounded-full transition-colors ${done || current ? "bg-[#1A2A52]" : "bg-gray-100"}`} />
                  {i < 7 && <ChevronRight className="size-2.5 text-gray-200 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {msgs.map((m, i) => (
          <div key={i}>
            {m.role === "status" ? (
              <div className="flex items-center justify-center">
                <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">{m.text}</span>
              </div>
            ) : m.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-[#1A2A52] text-white text-xs px-4 py-3 rounded-2xl rounded-br-sm">
                  {m.text}
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5">
                <div className="size-7 rounded-xl bg-[#1A2A52] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="size-3.5 text-[#C8A04D]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-white border border-gray-100 text-gray-800 text-xs px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                    {m.text.split("\n").map((l, j) => <p key={j} className={j > 0 ? l ? "mt-1" : "h-1.5" : ""}>{l}</p>)}
                  </div>
                  {m.options && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.options.map(opt => (
                        <button key={opt.value}
                          onClick={() => step === "CREATED" ? handlePostCreate(opt.value) : handleOption(opt.value, opt.label)}
                          className="text-[11px] font-medium px-3 py-1.5 bg-white border border-gray-200 rounded-xl hover:bg-[#1A2A52] hover:text-white hover:border-[#1A2A52] transition-colors">
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className="size-7 rounded-xl bg-[#1A2A52] flex items-center justify-center shrink-0">
              <Sparkles className="size-3.5 text-[#C8A04D]" />
            </div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl shadow-sm">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => <div key={d} className="size-1.5 bg-[#1A2A52] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          </div>
        )}

        {/* Supplier search input when in SUPPLIER_SEARCH step */}
        {step === "SUPPLIER_PICK" && suppliers.length > 0 && (
          <div className="flex gap-2 mt-2">
            <input value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}
              placeholder="Search again..." className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#1A2A52]" />
            <button onClick={() => { usr("Search: " + supplierSearch); fetchSuppliers(supplierSearch); }} className="bg-[#1A2A52] text-white text-xs px-3 py-2 rounded-xl">Go</button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!["SUPPLIER_PICK","GL_ACCOUNT","MORE_ITEMS","CATEGORY","PRIORITY","DEPARTMENT","DELIVERY","CONFIRM","CREATED"].includes(step) && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-[#1A2A52]">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !loading) { e.preventDefault(); handleSend(); } }}
              placeholder={step === "WHAT" ? "What do you need to purchase?" : step === "SUPPLIER_SEARCH" ? "Search supplier name..." : step === "QUANTITY" ? "Enter quantity..." : step === "PRICE" ? "Enter unit price in ₹..." : step === "DATE" ? "e.g. 30 Sep 2025 or ASAP" : step === "JUSTIFY" ? "Brief business justification..." : "Type here..."}
              disabled={loading}
              className="flex-1 text-xs bg-transparent outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-40" />
            <button onClick={handleSend} disabled={!input.trim() || loading}
              className="size-8 bg-[#1A2A52] rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-[#243766]">
              {loading ? <Loader2 className="size-3.5 text-white animate-spin" /> : <Send className="size-3.5 text-white" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

