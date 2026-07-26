"use client";
import { useState, useRef, useEffect } from "react";
import { Building2, Send, Loader2, RotateCcw, ChevronRight, CheckCircle2, X } from "lucide-react";

type Step = "WELCOME"|"NAME"|"CATEGORY"|"EMAIL"|"PHONE"|"CONTACT"|"CITY"|"PAYMENT"|"JUSTIFICATION"|"CONFIRM"|"DONE";
type FormData = { name?:string; category?:string; contactEmail?:string; contactPhone?:string; contactName?:string; city?:string; country?:string; paymentTerms?:string; businessJustification?:string; };
type Msg = { role:"bot"|"user"|"status"; text:string; options?:{label:string;value:string}[]; };

const CATEGORIES=["IT Hardware","Software & Licenses","Cloud Services","Consulting","Facilities & Infra","Office Supplies","Marketing","Training","Telecom","Networking","Logistics","Manufacturing"];
const PAYMENT_TERMS=["Net 15","Net 30","Net 45","Net 60","Advance 50%","Advance 100%"];
const CITIES=["Bengaluru","Mumbai","Delhi / NCR","Hyderabad","Chennai","Pune","Kolkata","Ahmedabad","Noida","Gurugram"];

export default function SupplierOnboardingBot({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState<Step>("WELCOME");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({});
  const [createdCode, setCreatedCode] = useState<string|null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const addMsg = (role: Msg["role"], text: string, options?: Msg["options"]) =>
    setMsgs(m => [...m, { role, text, options }]);

  useEffect(() => {
    addMsg("bot", "👋 Welcome to **Supplier Onboarding**!\n\nI'll help register your company as an approved vendor for Ace Technologies. This takes about 2 minutes.\n\nLet's start — what is your company's full legal name?");
    setStep("NAME");
  }, []);

  function restart() {
    setStep("WELCOME"); setFormData({}); setMsgs([]); setCreatedCode(null);
    setTimeout(() => {
      addMsg("bot", "Let's start again! What is your company's full legal name?");
      setStep("NAME");
    }, 100);
  }

  async function handleOption(value: string, label: string) {
    addMsg("user", label);
    await advance(value, label);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput(""); addMsg("user", text);
    await advance(text, text);
  }

  async function advance(value: string, label: string) {
    switch (step) {
      case "NAME": {
        if (value.length < 3) { addMsg("bot", "Please enter the full legal company name (at least 3 characters):"); return; }
        setFormData(d => ({ ...d, name: value }));
        addMsg("bot", `Great! **${value}**\n\nWhat category of products or services does your company provide?`, CATEGORIES.map(c => ({ label: c, value: c })));
        setStep("CATEGORY"); break;
      }
      case "CATEGORY": {
        setFormData(d => ({ ...d, category: value }));
        addMsg("bot", "What is the primary business contact email address?");
        setStep("EMAIL"); break;
      }
      case "EMAIL": {
        if (!value.includes("@") || !value.includes(".")) { addMsg("bot", "Please enter a valid email address (e.g. procurement@company.com):"); return; }
        setFormData(d => ({ ...d, contactEmail: value }));
        addMsg("bot", "What is the contact phone number? (with country code)");
        setStep("PHONE"); break;
      }
      case "PHONE": {
        setFormData(d => ({ ...d, contactPhone: value }));
        addMsg("bot", "What is the name of the primary contact person?");
        setStep("CONTACT"); break;
      }
      case "CONTACT": {
        setFormData(d => ({ ...d, contactName: value }));
        addMsg("bot", "Which city is your company headquartered in?", [
          ...CITIES.map(c => ({ label: c, value: c })),
          { label: "Other — I'll type", value: "custom" },
        ]);
        setStep("CITY"); break;
      }
      case "CITY": {
        if (value === "custom") { addMsg("bot", "Type your city name:"); return; }
        setFormData(d => ({ ...d, city: value, country: "India" }));
        addMsg("bot", "What are your preferred payment terms?", PAYMENT_TERMS.map(p => ({ label: p, value: p })));
        setStep("PAYMENT"); break;
      }
      case "PAYMENT": {
        setFormData(d => ({ ...d, paymentTerms: value }));
        addMsg("bot", "Why do you want to become a vendor for Ace Technologies? (A brief description of your value proposition)", [
          { label: "Competitive pricing & quality products", value: "Competitive pricing, quality products, and reliable delivery." },
          { label: "Specialized expertise in our category", value: "Specialized expertise and proven track record in the domain." },
          { label: "Strong after-sales support", value: "Comprehensive after-sales support, warranties, and SLAs." },
          { label: "✏️ I'll write my own", value: "custom" },
        ]);
        setStep("JUSTIFICATION"); break;
      }
      case "JUSTIFICATION": {
        if (value === "custom") { addMsg("bot", "Describe your value proposition:"); return; }
        const fd = { ...formData, businessJustification: value };
        setFormData(fd);
        addMsg("bot",
          `📋 **Onboarding Summary**\n\n` +
          `Company: ${fd.name}\nCategory: ${fd.category}\nCity: ${fd.city}, India\n` +
          `Contact: ${fd.contactName}\nEmail: ${fd.contactEmail}\nPhone: ${fd.contactPhone}\n` +
          `Payment Terms: ${fd.paymentTerms}\n\nValue Proposition: ${fd.businessJustification}\n\nSubmit this registration?`,
          [{ label: "✅ Submit Registration", value: "submit" }, { label: "↩ Start Over", value: "restart" }]
        );
        setStep("CONFIRM"); break;
      }
      case "CONFIRM": {
        if (value === "restart") { restart(); return; }
        await submitOnboarding();
        break;
      }
    }
  }

  async function submitOnboarding() {
    setLoading(true);
    addMsg("status", "Registering your company...");
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Registration failed");
      const code = d.supplier?.code ?? "SUP-NEW";
      setCreatedCode(code);
      addMsg("bot",
        `🎉 **Registration submitted successfully!**\n\nYour vendor code: **${code}**\n\n` +
        `Your application is now pending review by the Ace Technologies procurement team.\n\n` +
        `You will receive a confirmation email at **${formData.contactEmail}** once reviewed (typically within 2-3 business days).`,
        [{ label: "📧 Register Another", value: "new" }]
      );
      setStep("DONE");
    } catch (e: any) {
      addMsg("bot", `❌ Registration failed: ${e.message}`,
        [{ label: "🔄 Try Again", value: "submit" }, { label: "↩ Start Over", value: "restart" }]
      );
      setStep("CONFIRM");
    }
    setLoading(false);
  }

  const BUTTON_STEPS: Step[] = ["CATEGORY","PAYMENT","CITY","JUSTIFICATION","CONFIRM","DONE"];
  const showInput = !BUTTON_STEPS.includes(step);
  const PROG = [
    { l: "Company", s: ["NAME","CATEGORY"] as Step[] },
    { l: "Contact", s: ["EMAIL","PHONE","CONTACT"] as Step[] },
    { l: "Details", s: ["CITY","PAYMENT"] as Step[] },
    { l: "Submit", s: ["JUSTIFICATION","CONFIRM","DONE"] as Step[] },
  ];
  const pg = PROG.findIndex(g => (g.s as Step[]).includes(step));

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-[#1A2A52] to-[#2D5A9B] px-5 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/15 flex items-center justify-center"><Building2 className="size-5 text-[#C8A04D]"/></div>
            <div><p className="text-sm font-bold text-white">Supplier Onboarding</p><p className="text-[10px] text-white/60">Register as an approved vendor</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={restart} className="size-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20"><RotateCcw className="size-3.5 text-white"/></button>
            {onClose && <button onClick={onClose} className="size-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20"><X className="size-3.5 text-white"/></button>}
          </div>
        </div>
        {step !== "WELCOME" && (
          <div className="flex items-center gap-1 mt-3">
            {PROG.map((g, i) => (
              <div key={g.l} className="flex items-center gap-1 flex-1">
                <div className="flex-1">
                  <div className={`h-1 rounded-full ${i <= pg ? "bg-[#C8A04D]" : "bg-white/20"}`}/>
                  <p className={`text-[8px] mt-0.5 text-center ${i <= pg ? "text-white/80" : "text-white/30"}`}>{g.l}</p>
                </div>
                {i < PROG.length - 1 && <ChevronRight className="size-2.5 text-white/20 shrink-0 mb-3"/>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {msgs.map((m, i) => (
          <div key={i}>
            {m.role === "status" ? (
              <div className="flex justify-center"><span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full flex items-center gap-1.5"><Loader2 className="size-2.5 animate-spin"/>{m.text}</span></div>
            ) : m.role === "user" ? (
              <div className="flex justify-end"><div className="max-w-[78%] bg-[#1A2A52] text-white text-xs px-4 py-2.5 rounded-2xl rounded-br-sm leading-relaxed">{m.text}</div></div>
            ) : (
              <div className="flex gap-2.5">
                <div className="size-7 rounded-xl bg-[#1A2A52] flex items-center justify-center shrink-0 mt-0.5"><Building2 className="size-3.5 text-[#C8A04D]"/></div>
                <div className="flex-1 min-w-0">
                  <div className="bg-white border border-gray-100 text-gray-800 text-xs px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm leading-relaxed">
                    {m.text.split("\n").map((line, j) => <p key={j} className={j > 0 ? (line ? "mt-1" : "h-1") : ""}>{line}</p>)}
                  </div>
                  {m.options && m.options.length > 0 && i === msgs.length - 1 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.options.map(opt => (
                        <button key={opt.value} onClick={() => handleOption(opt.value, opt.label)}
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
            <div className="size-7 rounded-xl bg-[#1A2A52] flex items-center justify-center shrink-0"><Building2 className="size-3.5 text-[#C8A04D]"/></div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl shadow-sm"><div className="flex gap-1">{[0,150,300].map(d => <div key={d} className="size-1.5 bg-[#1A2A52] rounded-full animate-bounce" style={{animationDelay:`${d}ms`}}/>)}</div></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {showInput && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-[#1A2A52] focus-within:bg-white transition-colors">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !loading) { e.preventDefault(); handleSend(); } }}
              placeholder={step === "NAME" ? "Enter full company legal name..." : step === "EMAIL" ? "e.g. procurement@company.com..." : step === "PHONE" ? "e.g. +91 98765 43210..." : step === "CONTACT" ? "e.g. Rajesh Kumar..." : "Type your answer..."}
              disabled={loading}
              className="flex-1 text-xs bg-transparent outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-40"/>
            <button onClick={handleSend} disabled={!input.trim() || loading}
              className="size-7 bg-[#1A2A52] rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-[#243766] transition-colors">
              {loading ? <Loader2 className="size-3 text-white animate-spin"/> : <Send className="size-3 text-white"/>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
