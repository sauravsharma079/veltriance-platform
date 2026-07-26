
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles, Send, Loader2, CheckCircle2,
  ArrowRight, RotateCcw, FileText,
  Package, ShoppingCart, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Supplier = {
  id: string; name: string; code: string;
  category: string | null; tier: string | null; preferred: boolean; rating: number | null;
};

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  supplier_id: string;
  supplier_name: string;
  gl_account: string;
  gl_label: string;
};

type ReqData = {
  title?: string;
  category?: string;
  priority?: string;
  department?: string;
  justification?: string;
  required_date?: string;
  line_items: LineItem[];
};

type Step =
  | "WELCOME"
  | "WHAT"
  | "SUPPLIER_SEARCH"
  | "SUPPLIER_PICK"
  | "QUANTITY"
  | "PRICE"
  | "GL_ACCOUNT"
  | "MORE_ITEMS"
  | "CATEGORY"
  | "PRIORITY"
  | "DEPARTMENT"
  | "DATE"
  | "JUSTIFY"
  | "CONFIRM"
  | "CREATED"
  | "APPROVED"
  | "PO_DONE"
  | "STATUS"
  | "PENDING";

type Msg = {
  role: "bot" | "user" | "status";
  text: string;
  options?: { label: string; value: string }[];
  card?: "summary" | "created" | "approved" | "po";
  cardData?: Record<string, unknown>;
};

// ─── Static data ──────────────────────────────────────────────────────────────

const CATS = [
  "IT Hardware","Software & Licenses","Cloud Services","Consulting Services",
  "Office Supplies","Facilities","Logistics","Marketing","Professional Services","Other",
];

const PRIORITIES = [
  { label: "🟢 Low",      value: "LOW"      },
  { label: "🟡 Medium",   value: "MEDIUM"   },
  { label: "🔴 High",     value: "HIGH"     },
  { label: "🚨 Critical", value: "CRITICAL" },
];

const DEPTS = [
  "IT","Engineering","Finance","Operations",
  "HR","Marketing","Sales","Legal",
];

const GL_ACCOUNTS = [
  { code: "6100", label: "IT Equipment & Assets"    },
  { code: "6200", label: "Software Subscriptions"   },
  { code: "6300", label: "Cloud Infrastructure"     },
  { code: "6400", label: "Professional Services"    },
  { code: "6500", label: "Office Supplies & Admin"  },
  { code: "6600", label: "Facilities & Maintenance" },
  { code: "6700", label: "Marketing & Events"       },
  { code: "6800", label: "Travel & Accommodation"   },
  { code: "6900", label: "Other Operating Expenses" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function bold(t: string) {
  return t.split(/\*\*([^*]+)\*\*/g).map((p, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-gray-900">{p}</strong>
      : <span key={i}>{p}</span>
  );
}

async function api(action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/procurement/orchestrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

// ─── Flow progress bar ────────────────────────────────────────────────────────

const FLOW = [
  { label: "Intake",   steps: ["WELCOME","WHAT","SUPPLIER_SEARCH","SUPPLIER_PICK","QUANTITY","PRICE","GL_ACCOUNT","MORE_ITEMS","CATEGORY","PRIORITY","DEPARTMENT","DATE","JUSTIFY","CONFIRM"] },
  { label: "Approval", steps: ["CREATED","APPROVED"] },
  { label: "PO",       steps: ["PO_DONE"] },
];

function FlowBar({ step }: { step: Step }) {
  const stageIdx = FLOW.findIndex(s => s.steps.includes(step));
  return (
    <div className="flex items-center gap-0">
      {FLOW.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
            i < stageIdx   ? "bg-emerald-500/20 text-emerald-400" :
            i === stageIdx ? "bg-white/15 text-white" :
                             "text-white/30"
          }`}>
            {i < stageIdx && <CheckCircle2 className="size-3 shrink-0" />}
            {s.label}
          </div>
          {i < FLOW.length - 1 && (
            <ChevronRight className={`size-3 mx-0.5 ${i < stageIdx ? "text-emerald-400" : "text-white/20"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ data, onConfirm, onEdit }: {
  data: ReqData;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const subtotal = data.line_items.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const tax      = subtotal * 0.18;
  return (
    <div className="bg-white border border-[#1A2A52]/20 rounded-2xl overflow-hidden shadow-sm mt-2">
      <div className="bg-[#1A2A52] px-4 py-3 flex items-center gap-2">
        <FileText className="size-4 text-[#C8A04D]" />
        <p className="text-sm font-bold text-white">Requisition Summary</p>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Title</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">{data.title}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><p className="text-[10px] text-gray-400 font-semibold uppercase">Category</p><p className="text-xs text-gray-800 mt-0.5">{data.category || "—"}</p></div>
          <div><p className="text-[10px] text-gray-400 font-semibold uppercase">Priority</p><p className="text-xs text-gray-800 mt-0.5">{data.priority || "MEDIUM"}</p></div>
          <div><p className="text-[10px] text-gray-400 font-semibold uppercase">Dept.</p><p className="text-xs text-gray-800 mt-0.5">{data.department || "—"}</p></div>
        </div>
        <div className="border-t border-gray-100 pt-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Line Items</p>
          <div className="space-y-2">
            {data.line_items.map((l, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-2.5">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-gray-900 flex-1 mr-2">{l.description}</p>
                  <p className="text-xs font-bold text-[#1A2A52] shrink-0">{fmt(l.quantity * l.unit_price)}</p>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-gray-500">🏢 {l.supplier_name}</span>
                  <span className="text-[10px] text-gray-500">× {l.quantity} @ {fmt(l.unit_price)}</span>
                  <span className="text-[10px] bg-[#1A2A52]/8 text-[#1A2A52] px-1.5 py-0.5 rounded font-mono">{l.gl_account} — {l.gl_label}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-2 space-y-1">
            <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between text-xs text-gray-500"><span>GST (18%)</span><span>{fmt(tax)}</span></div>
            <div className="flex justify-between text-sm font-bold text-[#1A2A52]"><span>Total</span><span>{fmt(subtotal + tax)}</span></div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onConfirm}
            className="flex-1 bg-[#1A2A52] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#243766] transition-colors flex items-center justify-center gap-1.5">
            <CheckCircle2 className="size-3.5" /> Submit for Approval
          </button>
          <button onClick={onEdit}
            className="px-4 py-2.5 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatedCard({ reqNum, total, onApprove }: { reqNum: string; total: number; onApprove: () => void }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl overflow-hidden mt-2">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-emerald-200">
        <CheckCircle2 className="size-4 text-emerald-600" />
        <p className="text-sm font-bold text-emerald-800">Requisition Created!</p>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-emerald-700">{reqNum}</p>
            <p className="text-lg font-black text-emerald-900">{fmt(total)}</p>
            <p className="text-[10px] text-emerald-600">Status: SUBMITTED · Awaiting approval</p>
          </div>
          <div className="size-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <FileText className="size-6 text-emerald-600" />
          </div>
        </div>
        <button onClick={onApprove}
          className="w-full bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5">
          <CheckCircle2 className="size-3.5" /> Approve Now
        </button>
      </div>
    </div>
  );
}

function ApprovedCard({ reqNum, onCreatePO }: { reqNum: string; onCreatePO: () => void }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl overflow-hidden mt-2">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-blue-200">
        <CheckCircle2 className="size-4 text-blue-600" />
        <p className="text-sm font-bold text-blue-800">Fully Approved!</p>
      </div>
      <div className="p-4">
        <p className="text-xs text-blue-700 mb-3"><strong>{reqNum}</strong> is approved and ready for procurement.</p>
        <button onClick={onCreatePO}
          className="w-full bg-[#1A2A52] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#243766] transition-colors flex items-center justify-center gap-1.5">
          <Package className="size-3.5" /> Create Purchase Order
        </button>
      </div>
    </div>
  );
}

function POCard({ poNum, total, supplierEmail }: { poNum: string; total: number; supplierEmail: string | null }) {
  return (
    <div className="bg-[#1A2A52] rounded-2xl overflow-hidden mt-2">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-white/10">
        <ShoppingCart className="size-4 text-[#C8A04D]" />
        <p className="text-sm font-bold text-white">Purchase Order Created!</p>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-white/60">{poNum}</p>
            <p className="text-xl font-black text-white">{fmt(total)}</p>
            <p className="text-[10px] text-[#C8A04D]">
              Status: SENT{supplierEmail ? ` · ${supplierEmail}` : ""}
            </p>
          </div>
          <div className="size-12 bg-white/10 rounded-xl flex items-center justify-center">
            <ShoppingCart className="size-6 text-[#C8A04D]" />
          </div>
        </div>
        <div className="bg-white/10 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-[#C8A04D] shrink-0" />
          <p className="text-xs text-white/80">Procurement cycle complete! PO sent to supplier. 🎉</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntakeBot() {
  const [step, setStep]         = useState<Step>("WELCOME");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [reqData, setReqData]   = useState<ReqData>({ line_items: [] });
  const [currentItem, setCurrentItem] = useState<Partial<LineItem>>({});
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [createdReqId,  setCreatedReqId]   = useState("");
  const [createdReqNum, setCreatedReqNum]  = useState("");
  const [createdTotal,  setCreatedTotal]   = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const push = useCallback((msgs: Msg[]) => setMessages(p => [...p, ...msgs]), []);

  useEffect(() => {
    push([{
      role: "bot",
      text: "👋 Hi! I'm **Aria**, your AI Procurement Assistant.\n\nI'll guide you through the complete process — from intake to Purchase Order.\n\nWhat would you like to do?",
      options: [
        { label: "🛒 Create a new purchase request", value: "new"     },
        { label: "✅ Check pending approvals",        value: "pending" },
        { label: "🔍 Check requisition status",       value: "status"  },
      ],
    }]);
  }, []);

  // ── Option button handler ─────────────────────────────────────────────────

  async function handleOption(value: string, label: string) {
    push([{ role: "user", text: label }]);

    // WELCOME menu
    if (step === "WELCOME") {
      if (value === "new") {
        setStep("WHAT");
        push([{ role: "bot", text: "What do you need to buy?\n\nDescribe the item — for example:\n*\"MacBook Pro 14-inch\"*\n*\"Microsoft 365 subscription\"*\n*\"AWS cloud infrastructure\"*" }]);
      } else if (value === "pending") {
        await loadPending();
      } else {
        setStep("STATUS");
        push([{ role: "bot", text: "Enter the requisition number (e.g. **REQ-000001**):" }]);
      }
      return;
    }

    // Supplier selection from list
    if (step === "SUPPLIER_PICK") {
      if (value === "search_again") {
        setStep("SUPPLIER_SEARCH");
        push([{ role: "bot", text: "Enter a different supplier name or category to search:" }]);
        return;
      }
      const sup = suppliers.find(s => s.id === value);
      if (!sup) return;
      setCurrentItem(p => ({ ...p, supplier_id: sup.id, supplier_name: sup.name }));
      setStep("QUANTITY");
      push([{
        role: "bot",
        text: `✅ **${sup.name}** selected.\n\nHow many units do you need?`,
      }]);
      return;
    }

    // More items
    if (step === "MORE_ITEMS") {
      if (value === "yes") {
        setCurrentItem({});
        setStep("WHAT");
        push([{ role: "bot", text: "What is the next item you need?" }]);
      } else {
        setStep("CATEGORY");
        push([{
          role: "bot",
          text: "Which **spend category** does this request fall under?",
          options: CATS.map(c => ({ label: c, value: c })),
        }]);
      }
      return;
    }

    // Category
    if (step === "CATEGORY") {
      setReqData(d => ({ ...d, category: value }));
      setStep("PRIORITY");
      push([{
        role: "bot",
        text: "What is the **urgency** of this request?",
        options: PRIORITIES,
      }]);
      return;
    }

    // Priority
    if (step === "PRIORITY") {
      setReqData(d => ({ ...d, priority: value }));
      setStep("DEPARTMENT");
      push([{
        role: "bot",
        text: "Which **department** is raising this request?",
        options: DEPTS.map(d => ({ label: d, value: d })),
      }]);
      return;
    }

    // Department
    if (step === "DEPARTMENT") {
      setReqData(d => ({ ...d, department: value }));
      setStep("DATE");
      push([{ role: "bot", text: "When do you need this by?\n\nEnter a date (DD/MM/YYYY), type **'asap'**, or type **'skip'**:" }]);
      return;
    }

    // GL account
    if (step === "GL_ACCOUNT") {
      const gl = GL_ACCOUNTS.find(g => g.code === value);
      if (!gl) return;
      const item: LineItem = {
        description:   currentItem.description!,
        quantity:      currentItem.quantity!,
        unit_price:    currentItem.unit_price!,
        supplier_id:   currentItem.supplier_id!,
        supplier_name: currentItem.supplier_name!,
        gl_account:    gl.code,
        gl_label:      gl.label,
      };
      const updatedItems = [...reqData.line_items, item];
      setReqData(d => ({ ...d, line_items: updatedItems }));
      const lineTotal = item.quantity * item.unit_price;
      setStep("MORE_ITEMS");
      push([{
        role: "bot",
        text: `✅ **${gl.code} — ${gl.label}** assigned.\n\nLine item added:\n**${item.description}** × ${item.quantity} = **${fmt(lineTotal)}** (+18% GST = **${fmt(lineTotal * 1.18)}**)\n\nWould you like to add another item?`,
        options: [
          { label: "➕ Add another item",    value: "yes" },
          { label: "✅ That's all, continue", value: "no"  },
        ],
      }]);
      return;
    }

    // Confirm
    if (step === "CONFIRM") {
      if (value === "confirm") {
        await doCreate();
      } else {
        reset();
      }
      return;
    }

    // After created — approve
    if (step === "CREATED" && value === "approve") {
      await doApprove();
      return;
    }

    // After approved — create PO
    if (step === "APPROVED" && value === "create_po") {
      await doCreatePO();
      return;
    }
  }

  // ── Text input handler ────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    push([{ role: "user", text }]);

    const skip = ["skip","na","n/a","no","later"].includes(text.toLowerCase());

    try {
      switch (step) {

        // WHAT — item description
        case "WHAT": {
          const desc = text.trim();
          if (!reqData.title) setReqData(d => ({ ...d, title: desc }));
          setCurrentItem({ description: desc });

          // Search suppliers — MANDATORY step
          push([{ role: "status", text: "Searching supplier directory…" }]);
          const d = await api("search_suppliers", { query: desc });
          setMessages(p => p.filter(m => m.role !== "status"));
          const sups: Supplier[] = d.suppliers ?? [];
          setSuppliers(sups);

          setStep("SUPPLIER_PICK");
          if (sups.length > 0) {
            push([{
              role: "bot",
              text: `Got it — **"${desc}"** ✓\n\n**Select a supplier** (mandatory):`,
              options: [
                ...sups.slice(0, 5).map(s => ({
                  label: `${s.preferred ? "⭐" : "🏢"} ${s.name}${s.tier ? ` · ${s.tier}` : ""}${s.rating ? ` · ${s.rating}%` : ""}`,
                  value: s.id,
                })),
                { label: "🔍 Search for a different supplier", value: "search_again" },
              ],
            }]);
          } else {
            push([{
              role: "bot",
              text: `Got it — **"${desc}"** ✓\n\nNo suppliers found for this item. Please search by supplier name or category:`,
              options: [{ label: "🔍 Search suppliers", value: "search_again" }],
            }]);
          }
          break;
        }

        // SUPPLIER_SEARCH — manual search
        case "SUPPLIER_SEARCH": {
          push([{ role: "status", text: "Searching…" }]);
          const d = await api("search_suppliers", { query: text });
          setMessages(p => p.filter(m => m.role !== "status"));
          const sups: Supplier[] = d.suppliers ?? [];
          setSuppliers(sups);

          if (sups.length > 0) {
            setStep("SUPPLIER_PICK");
            push([{
              role: "bot",
              text: `Found **${sups.length}** supplier${sups.length !== 1 ? "s" : ""}. **Select one** (mandatory):`,
              options: [
                ...sups.slice(0, 5).map(s => ({
                  label: `${s.preferred ? "⭐" : "🏢"} ${s.name}${s.tier ? ` · ${s.tier}` : ""}`,
                  value: s.id,
                })),
                { label: "🔍 Search again", value: "search_again" },
              ],
            }]);
          } else {
            push([{
              role: "bot",
              text: `No suppliers found for **"${text}"**.\n\nTry a different keyword (e.g. "IT Hardware", "Dell", "cloud"):`,
            }]);
          }
          break;
        }

        // QUANTITY
        case "QUANTITY": {
          const qty = parseInt(text.replace(/[^\d]/g, ""));
          if (isNaN(qty) || qty < 1) {
            push([{ role: "bot", text: "Please enter a valid quantity (e.g. **5**)." }]);
            break;
          }
          setCurrentItem(p => ({ ...p, quantity: qty }));
          setStep("PRICE");
          push([{ role: "bot", text: `**${qty} unit${qty !== 1 ? "s" : ""}** ✓\n\nWhat is the **unit price** in ₹?\n(enter numbers only, e.g. **125000**)` }]);
          break;
        }

        // PRICE
        case "PRICE": {
          const price = parseFloat(text.replace(/[,₹\s]/g, ""));
          if (isNaN(price) || price <= 0) {
            push([{ role: "bot", text: "Please enter a valid price in ₹ (e.g. **125000**)." }]);
            break;
          }
          setCurrentItem(p => ({ ...p, unit_price: price }));
          const lineTotal = (currentItem.quantity ?? 1) * price;
          setStep("GL_ACCOUNT");
          push([{
            role: "bot",
            text: `**${fmt(price)}/unit** ✓  →  Line total: **${fmt(lineTotal)}** (+GST = ${fmt(lineTotal * 1.18)})\n\n**Select the GL Account** (mandatory for accounting):`,
            options: GL_ACCOUNTS.map(g => ({
              label: `${g.code} — ${g.label}`,
              value: g.code,
            })),
          }]);
          break;
        }

        // DATE
        case "DATE": {
          let date: string | undefined;
          if (!skip) {
            if (text.toLowerCase() === "asap") {
              const d = new Date(); d.setDate(d.getDate() + 3);
              date = d.toISOString().split("T")[0];
            } else {
              const parts = text.split(/[\/\-\.]/);
              if (parts.length === 3) {
                const dd = parts[0].padStart(2,"0");
                const mm = parts[1].padStart(2,"0");
                const yy = parts[2].length === 2 ? "20"+parts[2] : parts[2];
                date = `${yy}-${mm}-${dd}`;
              }
            }
          }
          setReqData(d => ({ ...d, required_date: date }));
          setStep("JUSTIFY");
          push([{ role: "bot", text: "Almost there! 🎉\n\nWhat is the **business justification** for this purchase?\n(e.g. *\"Required for 10 new engineering hires joining Aug 15 for FinTech product launch\"*)" }]);
          break;
        }

        // JUSTIFY
        case "JUSTIFY": {
          const justification = skip ? "Standard business requirement" : text;
          const finalData = { ...reqData, justification };
          setReqData(finalData);
          setStep("CONFIRM");
          push([{
            role: "bot",
            text: "Here is the complete requisition — please review:",
            card: "summary",
            cardData: finalData as unknown as Record<string, unknown>,
            options: [
              { label: "✅ Submit for Approval", value: "confirm"  },
              { label: "✏️  Start over",          value: "restart" },
            ],
          }]);
          break;
        }

        // STATUS check
        case "STATUS": {
          push([{ role: "status", text: "Looking up requisition…" }]);
          const d = await api("get_status", { identifier: text });
          setMessages(p => p.filter(m => m.role !== "status"));
          if (d.error) {
            push([{ role: "bot", text: `❌ ${d.error}. Please check the number and try again.` }]);
          } else {
            const stepLines = (d.steps ?? []).map((s: { sequence: number; type: string; status: string; approver: string }) =>
              `${s.sequence}. ${s.type} — **${s.status}** (${s.approver})`
            ).join("\n");
            push([{
              role: "bot",
              text: `**${d.number}** — ${d.title}\n\n📊 Status: **${d.status}**\n💰 Total: **${fmt(Number(d.total))}**\n👤 Requestor: ${d.requestor}\n\n**Approval steps:**\n${stepLines}${d.po ? `\n\n📦 PO: **${d.po.poNumber}** (${d.po.status})` : ""}`,
            }]);
            setStep("WELCOME");
          }
          break;
        }

        default:
          push([{ role: "bot", text: "I didn't quite catch that. Please use the buttons above or type your response." }]);
      }
    } finally {
      setBusy(false);
    }
  }

  // ── API actions ───────────────────────────────────────────────────────────

  async function loadPending() {
    setBusy(true);
    push([{ role: "status", text: "Loading pending approvals…" }]);
    const d = await api("get_pending");
    setMessages(p => p.filter(m => m.role !== "status"));
    setBusy(false);
    const reqs = d.requisitions ?? [];
    if (!reqs.length) {
      push([{ role: "bot", text: "✅ No pending approvals right now — you're all caught up!" }]);
    } else {
      const lines = reqs.map((r: { number: string; title: string; status: string; total: number }) =>
        `• **${r.number}** — ${r.title}\n  ${r.status} · ${fmt(Number(r.total))}`
      ).join("\n\n");
      push([{ role: "bot", text: `You have **${reqs.length}** pending:\n\n${lines}` }]);
    }
    setStep("WELCOME");
  }

  async function doCreate() {
    setBusy(true);
    push([{ role: "status", text: "Creating requisition…" }]);
    const d = await api("create_requisition", {
      title:         reqData.title,
      category:      reqData.category,
      priority:      reqData.priority,
      department:    reqData.department,
      justification: reqData.justification,
      required_date: reqData.required_date,
      line_items:    reqData.line_items.map(l => ({
        description: l.description,
        quantity:    l.quantity,
        unit_price:  l.unit_price,
        supplier_id: l.supplier_id,
        gl_account:  l.gl_account,
      })),
    });
    setMessages(p => p.filter(m => m.role !== "status"));
    setBusy(false);
    if (d.success) {
      setCreatedReqId(d.id);
      setCreatedReqNum(d.requisition_number);
      setCreatedTotal(d.total);
      setStep("CREATED");
      push([{
        role: "bot",
        text: "",
        card: "created",
        cardData: { reqNum: d.requisition_number, total: d.total },
        options: [{ label: "✅ Approve Now", value: "approve" }],
      }]);
    } else {
      push([{ role: "bot", text: `❌ Failed: ${d.error || "Please try again."}` }]);
    }
  }

  async function doApprove() {
    setBusy(true);
    push([{ role: "status", text: "Processing approval…" }]);
    const d = await api("approve", {
      requisition_id: createdReqId,
      comment: "Approved via AI Procurement Assistant",
    });
    setMessages(p => p.filter(m => m.role !== "status"));
    setBusy(false);
    if (d.success) {
      setStep("APPROVED");
      push([{
        role: "bot",
        text: "",
        card: "approved",
        cardData: { reqNum: createdReqNum },
        options: [{ label: "📦 Create Purchase Order", value: "create_po" }],
      }]);
    } else {
      push([{ role: "bot", text: `❌ ${d.error}` }]);
    }
  }

  async function doCreatePO() {
    setBusy(true);
    push([{ role: "status", text: "Generating Purchase Order…" }]);
    const d = await api("create_po", {
      requisition_id:  createdReqId,
      payment_terms:   "Net 30",
      delivery_address: "Nexcore Technologies, Hyderabad",
    });
    setMessages(p => p.filter(m => m.role !== "status"));
    setBusy(false);
    if (d.success) {
      setStep("PO_DONE");
      push([{
        role: "bot",
        text: "",
        card: "po",
        cardData: { poNum: d.po_number, total: d.total, supplierEmail: d.supplier_email },
      }]);
    } else {
      push([{ role: "bot", text: `❌ ${d.error}` }]);
    }
  }

  function reset() {
    setStep("WELCOME");
    setReqData({ line_items: [] });
    setCurrentItem({});
    setCreatedReqId(""); setCreatedReqNum(""); setCreatedTotal(0);
    setMessages([{
      role: "bot",
      text: "Session reset. What would you like to do?",
      options: [
        { label: "🛒 Create a new purchase request", value: "new"     },
        { label: "✅ Check pending approvals",        value: "pending" },
        { label: "🔍 Check requisition status",       value: "status"  },
      ],
    }]);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1A2A52] to-[#2D5A9B] px-5 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Sparkles className="size-5 text-[#C8A04D]" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-white leading-tight">Aria · AI Procurement</p>
            <p className="text-[10px] text-white/60">Intake → Approval → Purchase Order</p>
          </div>
          <button onClick={reset} title="Reset" className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <RotateCcw className="size-4" />
          </button>
        </div>
        <FlowBar step={step} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "status" ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-1 pl-1">
                <Loader2 className="size-3.5 animate-spin text-[#1A2A52]" />
                <span>{msg.text}</span>
              </div>
            ) : msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-[#1A2A52] text-white text-xs px-4 py-2.5 rounded-2xl rounded-br-sm leading-relaxed shadow-sm">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5 items-end">
                <div className="size-7 rounded-xl bg-gradient-to-br from-[#1A2A52] to-[#2D5A9B] flex items-center justify-center shrink-0 mb-0.5 shadow-sm">
                  <Sparkles className="size-3.5 text-[#C8A04D]" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {msg.text && (
                    <div className="bg-white border border-gray-100 text-gray-800 text-xs px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm leading-relaxed">
                      {msg.text.split("\n").map((line, li) => (
                        <p key={li} className={li > 0 && !line ? "h-1.5" : li > 0 ? "mt-1" : ""}>
                          {bold(line)}
                        </p>
                      ))}
                    </div>
                  )}
                  {msg.card === "summary" && msg.cardData && (
                    <SummaryCard
                      data={msg.cardData as unknown as ReqData}
                      onConfirm={() => { push([{ role: "user", text: "Submit for Approval" }]); doCreate(); }}
                      onEdit={() => { push([{ role: "user", text: "Start over" }]); reset(); }}
                    />
                  )}
                  {msg.card === "created" && msg.cardData && (
                    <CreatedCard
                      reqNum={msg.cardData.reqNum as string}
                      total={msg.cardData.total as number}
                      onApprove={() => { push([{ role: "user", text: "Approve Now" }]); doApprove(); }}
                    />
                  )}
                  {msg.card === "approved" && msg.cardData && (
                    <ApprovedCard
                      reqNum={msg.cardData.reqNum as string}
                      onCreatePO={() => { push([{ role: "user", text: "Create Purchase Order" }]); doCreatePO(); }}
                    />
                  )}
                  {msg.card === "po" && msg.cardData && (
                    <POCard
                      poNum={msg.cardData.poNum as string}
                      total={msg.cardData.total as number}
                      supplierEmail={msg.cardData.supplierEmail as string | null}
                    />
                  )}
                  {msg.options && msg.options.length > 0 && (
                    <div className="space-y-1.5 pl-0.5">
                      {msg.options.map((opt, oi) => (
                        <button key={oi}
                          onClick={() => !busy && handleOption(opt.value, opt.label)}
                          disabled={busy}
                          className="flex items-center gap-2 text-left w-full text-xs font-medium bg-white border border-gray-200 hover:border-[#1A2A52] hover:bg-[#1A2A52]/5 text-gray-700 hover:text-[#1A2A52] px-3 py-2.5 rounded-xl transition-all disabled:opacity-50 shadow-sm">
                          <ArrowRight className="size-3 text-[#C8A04D] shrink-0" />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex gap-2.5 items-end">
            <div className="size-7 rounded-xl bg-[#1A2A52] flex items-center justify-center shrink-0 mb-0.5">
              <Sparkles className="size-3.5 text-[#C8A04D]" />
            </div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1">
                {[0,150,300].map(d => (
                  <div key={d} className="size-1.5 bg-[#1A2A52] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0 bg-white">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-[#1A2A52] focus-within:ring-1 focus-within:ring-[#1A2A52]/15 transition-all">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !busy) { e.preventDefault(); handleSend(); } }}
            placeholder={
              step === "WHAT"           ? "Describe the item you need…" :
              step === "SUPPLIER_SEARCH" ? "Search by supplier name or category…" :
              step === "QUANTITY"        ? "Enter quantity (e.g. 5)…" :
              step === "PRICE"           ? "Enter unit price in ₹ (e.g. 125000)…" :
              step === "DATE"            ? "DD/MM/YYYY  or  asap  or  skip…" :
              step === "JUSTIFY"         ? "Why is this purchase needed?" :
              step === "STATUS"          ? "Enter requisition number e.g. REQ-000001…" :
              "Type here or use the buttons above…"
            }
            disabled={busy}
            className="flex-1 text-xs bg-transparent outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-40"
          />
          <button onClick={handleSend} disabled={!input.trim() || busy}
            className="size-8 bg-[#1A2A52] rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-[#243766] transition-colors shrink-0">
            {busy
              ? <Loader2 className="size-3.5 text-white animate-spin" />
              : <Send className="size-3.5 text-white" />
            }
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">Enter to send · Click buttons for quick actions</p>
      </div>
    </div>
  );
}
