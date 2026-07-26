
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, Loader2, RotateCcw, ChevronRight } from "lucide-react";

type Supplier = { id: string; name: string; code: string; category: string | null; tier: string | null; preferred: boolean; rating: number | null; };
type Address = { code: string; label: string; };
type LineItem = { description: string; quantity: number; unit_price: number; supplier_id: string; supplier_name: string; gl_account: string; gl_label: string; };
type ReqData = { title?: string; category?: string; priority?: string; department?: string; justification?: string; required_date?: string; delivery_location?: string; line_items: LineItem[]; };
type Step = "WELCOME"|"WHAT"|"SUPPLIER_SEARCH"|"SUPPLIER_PICK"|"QUANTITY"|"PRICE"|"GL_ACCOUNT"|"MORE_ITEMS"|"CATEGORY"|"PRIORITY"|"DEPARTMENT"|"DATE"|"DELIVERY"|"JUSTIFY"|"CONFIRM"|"DONE";
type Msg = { role: "bot"|"user"|"status"; text: string; options?: { label: string; value: string }[]; };

const GL_ACCOUNTS = [
  { value:"6100", label:"6100 — IT Hardware & Equipment" },
  { value:"6200", label:"6200 — Software & Licenses" },
  { value:"6300", label:"6300 — Cloud & Hosting" },
  { value:"6400", label:"6400 — Professional Services" },
  { value:"6500", label:"6500 — Facilities & Infrastructure" },
  { value:"6600", label:"6600 — Office Supplies" },
  { value:"6700", label:"6700 — Travel & Expenses" },
  { value:"6800", label:"6800 — Marketing" },
  { value:"6900", label:"6900 — Training & Development" },
];
const CATEGORIES = ["IT Hardware","Software & Licenses","Cloud Services","Consulting","Facilities & Infra","Office Supplies","Marketing","Training"];
const PRIORITIES = [{ label:"🔴 High — Urgent", value:"HIGH" },{ label:"🟡 Medium — Normal", value:"MEDIUM" },{ label:"🟢 Low — Flexible", value:"LOW" }];
const DEPTS = ["Engineering","Finance","IT","Operations","HR","Marketing","Sales","Product","Legal","Executive"];

const TEXT_STEPS: Step[] = ["WHAT","SUPPLIER_SEARCH","QUANTITY","PRICE","DATE","JUSTIFY"];

export default function IntakeBot() {
  const [step, setStep] = useState<Step>("WELCOME");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [data, setData] = useState<ReqData>({ line_items: [] });
  const [curItem, setCurItem] = useState<Partial<LineItem>>({});
  const [createdId, setCreatedId] = useState<string|null>(null);
  const [createdNum, setCreatedNum] = useState<string|null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const fetchSuppliers = useCallback(async (q?: string) => {
    try {
      const r = await fetch(`/api/suppliers?status=ACTIVE${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      const d = await r.json();
      setSuppliers(Array.isArray(d.suppliers) ? d.suppliers : []);
    } catch { setSuppliers([]); }
  }, []);

  const fetchAddresses = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/lookups?type=DELIVERY_ADDRESS");
      const d = await r.json();
      setAddresses((d.lookups || []).map((l: any) => ({ code: l.code, label: l.label })));
    } catch { setAddresses([]); }
  }, []);

  const addMsg = (role: Msg["role"], text: string, options?: Msg["options"]) =>
    setMsgs(m => [...m, { role, text, options }]);

  useEffect(() => {
    addMsg("bot",
      "Hi! 👋 I'm Aria, your AI procurement assistant.\n\nI'll guide you through creating a purchase requisition step by step.\n\nWhat do you need to purchase today?"
    );
    setStep("WHAT");
    fetchSuppliers();
    fetchAddresses();
  }, []);

  function restart() {
    setStep("WELCOME");
    setData({ line_items: [] });
    setCurItem({});
    setCreatedId(null);
    setCreatedNum(null);
    setMsgs([]);
    setTimeout(() => {
      addMsg("bot", "Let's start fresh! What do you need to purchase today?");
      setStep("WHAT");
    }, 100);
  }

  async function handleOption(value: string, label: string) {
    addMsg("user", label);
    await advance(value, label);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    addMsg("user", text);
    await advance(text, text);
  }

  async function advance(value: string, label: string) {
    switch (step) {
      case "WHAT": {
        setData(d => ({ ...d, title: value }));
        setCurItem(ci => ({ ...ci, description: value }));
        setLoading(true);
        await fetchSuppliers(value);
        setLoading(false);
        setStep("SUPPLIER_SEARCH");
        addMsg("bot", "Got it! Now search for a supplier — type a name or category to filter:");
        break;
      }
      case "SUPPLIER_SEARCH": {
        setLoading(true);
        await fetchSuppliers(value);
        setLoading(false);
        const list = suppliers.slice(0, 8);
        if (list.length === 0) {
          addMsg("bot", "No suppliers found for that search. Try a different keyword:");
          return;
        }
        addMsg("bot", "Select the supplier for this item:", list.map(s => ({
          label: `${s.preferred ? "⭐ " : ""}${s.name}${s.category ? ` · ${s.category}` : ""}`,
          value: `${s.id}|${s.name}`,
        })));
        setStep("SUPPLIER_PICK");
        break;
      }
      case "SUPPLIER_PICK": {
        const [supplierId, supplierName] = value.split("|");
        setCurItem(ci => ({ ...ci, supplier_id: supplierId, supplier_name: supplierName }));
        addMsg("bot", `Great — ${supplierName} selected!\n\nHow many units do you need?`);
        setStep("QUANTITY");
        break;
      }
      case "QUANTITY": {
        const qty = parseFloat(value);
        if (isNaN(qty) || qty <= 0) { addMsg("bot", "Please enter a valid quantity (e.g. 1, 5, 10):"); return; }
        setCurItem(ci => ({ ...ci, quantity: qty }));
        addMsg("bot", "What is the estimated unit price in ₹?\n\n(Enter numbers only, e.g. 50000)");
        setStep("PRICE");
        break;
      }
      case "PRICE": {
        const price = parseFloat(value.replace(/[^0-9.]/g, ""));
        if (isNaN(price) || price < 0) { addMsg("bot", "Please enter a valid price (e.g. 50000):"); return; }
        setCurItem(ci => ({ ...ci, unit_price: price }));
        addMsg("bot", "Select the GL Account for this item — this will appear on the purchase order:", GL_ACCOUNTS.map(g => ({ label: g.label, value: `${g.value}|${g.label}` })));
        setStep("GL_ACCOUNT");
        break;
      }
      case "GL_ACCOUNT": {
        const [glCode, glLabel] = value.split("|");
        const completed: LineItem = {
          description: curItem.description ?? data.title ?? "",
          quantity: curItem.quantity ?? 1,
          unit_price: curItem.unit_price ?? 0,
          supplier_id: curItem.supplier_id ?? "",
          supplier_name: curItem.supplier_name ?? "",
          gl_account: glCode,
          gl_label: glLabel ?? glCode,
        };
        const newItems = [...data.line_items, completed];
        setData(d => ({ ...d, line_items: newItems }));
        setCurItem({});
        const total = newItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
        addMsg("bot",
          `Added ✅\n\nRunning total: ₹${total.toLocaleString("en-IN")} (excl. GST)\n\nDo you need to add another item?`,
          [{ label: "➕ Yes, add another item", value: "yes" }, { label: "✅ No, continue to details", value: "no" }]
        );
        setStep("MORE_ITEMS");
        break;
      }
      case "MORE_ITEMS": {
        if (value === "yes") {
          addMsg("bot", "What else do you need to purchase?");
          setCurItem({});
          setStep("WHAT");
          return;
        }
        addMsg("bot", "What category best describes this requisition?", CATEGORIES.map(c => ({ label: c, value: c })));
        setStep("CATEGORY");
        break;
      }
      case "CATEGORY": {
        setData(d => ({ ...d, category: value }));
        addMsg("bot", "What priority is this request?", PRIORITIES);
        setStep("PRIORITY");
        break;
      }
      case "PRIORITY": {
        setData(d => ({ ...d, priority: value }));
        addMsg("bot", "Which department is raising this request?", DEPTS.map(d => ({ label: d, value: d })));
        setStep("DEPARTMENT");
        break;
      }
      case "DEPARTMENT": {
        setData(d => ({ ...d, department: value }));
        addMsg("bot", "When do you need delivery by?\n\n(e.g. 30 Sep 2025 — or type ASAP)");
        setStep("DATE");
        break;
      }
      case "DATE": {
        setData(d => ({ ...d, required_date: value }));
        const addrOpts = addresses.length > 0
          ? addresses.map(a => ({ label: a.label, value: a.label }))
          : [
              { label: "Ace HQ — Prestige Tech Park, Bengaluru", value: "Ace HQ — Prestige Tech Park, Bengaluru" },
              { label: "Ace Delhi Office — DLF Cyber City, Gurugram", value: "Ace Delhi Office — DLF Cyber City, Gurugram" },
              { label: "Ace Mumbai Office — One BKC, Mumbai", value: "Ace Mumbai Office — One BKC, Mumbai" },
            ];
        addMsg("bot", "📍 Select the delivery location — required for the purchase order:", addrOpts);
        setStep("DELIVERY");
        break;
      }
      case "DELIVERY": {
        if (!value.trim()) {
          addMsg("bot", "⚠️ Delivery location is required. Please select one:");
          return;
        }
        setData(d => ({ ...d, delivery_location: value }));
        addMsg("bot", "Almost done! Please provide a brief business justification for this purchase:");
        setStep("JUSTIFY");
        break;
      }
      case "JUSTIFY": {
        const finalData = { ...data, justification: value };
        setData(finalData);
        const total = finalData.line_items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
        const summary = `📋 **Requisition Summary**\n\n` +
          `Title: ${finalData.title}\n` +
          `Category: ${finalData.category}\n` +
          `Priority: ${finalData.priority}\n` +
          `Department: ${finalData.department}\n` +
          `Delivery: ${finalData.delivery_location}\n` +
          `Required by: ${finalData.required_date}\n\n` +
          `Items (${finalData.line_items.length}):\n` +
          finalData.line_items.map(li => `  • ${li.description} × ${li.quantity} @ ₹${li.unit_price.toLocaleString("en-IN")}\n    GL: ${li.gl_account} | Supplier: ${li.supplier_name}`).join("\n") +
          `\n\nTotal (excl. GST): ₹${total.toLocaleString("en-IN")}\nGST (18%): ₹${(total * 0.18).toLocaleString("en-IN")}\nGrand Total: ₹${(total * 1.18).toLocaleString("en-IN")}\n\nReady to submit?`;
        addMsg("bot", summary, [
          { label: "✅ Submit Requisition", value: "submit" },
          { label: "↩ Start Over", value: "restart" },
        ]);
        setStep("CONFIRM");
        break;
      }
      case "CONFIRM": {
        if (value === "restart") { restart(); return; }
        await submitRequisition();
        break;
      }
      case "DONE": {
        if (value === "view" && createdId) { window.location.href = `/dashboard/requisitions/${createdId}`; return; }
        if (value === "new") { restart(); return; }
        break;
      }
    }
  }

  async function submitRequisition() {
    setLoading(true);
    addMsg("status", "Submitting your requisition...");
    try {
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
          supplierId: li.supplier_id || undefined,
          glAccount: li.gl_account,
          category: data.category,
        })),
      };
      const res = await fetch("/api/intake/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const respData = await res.json();
      if (!res.ok) throw new Error(respData.error ?? "Submission failed");
      const reqId = respData.requisition?.id;
      const reqNum = respData.requisition?.requisitionNumber ?? "REQ-NEW";
      setCreatedId(reqId);
      setCreatedNum(reqNum);
      const total = data.line_items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      addMsg("bot",
        `🎉 Requisition **${reqNum}** submitted successfully!\n\n` +
        `Total: ₹${(total * 1.18).toLocaleString("en-IN")} (incl. GST)\n` +
        `GL Accounts: ${[...new Set(data.line_items.map(l => l.gl_account))].join(", ")}\n` +
        `Delivery: ${data.delivery_location}\n\n` +
        `It is now pending manager approval. You will be notified once a decision is made.`,
        [
          { label: "📄 View Requisition", value: "view" },
          { label: "➕ New Requisition", value: "new" },
        ]
      );
      setStep("DONE");
    } catch (e: any) {
      addMsg("bot",
        `❌ Submission failed: ${e.message}\n\nPlease try again.`,
        [{ label: "🔄 Try Again", value: "submit" }, { label: "↩ Start Over", value: "restart" }]
      );
      setStep("CONFIRM");
    }
    setLoading(false);
  }

  const BUTTON_STEPS: Step[] = ["SUPPLIER_PICK","GL_ACCOUNT","MORE_ITEMS","CATEGORY","PRIORITY","DEPARTMENT","DELIVERY","CONFIRM","DONE"];
  const showInput = !BUTTON_STEPS.includes(step);

  const PROGRESS_STEPS = [
    { label: "Item", steps: ["WHAT","SUPPLIER_SEARCH","SUPPLIER_PICK","QUANTITY","PRICE","GL_ACCOUNT","MORE_ITEMS"] as Step[] },
    { label: "Details", steps: ["CATEGORY","PRIORITY","DEPARTMENT"] as Step[] },
    { label: "Delivery", steps: ["DATE","DELIVERY"] as Step[] },
    { label: "Review", steps: ["JUSTIFY","CONFIRM","DONE"] as Step[] },
  ];
  const currentStepGroup = PROGRESS_STEPS.findIndex(g => g.steps.includes(step));

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
              <p className="text-sm font-bold text-white">Aria — Procurement Assistant</p>
              <p className="text-[10px] text-white/60">Guided requisition creation</p>
            </div>
          </div>
          <button onClick={restart} title="Start over" className="size-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <RotateCcw className="size-3.5 text-white" />
          </button>
        </div>
        {/* Progress bar */}
        {step !== "WELCOME" && (
          <div className="flex items-center gap-2 mt-3">
            {PROGRESS_STEPS.map((g, i) => (
              <div key={g.label} className="flex items-center gap-2 flex-1">
                <div className="flex-1">
                  <div className={`h-1 rounded-full transition-all ${i <= currentStepGroup ? "bg-[#C8A04D]" : "bg-white/20"}`} />
                  <p className={`text-[9px] mt-1 text-center ${i <= currentStepGroup ? "text-white/80" : "text-white/30"}`}>{g.label}</p>
                </div>
                {i < PROGRESS_STEPS.length - 1 && <ChevronRight className="size-3 text-white/30 shrink-0 mb-3" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {msgs.map((m, i) => (
          <div key={i}>
            {m.role === "status" ? (
              <div className="flex justify-center">
                <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Loader2 className="size-2.5 animate-spin" />{m.text}
                </span>
              </div>
            ) : m.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[78%] bg-[#1A2A52] text-white text-xs px-4 py-2.5 rounded-2xl rounded-br-sm leading-relaxed">{m.text}</div>
              </div>
            ) : (
              <div className="flex gap-2.5">
                <div className="size-7 rounded-xl bg-[#1A2A52] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="size-3.5 text-[#C8A04D]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-white border border-gray-100 text-gray-800 text-xs px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm leading-relaxed">
                    {m.text.split("\n").map((line, j) => (
                      <p key={j} className={j > 0 ? (line ? "mt-1" : "h-1") : ""}>{line}</p>
                    ))}
                  </div>
                  {m.options && m.options.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.options.map(opt => (
                        <button key={opt.value}
                          onClick={() => {
                            const isLast = i === msgs.length - 1;
                            if (isLast) { step === "DONE" ? handleOption(opt.value, opt.label) : handleOption(opt.value, opt.label); }
                          }}
                          className="text-[11px] font-medium px-3 py-1.5 bg-white border border-gray-200 rounded-xl hover:bg-[#1A2A52] hover:text-white hover:border-[#1A2A52] transition-colors shadow-sm">
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
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {showInput && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-[#1A2A52] focus-within:bg-white transition-colors">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !loading) { e.preventDefault(); handleSend(); } }}
              placeholder={
                step === "WHAT" ? "What do you need to purchase?" :
                step === "SUPPLIER_SEARCH" ? "Type supplier name to search..." :
                step === "QUANTITY" ? "Enter quantity (e.g. 5)..." :
                step === "PRICE" ? "Enter unit price in ₹ (e.g. 50000)..." :
                step === "DATE" ? "e.g. 30 Sep 2025 or ASAP..." :
                step === "JUSTIFY" ? "Why is this purchase needed?..." :
                "Type your response..."
              }
              disabled={loading}
              className="flex-1 text-xs bg-transparent outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="size-7 bg-[#1A2A52] rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-[#243766] transition-colors"
            >
              {loading ? <Loader2 className="size-3 text-white animate-spin" /> : <Send className="size-3 text-white" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
