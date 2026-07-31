"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send, Loader2, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import type { ExtractedRequirement } from "@/lib/ai/nlu";
import type { IntakeDecision } from "@/lib/ai/intake-decision";

type Msg = { role: "agent" | "user" | "success" | "error" | "loading"; text: string; options?: string[] };

type Step = "WELCOME" | "CATEGORY_PICK" | "REVIEW" | "GAP_FILL" | "CONFIRM";

type GapField = "quantity" | "unitPrice" | "deliveryLocation" | "requiredDate" | "businessJustification";
const GAP_QUESTIONS: Record<GapField, string> = {
  quantity: "How many do you need?",
  unitPrice: "Do you know the expected **unit price**? (type 'skip' if not yet known — pricing can be finalized on the PO)",
  deliveryLocation: "Where should this be delivered?",
  requiredDate: "When do you need this by? (e.g. 'next month', 'ASAP', a date)",
  businessJustification: "One line on why this is needed? (type 'skip' to skip)",
};

type Draft = {
  title: string; category: string | null; quantity: number | null; unitPrice: number | null;
  deliveryLocation: string | null; requiredDate: string | null; priority: string;
  businessJustification: string | null; supplierId?: string; supplierName?: string;
};

function bold(text: string) {
  return String(text ?? "").split("\n").map((line, i) => {
    const parts = line.split(/\*\*([^*]+)\*\*/g);
    return <p key={i} className={i > 0 ? "mt-0.5" : ""}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : <span key={j}>{p}</span>)}</p>;
  });
}

const WELCOME_MSG: Msg = {
  role: "agent",
  text: "👋 Hi, I'm **Aria**. Tell me what you need in plain English — I'll figure out the category, check our catalog and supplier directory, and get it ready for approval.\n\nFor example: *\"I need 500 laptops delivered to Singapore before next month\"*",
};

export function IntakeAgent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("WELCOME");
  const [messages, setMessages] = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [decision, setDecision] = useState<IntakeDecision | null>(null);
  const [confidence, setConfidence] = useState<"llm" | "heuristic" | null>(null);
  const [gapQueue, setGapQueue] = useState<GapField[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open]);

  const push = useCallback((...msgs: Msg[]) => setMessages(p => [...p, ...msgs]), []);

  async function api<T = Record<string, unknown>>(url: string, method = "GET", body?: unknown): Promise<{ ok: boolean; data: T }> {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    return { ok: res.ok, data };
  }

  function computeGaps(d: Draft): GapField[] {
    const gaps: GapField[] = [];
    if (!d.quantity) gaps.push("quantity");
    if (!d.unitPrice && !d.supplierId) gaps.push("unitPrice");
    if (!d.deliveryLocation) gaps.push("deliveryLocation");
    if (!d.requiredDate) gaps.push("requiredDate");
    if (!d.businessJustification) gaps.push("businessJustification");
    return gaps;
  }

  // currentDraft is threaded through explicitly rather than read from `draft` state,
  // since this is often called synchronously right after setDraft() — state updates
  // are async, so reading `draft` here could see the pre-update value.
  function askNextGap(queue: GapField[], currentDraft: Draft) {
    if (queue.length === 0) { showConfirmWith(currentDraft); return; }
    push({ role: "agent", text: `**${GAP_QUESTIONS[queue[0]]}**` });
    setStep("GAP_FILL");
  }

  function presentDecision(baseDraft: Draft, dec: IntakeDecision, confidenceNote: string) {
    setDecision(dec);
    const newDraft: Draft = {
      ...baseDraft,
      unitPrice: dec.catalogMatch?.unitPrice ?? baseDraft.unitPrice,
      supplierId: dec.catalogMatch ? undefined : dec.supplierMatches[0]?.id,
      supplierName: dec.catalogMatch?.supplierName ?? dec.supplierMatches[0]?.name,
    };
    setDraft(newDraft);

    const lines: string[] = [`**Category:** ${newDraft.category}${confidenceNote}`];
    if (dec.catalogMatch) {
      lines.push(`\n\n✅ **Found in your catalog:** ${dec.catalogMatch.itemName} (${dec.catalogMatch.sku}) — ${dec.catalogMatch.currency} ${dec.catalogMatch.unitPrice} from ${dec.catalogMatch.supplierName ?? "an existing supplier"}. I can buy this directly, no sourcing needed.`);
    } else if (dec.supplierMatches.length > 0) {
      lines.push(`\n\n✅ **Found ${dec.supplierMatches.length} existing supplier(s)** for this category: ${dec.supplierMatches.map(s => s.name).join(", ")}. I'll route this to ${dec.supplierMatches[0].name}.`);
    } else if (dec.needsSourcing) {
      lines.push(`\n\n⚠️ **No existing catalog item or supplier found** for this category. I'll submit the requisition, but procurement will need to onboard a supplier before it can be ordered.`);
    }

    push({ role: "agent", text: lines.join(""), options: dec.needsSourcing ? ["🏢 Onboard a supplier now", "➡️ Continue anyway"] : undefined });
    setStep("REVIEW");
    if (!dec.needsSourcing) {
      const gaps = computeGaps(newDraft);
      setGapQueue(gaps);
      askNextGap(gaps, newDraft);
    }
  }

  async function handleUnderstand(text: string) {
    push({ role: "user", text });
    push({ role: "loading", text: "Understanding your request…" });
    setBusy(true);
    const { ok, data } = await api<{ extracted: ExtractedRequirement; decision: IntakeDecision | null; categories: string[]; error?: string }>("/api/intake/understand", "POST", { text });
    setMessages(p => p.filter(m => m.role !== "loading"));
    setBusy(false);
    if (!ok) { push({ role: "error", text: data.error || "Couldn't understand that — try rephrasing." }); return; }

    const { extracted, decision: dec } = data;
    setConfidence(extracted.confidence);
    setCategories(data.categories ?? []);
    const confidenceNote = extracted.confidence === "heuristic" ? " _(keyword-based, no LLM connected — please double check)_" : "";

    const newDraft: Draft = {
      title: extracted.title, category: extracted.category, quantity: extracted.quantity,
      unitPrice: null, deliveryLocation: extracted.deliveryLocation,
      requiredDate: extracted.requiredDate, priority: extracted.priority,
      businessJustification: extracted.businessJustification,
    };
    setDraft(newDraft);

    if (!extracted.category || !dec) {
      const cats = data.categories ?? [];
      push({
        role: "agent",
        text: cats.length > 0
          ? `I couldn't confidently tell what category this falls under${confidenceNote}. Pick one below, or just type it.`
          : `I couldn't confidently tell what category this falls under${confidenceNote}. What category is it? (e.g. IT Hardware, Office Supplies)`,
        options: cats.length > 0 ? cats.map((c, i) => `${i + 1}. ${c}`) : undefined,
      });
      setStep("CATEGORY_PICK");
      return;
    }

    presentDecision(newDraft, dec, confidenceNote);
  }

  async function handleCategoryPick(text: string) {
    // Two distinct "this is an index, not free text" signals: a button click sends
    // "N. Label" (bulletMatch); a manually-typed bare number is index selection too.
    // Anything else — including text that merely starts with a digit, e.g. "5G
    // Equipment" — is free text.
    const bulletMatch = text.match(/^(\d+)\.\s/);
    const pureNumber = /^\d+$/.test(text.trim());
    const isIndexSelection = categories.length > 0 && (!!bulletMatch || pureNumber);
    const idx = bulletMatch ? parseInt(bulletMatch[1]) : pureNumber ? parseInt(text.trim()) : NaN;
    const matched = isIndexSelection ? categories[idx - 1] : categories.find(c => c.toLowerCase().includes(text.toLowerCase()));

    if (isIndexSelection && !matched) {
      push({ role: "agent", text: `Please pick 1–${categories.length}, or just type the category name.`, options: categories.length > 0 ? categories.map((c, i) => `${i + 1}. ${c}`) : undefined });
      return;
    }
    // Free-text fallback: if it doesn't match a known category (or none are configured
    // for this org yet), accept whatever the user typed as a custom category rather
    // than blocking them — the alternative is an unrecoverable dead end.
    const category = matched ?? text.trim();
    if (!category) { push({ role: "agent", text: "What category is this?" }); return; }
    if (!draft) return;

    push({ role: "user", text: category });
    const updatedDraft: Draft = { ...draft, category, title: draft.title || category };
    setDraft(updatedDraft);

    push({ role: "loading", text: "Checking catalog and suppliers…" });
    setBusy(true);
    const { ok, data } = await api<{ decision: IntakeDecision; error?: string }>("/api/intake/decision", "POST", { category, quantity: draft.quantity });
    setMessages(p => p.filter(m => m.role !== "loading"));
    setBusy(false);
    if (!ok) { push({ role: "error", text: data.error || "Something went wrong." }); return; }

    presentDecision(updatedDraft, data.decision, "");
  }

  function handleGapAnswer(text: string) {
    const field = gapQueue[0];
    if (!field || !draft) return;
    const skip = text.toLowerCase() === "skip";
    push({ role: "user", text });

    const updated: Draft = { ...draft };
    if (field === "quantity") updated.quantity = skip ? null : parseInt(text.replace(/\D/g, "")) || null;
    if (field === "unitPrice") updated.unitPrice = skip ? null : parseFloat(text.replace(/[^\d.]/g, "")) || null;
    if (field === "deliveryLocation") updated.deliveryLocation = skip ? null : text;
    if (field === "requiredDate") updated.requiredDate = skip ? null : text;
    if (field === "businessJustification") updated.businessJustification = skip ? null : text;
    setDraft(updated);

    const rest = gapQueue.slice(1);
    setGapQueue(rest);
    askNextGap(rest, updated);
  }

  function showConfirmWith(d: Draft) {
    setStep("CONFIRM");
    const amount = d.unitPrice && d.quantity ? (d.unitPrice * d.quantity).toLocaleString() : "TBD";
    push({
      role: "agent",
      text: `📋 **Ready to submit:**\n\n**${d.title}**\nCategory: ${d.category ?? "—"} · Qty: ${d.quantity ?? "—"} · Est. amount: ${amount}\nDelivery: ${d.deliveryLocation ?? "—"} · Needed: ${d.requiredDate ?? "—"} · Priority: ${d.priority}${d.supplierName ? `\nSupplier: ${d.supplierName}` : ""}${d.businessJustification ? `\nJustification: ${d.businessJustification}` : ""}\n\nShall I submit this for approval?`,
      options: ["✅ Submit for approval", "❌ Start over"],
    });
  }

  async function handleSubmitRequisition() {
    if (!draft) return;
    push({ role: "loading", text: "Submitting requisition…" });
    setBusy(true);
    const { ok, data } = await api<{ requisition?: { id: string; requisitionNumber: string; approvalSteps: { stepLabel: string | null; stepType: string }[] }; warning?: string | null; error?: string }>(
      "/api/intake/submit", "POST",
      {
        title: draft.title, category: draft.category || "Uncategorized", priority: draft.priority,
        deliveryLocation: draft.deliveryLocation, requiredDate: draft.requiredDate,
        businessJustification: draft.businessJustification, intakeSource: "CHATBOT",
        quantity: draft.quantity ?? 1, unitPrice: draft.unitPrice ?? 0, supplierName: draft.supplierName,
      }
    );
    setMessages(p => p.filter(m => m.role !== "loading"));
    setBusy(false);
    if (!ok || !data.requisition) { push({ role: "error", text: data.error || "Failed to submit. Please try again." }); return; }

    const steps = data.requisition.approvalSteps ?? [];
    push({
      role: "success",
      text: `🎉 **Submitted!**\n\nRequisition **${data.requisition.requisitionNumber}** is on its way.${steps.length ? `\n\nApproval path: ${steps.map(s => s.stepLabel ?? s.stepType).join(" → ")}` : "\n\nNo approval required — auto-approved."}${data.warning ? `\n\n⚠️ ${data.warning}` : ""}`,
      options: ["📄 View requisition", "➕ Submit another"],
    });
    setStep("WELCOME");
    setDraft(null);
    setGapQueue([]);
    (window as unknown as { __lastReqId?: string }).__lastReqId = data.requisition.id;
  }

  function handleOption(opt: string) {
    if (opt.includes("Onboard a supplier")) {
      push({ role: "user", text: opt });
      window.dispatchEvent(new Event("veltriance:onboard-supplier"));
      push({ role: "agent", text: "Opened the Supplier Assistant — once onboarded, come back and I'll route this request to them." });
      return;
    }
    if (opt.includes("Continue anyway")) {
      push({ role: "user", text: opt });
      if (!draft) return;
      const gaps = computeGaps(draft);
      setGapQueue(gaps);
      askNextGap(gaps, draft);
      return;
    }
    if (opt.includes("Submit for approval")) { push({ role: "user", text: opt }); handleSubmitRequisition(); return; }
    if (opt.includes("Start over")) {
      push({ role: "user", text: opt });
      setDraft(null); setGapQueue([]); setStep("WELCOME");
      push({ role: "agent", text: "No problem — tell me again what you need." });
      return;
    }
    if (opt.includes("View requisition")) {
      const id = (window as unknown as { __lastReqId?: string }).__lastReqId;
      if (id) router.push(`/dashboard/requisitions/${id}`);
      return;
    }
    if (opt.includes("Submit another")) {
      push({ role: "user", text: opt });
      push({ role: "agent", text: "What do you need?" });
      return;
    }

    // Fallback — e.g. numbered category options during CATEGORY_PICK.
    handleSend(opt);
  }

  async function handleSend(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    if (step === "WELCOME") { await handleUnderstand(text); return; }
    if (step === "CATEGORY_PICK") { await handleCategoryPick(text); return; }
    if (step === "GAP_FILL") { handleGapAnswer(text); return; }
    if (step === "CONFIRM") {
      push({ role: "user", text });
      if (text.toLowerCase().includes("yes") || text.toLowerCase().includes("submit")) await handleSubmitRequisition();
      else { setDraft(null); setStep("WELCOME"); push({ role: "agent", text: "Cancelled. What do you need?" }); }
      return;
    }
    if (step === "REVIEW") { push({ role: "user", text }); return; }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden" style={{ height: "min(680px, 90vh)" }}>
        <div className="bg-gradient-to-r from-[#1A2A52] to-[#2D5A9B] px-5 py-4 flex items-center gap-3 shrink-0">
          <div className="size-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Sparkles className="size-4 text-white" /></div>
          <div className="flex-1"><p className="text-sm font-bold text-white">Aria</p><p className="text-[10px] text-white/60">Conversational procurement intake</p></div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="size-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 bg-gray-50/40">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "loading" ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-1 pl-1"><Loader2 className="size-3.5 animate-spin shrink-0 text-[#1A2A52]" /><span>{msg.text}</span></div>
              ) : msg.role === "user" ? (
                <div className="flex justify-end"><div className="max-w-[80%] bg-[#1A2A52] text-white text-xs px-4 py-2.5 rounded-2xl rounded-br-sm leading-relaxed shadow-sm">{msg.text}</div></div>
              ) : (
                <div className="flex gap-2.5 items-end">
                  <div className={`size-7 rounded-full flex items-center justify-center shrink-0 mb-0.5 shadow-sm ${msg.role === "success" ? "bg-emerald-500" : msg.role === "error" ? "bg-red-500" : "bg-[#1A2A52]"}`}>
                    {msg.role === "success" ? <CheckCircle2 className="size-4 text-white" /> : msg.role === "error" ? <AlertCircle className="size-4 text-white" /> : <Sparkles className="size-3.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className={`text-xs leading-relaxed px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm whitespace-pre-wrap ${msg.role === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-900" : msg.role === "error" ? "bg-red-50 border border-red-200 text-red-800" : "bg-white border border-gray-100 text-gray-800"}`}>
                      {bold(msg.text)}
                    </div>
                    {msg.options && msg.options.length > 0 && (
                      <div className="space-y-1.5 pl-0.5">
                        {msg.options.map((opt, oi) => (
                          <button key={oi} onClick={() => !busy && handleOption(opt)} disabled={busy}
                            className="flex items-center gap-2 text-left w-full text-xs font-medium bg-white border border-gray-200 hover:border-[#1A2A52] hover:bg-[#1A2A52]/5 text-gray-700 hover:text-[#1A2A52] px-3 py-2 rounded-xl transition-all duration-150 disabled:opacity-50 shadow-sm">
                            <ChevronRight className="size-3 text-[#C8A04D] shrink-0" /><span>{opt}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t border-gray-100 shrink-0 bg-white">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-[#1A2A52] focus-within:ring-1 focus-within:ring-[#1A2A52]/15 transition-all">
            <input
              ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !busy) { e.preventDefault(); handleSend(); } }}
              placeholder={step === "WELCOME" ? "I need..." : "Type your response…"}
              disabled={busy}
              className="flex-1 text-xs bg-transparent outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-40"
            />
            <button onClick={() => handleSend()} disabled={!input.trim() || busy} className="size-7 bg-[#1A2A52] rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-[#243766] transition-colors shrink-0">
              {busy ? <Loader2 className="size-3 text-white animate-spin" /> : <Send className="size-3 text-white" />}
            </button>
          </div>
          {confidence === "heuristic" && step !== "WELCOME" && <p className="text-[9px] text-amber-500 mt-1 text-center">No LLM connected — using keyword extraction. Set ANTHROPIC_API_KEY for real understanding.</p>}
        </div>
      </div>
    </div>
  );
}
