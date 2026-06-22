"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { EMPTY_INTAKE_STATE, type IntakeState, type RequiredSlot } from "@/lib/intake-agent";

type Message = { role: "assistant" | "user"; content: string };

export default function IntakeChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! Tell me what you need — for example, \"I need 20 laptops for new employees.\"" },
  ]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<IntakeState>(EMPTY_INTAKE_STATE);
  const [pendingSlot, setPendingSlot] = useState<RequiredSlot | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading || done) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/intake/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, state, pendingSlot }),
    });
    const data = await res.json();
    setState(data.state);
    setPendingSlot(data.pendingSlot);
    setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    setDone(data.done);
    setLoading(false);
  }

  async function handleCreateDraft() {
    setSubmitting(true);
    const res = await fetch("/api/intake/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: state.itemDescription ?? "New request",
        category: state.category,
        quantity: state.quantity ?? 1,
        unitPrice: 0,
        supplierName: state.supplier,
        deliveryLocation: state.deliveryLocation,
        costCenter: state.costCenter,
        requiredDate: state.requiredDate,
        intakeSource: "CHATBOT",
      }),
    });
    setSubmitting(false);
    if (!res.ok) return;
    const { requisition } = await res.json();
    router.push(`/dashboard/requisitions/${requisition.id}`);
  }

  return (
    <div className="p-8 max-w-2xl flex flex-col h-[calc(100vh-2rem)]">
      <Link href="/dashboard/intake" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="size-3.5" /> Back
      </Link>

      <div className="flex items-center gap-2 mb-4">
        <div className="size-7 rounded-full bg-[#1A2A52]/10 flex items-center justify-center">
          <Sparkles className="size-3.5 text-[#1A2A52]" />
        </div>
        <h1 className="font-medium text-gray-900">Intake Assistant</h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user" ? "bg-[#1A2A52] text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {done && (
          <div className="border border-[#C8A04D]/30 bg-[#C8A04D]/5 rounded-xl p-4 mt-2">
            <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Request summary</p>
            <dl className="text-sm space-y-1 text-gray-700">
              <Row label="Item" value={state.itemDescription} />
              <Row label="Category" value={state.category} />
              <Row label="Quantity" value={state.quantity?.toString()} />
              <Row label="Supplier" value={state.supplier} />
              <Row label="Delivery location" value={state.deliveryLocation} />
              <Row label="Cost center" value={state.costCenter} />
              <Row label="Required by" value={state.requiredDate} />
            </dl>
            <button
              onClick={handleCreateDraft}
              disabled={submitting}
              className="mt-4 w-full bg-[#1A2A52] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#243766] transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create requisition draft"}
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!done && (
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 mt-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52] focus:ring-1 focus:ring-[#1A2A52]"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1A2A52] text-white disabled:opacity-40 transition-opacity"
          >
            <Send className="size-4" />
          </button>
        </form>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-right">{value || "—"}</dd>
    </div>
  );
}
