"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Building2, X, Send, Loader2, CheckCircle2,
  AlertCircle, ChevronRight,
} from "lucide-react";

type Msg = {
  role: "agent" | "user" | "success" | "error" | "loading";
  text: string;
  options?: string[];
};

type Step =
  | "MENU"
  | "ADD_NAME" | "ADD_CATEGORY" | "ADD_CONTACT" | "ADD_EMAIL"
  | "ADD_PHONE" | "ADD_CITY" | "ADD_JUSTIFICATION" | "ADD_CONFIRM"
  | "PROFILE_LEGAL" | "PROFILE_TYPE" | "PROFILE_PAN" | "PROFILE_GST" | "PROFILE_MSME"
  | "BANK_BENEFICIARY" | "BANK_NAME" | "BANK_ACCOUNT" | "BANK_IFSC" | "BANK_TYPE"
  | "COMPLIANCE"
  | "DOCS_SEARCH" | "DOCS_TYPE"
  | "SEARCH" | "ADVANCE";

type Data = {
  name?: string; category?: string; contactName?: string; contactEmail?: string;
  contactPhone?: string; city?: string; businessJustification?: string;
  legalName?: string; businessType?: string; panNumber?: string;
  gstNumber?: string; msmeNumber?: string; beneficiaryName?: string;
  bankName?: string; accountNumber?: string; ifscCode?: string; accountType?: string;
  womenOwned?: boolean; minorityOwned?: boolean; smallBusiness?: boolean;
  supplierId?: string; supplierName?: string; docSupplierId?: string; docSupplierName?: string;
};

const CATS = [
  "IT Hardware","Software & Licenses","Cloud Services","Consulting Services",
  "Office Supplies","Facilities","Logistics","Marketing","Professional Services","Other",
];
const BIZ_TYPES = ["Private Limited","LLP","Partnership","Proprietorship","Public Limited"];
const DOC_TYPES: Record<string, string> = {
  PAN_CARD:"PAN Card", GST_CERTIFICATE:"GST Certificate",
  INCORPORATION_CERTIFICATE:"Certificate of Incorporation",
  MSME_CERTIFICATE:"MSME Certificate", CANCELLED_CHEQUE:"Cancelled Cheque",
  BANK_STATEMENT:"Bank Statement", ISO_CERTIFICATE:"ISO Certificate",
  NDA:"NDA", MSA:"MSA", OTHER:"Other",
};
const STAGE_LABELS: Record<string, string> = {
  REGISTRATION:"Registration", VALIDATION:"Validation",
  RISK_ASSESSMENT:"Risk Assessment", COMPLIANCE_REVIEW:"Compliance Review",
  PROCUREMENT_APPROVAL:"Procurement Approval", ACTIVE:"Active",
};
const STAGE_ORDER = ["REGISTRATION","VALIDATION","RISK_ASSESSMENT","COMPLIANCE_REVIEW","PROCUREMENT_APPROVAL","ACTIVE"];

const PROGRESS: Partial<Record<Step, number>> = {
  MENU:0, ADD_NAME:8, ADD_CATEGORY:15, ADD_CONTACT:20, ADD_EMAIL:25,
  ADD_PHONE:28, ADD_CITY:32, ADD_JUSTIFICATION:36, ADD_CONFIRM:40,
  PROFILE_LEGAL:50, PROFILE_TYPE:54, PROFILE_PAN:58, PROFILE_GST:62, PROFILE_MSME:66,
  BANK_BENEFICIARY:72, BANK_NAME:76, BANK_ACCOUNT:80, BANK_IFSC:84, BANK_TYPE:88,
  COMPLIANCE:93, DOCS_SEARCH:96, DOCS_TYPE:98,
};

function bold(text: string) {
  return String(text ?? "").split("\n").map((line, i) => {
    const parts = line.split(/\*\*([^*]+)\*\*/g);
    return (
      <p key={i} className={i > 0 ? "mt-0.5" : ""}>
        {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : <span key={j}>{p}</span>)}
      </p>
    );
  });
}

const MENU_MSG: Msg = {
  role: "agent",
  text: "👋 **Supplier Assistant**\n\nI can fully orchestrate your supplier onboarding. What would you like to do?",
  options: [
    "🏢 Onboard a new supplier",
    "📋 View all suppliers",
    "🔍 Search for a supplier",
    "📄 Add document to supplier",
    "⬆️  Advance supplier stage",
  ],
};

export function SupplierAgent({ onRefresh }: { onRefresh?: () => void }) {
  const [open, setOpen]         = useState(false);
  const [step, setStep]         = useState<Step>("MENU");
  const [data, setData]         = useState<Data>({});
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [messages, setMessages] = useState<Msg[]>([MENU_MSG]);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open]);

  const push = useCallback((...msgs: Msg[]) => setMessages(p => [...p, ...msgs]), []);

  function goMenu() {
    setStep("MENU");
    setData({});
    push(MENU_MSG);
  }

  async function api<T = Record<string, unknown>>(
    url: string, method = "GET", body?: unknown
  ): Promise<{ ok: boolean; data: T }> {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { ok: res.ok, data };
  }

  async function handleSend(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    if (!raw) push({ role: "user", text });

    const skip = ["skip", "-", "s", "na", "n/a"].includes(text.toLowerCase());

    try {
      switch (step) {

        // ── MENU ──────────────────────────────────────────────────────────────
        case "MENU": {
          const t = text.toLowerCase();
          if (t.includes("1") || t.includes("onboard") || t.includes("new")) {
            setStep("ADD_NAME");
            push({ role: "agent", text: "**Step 1 of 4 — Basic Info**\n\nWhat is the **company name**?" });
          } else if (t.includes("2") || t.includes("view") || t.includes("all")) {
            await doViewAll();
          } else if (t.includes("3") || t.includes("search")) {
            setStep("SEARCH");
            push({ role: "agent", text: "Enter the **supplier name or code** to search:" });
          } else if (t.includes("4") || t.includes("doc")) {
            setStep("DOCS_SEARCH");
            push({ role: "agent", text: "Enter the **supplier code or name** to add a document to:" });
          } else if (t.includes("5") || t.includes("advance")) {
            setStep("ADVANCE");
            push({ role: "agent", text: "Enter the **supplier code** (e.g. SUP-001) to advance their onboarding stage:" });
          } else {
            push({ role: "agent", text: "Please choose 1–5 or click a button above.", options: MENU_MSG.options });
          }
          break;
        }

        // ── BASIC INFO ────────────────────────────────────────────────────────
        case "ADD_NAME": {
          if (text.length < 2) { push({ role: "agent", text: "Please enter a valid company name (at least 2 characters)." }); break; }
          setData(d => ({ ...d, name: text }));
          setStep("ADD_CATEGORY");
          push({ role: "agent", text: `**${text}** ✓\n\nWhat **category** best describes this supplier?`, options: CATS.map((c, i) => `${i + 1}. ${c}`) });
          break;
        }

        case "ADD_CATEGORY": {
          const num = parseInt(text);
          const cat = isNaN(num) ? CATS.find(c => c.toLowerCase().includes(text.toLowerCase())) : CATS[num - 1];
          if (!cat) { push({ role: "agent", text: "Pick 1–10 or type the category name.", options: CATS.map((c, i) => `${i + 1}. ${c}`) }); break; }
          setData(d => ({ ...d, category: cat }));
          setStep("ADD_CONTACT");
          push({ role: "agent", text: `**${cat}** ✓\n\nWhat is the **contact person's name**? (type 'skip' to skip)` });
          break;
        }

        case "ADD_CONTACT": {
          setData(d => ({ ...d, contactName: skip ? undefined : text }));
          setStep("ADD_EMAIL");
          push({ role: "agent", text: "What is the **contact email address**? (type 'skip' to skip)" });
          break;
        }

        case "ADD_EMAIL": {
          if (!skip && !text.includes("@")) { push({ role: "agent", text: "Please enter a valid email or type 'skip'." }); break; }
          setData(d => ({ ...d, contactEmail: skip ? undefined : text }));
          setStep("ADD_PHONE");
          push({ role: "agent", text: "**Contact phone number?** (type 'skip' to skip)" });
          break;
        }

        case "ADD_PHONE": {
          setData(d => ({ ...d, contactPhone: skip ? undefined : text }));
          setStep("ADD_CITY");
          push({ role: "agent", text: "**Which city** are they based in? (type 'skip' to skip)" });
          break;
        }

        case "ADD_CITY": {
          setData(d => ({ ...d, city: skip ? undefined : text }));
          setStep("ADD_JUSTIFICATION");
          push({ role: "agent", text: "**Business justification** — why do we need this supplier? (type 'skip' to skip)" });
          break;
        }

        case "ADD_JUSTIFICATION": {
          const d2 = { ...data, businessJustification: skip ? undefined : text };
          setData(d2);
          setStep("ADD_CONFIRM");
          push({
            role: "agent",
            text: `📋 **Summary — please confirm:**\n\n🏢 **Company:** ${d2.name}\n📦 **Category:** ${d2.category}\n👤 **Contact:** ${d2.contactName || "—"}\n📧 **Email:** ${d2.contactEmail || "—"}\n📞 **Phone:** ${d2.contactPhone || "—"}\n🏙️ **City:** ${d2.city || "—"}\n\nShall I create this supplier?`,
            options: ["✅ Yes, create supplier", "❌ Cancel"],
          });
          break;
        }

        case "ADD_CONFIRM": {
          const t = text.toLowerCase();
          if (t.includes("yes") || t.includes("confirm") || t.includes("create") || t === "✅ yes, create supplier") {
            await doCreate();
          } else {
            push({ role: "agent", text: "Cancelled." });
            goMenu();
          }
          break;
        }

        // ── PROFILE ───────────────────────────────────────────────────────────
        case "PROFILE_LEGAL": {
          setData(d => ({ ...d, legalName: skip ? d.name : text }));
          setStep("PROFILE_TYPE");
          push({ role: "agent", text: "What is the **business / entity type**?", options: BIZ_TYPES.map((t, i) => `${i + 1}. ${t}`) });
          break;
        }

        case "PROFILE_TYPE": {
          const num = parseInt(text);
          const bt = isNaN(num) ? BIZ_TYPES.find(b => b.toLowerCase().includes(text.toLowerCase())) : BIZ_TYPES[num - 1];
          if (!bt) { push({ role: "agent", text: "Pick 1–5.", options: BIZ_TYPES.map((t, i) => `${i + 1}. ${t}`) }); break; }
          setData(d => ({ ...d, businessType: bt.toUpperCase().replace(/\s+/g, "_") }));
          setStep("PROFILE_PAN");
          push({ role: "agent", text: `**${bt}** ✓\n\n**PAN number?** (type 'skip' if not available)` });
          break;
        }

        case "PROFILE_PAN": {
          setData(d => ({ ...d, panNumber: skip ? undefined : text.toUpperCase() }));
          setStep("PROFILE_GST");
          push({ role: "agent", text: "**GST registration number?** (type 'skip' if not applicable)" });
          break;
        }

        case "PROFILE_GST": {
          setData(d => ({ ...d, gstNumber: skip ? undefined : text.toUpperCase() }));
          setStep("PROFILE_MSME");
          push({ role: "agent", text: "**MSME registration number?** (type 'skip' if not applicable)" });
          break;
        }

        case "PROFILE_MSME": {
          setData(d => ({ ...d, msmeNumber: skip ? undefined : text }));
          setStep("BANK_BENEFICIARY");
          push({ role: "agent", text: "✅ Tax details saved!\n\n**Step 3 of 4 — Banking Details**\n\n**Beneficiary name** (name on the bank account)?" });
          break;
        }

        // ── BANKING ───────────────────────────────────────────────────────────
        case "BANK_BENEFICIARY": {
          setData(d => ({ ...d, beneficiaryName: skip ? d.legalName || d.name : text }));
          setStep("BANK_NAME");
          push({ role: "agent", text: "**Bank name?** (e.g. HDFC Bank, SBI)" });
          break;
        }

        case "BANK_NAME": {
          setData(d => ({ ...d, bankName: skip ? undefined : text }));
          setStep("BANK_ACCOUNT");
          push({ role: "agent", text: "**Account number?**" });
          break;
        }

        case "BANK_ACCOUNT": {
          setData(d => ({ ...d, accountNumber: skip ? undefined : text }));
          setStep("BANK_IFSC");
          push({ role: "agent", text: "**IFSC code?** (e.g. HDFC0001234, type 'skip' to skip)" });
          break;
        }

        case "BANK_IFSC": {
          setData(d => ({ ...d, ifscCode: skip ? undefined : text.toUpperCase() }));
          setStep("BANK_TYPE");
          push({ role: "agent", text: "**Account type?**", options: ["Savings", "Current"] });
          break;
        }

        case "BANK_TYPE": {
          const at = text.toLowerCase().includes("current") ? "CURRENT" : "SAVINGS";
          setData(d => ({ ...d, accountType: at }));
          setStep("COMPLIANCE");
          push({
            role: "agent",
            text: "✅ Banking saved!\n\n**Step 4 of 4 — Diversity & Compliance**\n\nWhich applies to this supplier? (select one or type 'none')",
            options: ["Women-Owned Business", "Minority-Owned Business", "Small Business (MSME)", "None of the above"],
          });
          break;
        }

        case "COMPLIANCE": {
          const o = text.toLowerCase();
          setData(d => ({
            ...d,
            womenOwned:    o.includes("women"),
            minorityOwned: o.includes("minority"),
            smallBusiness: o.includes("small"),
          }));
          await doSaveProfile();
          break;
        }

        // ── DOCS ──────────────────────────────────────────────────────────────
        case "DOCS_SEARCH": {
          await doFindSupplierForDoc(text);
          break;
        }

        case "DOCS_TYPE": {
          const docTypeKey = Object.entries(DOC_TYPES).find(([, v]) => v.toLowerCase() === text.toLowerCase())?.[0]
            ?? Object.entries(DOC_TYPES).find(([, v]) => v.toLowerCase().includes(text.toLowerCase().replace(/^\d+\.\s*📄?\s*/, "")))?.[0]
            ?? "OTHER";
          await doAddDoc(docTypeKey);
          break;
        }

        // ── SEARCH ────────────────────────────────────────────────────────────
        case "SEARCH": {
          await doSearch(text);
          break;
        }

        // ── ADVANCE ───────────────────────────────────────────────────────────
        case "ADVANCE": {
          await doAdvance(text);
          break;
        }
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Option button click ────────────────────────────────────────────────────
  function handleOption(opt: string) {
    const clean = opt.replace(/^[\d]+\.\s*/, "").replace(/^[🏢📋🔍📄⬆️✅❌]\s*/u, "").trim();

    if (opt.includes("Cancel") || opt.includes("❌")) {
      push({ role: "user", text: opt });
      push({ role: "agent", text: "Cancelled." });
      goMenu();
      return;
    }

    if (opt.includes("Continue") || opt.includes("Business Profile")) {
      push({ role: "user", text: opt });
      setStep("PROFILE_LEGAL");
      push({ role: "agent", text: "**Step 2 of 4 — Business Profile**\n\nWhat is the **legal / registered company name**?\n(press Enter or type 'skip' to use the same as company name)" });
      return;
    }

    if (opt.includes("later") || opt.includes("Done for now")) {
      push({ role: "user", text: opt });
      push({ role: "agent", text: "No problem — you can complete the profile anytime from the Supplier detail page." });
      goMenu();
      return;
    }

    if (opt.includes("required documents") || opt.includes("Add documents")) {
      push({ role: "user", text: opt });
      if (data.supplierId) {
        setStep("DOCS_TYPE");
        push({
          role: "agent",
          text: "Which **document type** would you like to add?",
          options: ["📄 PAN Card", "📄 GST Certificate", "📄 Certificate of Incorporation", "📄 Cancelled Cheque", "📄 Bank Statement", "📄 ISO Certificate"],
        });
      } else {
        setStep("DOCS_SEARCH");
        push({ role: "agent", text: "Enter the supplier code or name:" });
      }
      return;
    }

    if (opt.includes("Another document") || opt.includes("another doc")) {
      push({ role: "user", text: opt });
      if (data.docSupplierId) {
        setStep("DOCS_TYPE");
        push({
          role: "agent",
          text: "Which **document type** would you like to add?",
          options: ["📄 PAN Card", "📄 GST Certificate", "📄 Certificate of Incorporation", "📄 Cancelled Cheque", "📄 Bank Statement", "📄 Other"],
        });
      } else {
        setStep("DOCS_SEARCH");
        push({ role: "agent", text: "Enter supplier code or name:" });
      }
      return;
    }

    // Doc type selection
    if (step === "DOCS_TYPE" && (opt.includes("📄") || opt.startsWith("PAN") || opt.startsWith("GST"))) {
      push({ role: "user", text: opt });
      handleSend(clean);
      return;
    }

    // Bank type
    if (step === "BANK_TYPE") {
      push({ role: "user", text: opt });
      handleSend(clean);
      return;
    }

    // Business type
    if (step === "PROFILE_TYPE") {
      push({ role: "user", text: opt });
      handleSend(clean);
      return;
    }

    // Category
    if (step === "ADD_CATEGORY") {
      push({ role: "user", text: opt });
      handleSend(clean);
      return;
    }

    // Compliance
    if (step === "COMPLIANCE") {
      push({ role: "user", text: opt });
      handleSend(clean);
      return;
    }

    // Menu options
    if (step === "MENU") {
      push({ role: "user", text: opt });
      handleSend(opt);
      return;
    }

    // Confirm
    if (step === "ADD_CONFIRM") {
      push({ role: "user", text: opt });
      handleSend(opt);
      return;
    }

    // Fallback
    push({ role: "user", text: opt });
    handleSend(clean);
  }

  // ── API helpers ────────────────────────────────────────────────────────────

  async function doViewAll() {
    push({ role: "loading", text: "Loading suppliers…" });
    const { ok, data: d } = await api<{ suppliers: { name: string; code: string; status: string; onboardingStage: string | null; category: string | null }[] }>("/api/suppliers");
    setMessages(p => p.filter(m => m.role !== "loading"));
    if (!ok || !d.suppliers?.length) {
      push({ role: "agent", text: "No suppliers found yet.", options: ["🏢 Onboard a new supplier", "↩️ Back to menu"] });
    } else {
      const STATUS_EMOJI: Record<string, string> = { ACTIVE: "🟢", PENDING_APPROVAL: "🟡", BLOCKED: "🔴", INACTIVE: "⚫" };
      const lines = d.suppliers.slice(0, 10).map(s =>
        `${STATUS_EMOJI[s.status] ?? "⚫"} **${s.name}** (${s.code})\n   ${s.category || "—"} · Stage: ${STAGE_LABELS[s.onboardingStage ?? ""] || "—"}`
      ).join("\n\n");
      push({
        role: "agent",
        text: `Found **${d.suppliers.length}** supplier${d.suppliers.length !== 1 ? "s" : ""}:\n\n${lines}${d.suppliers.length > 10 ? `\n\n…and ${d.suppliers.length - 10} more.` : ""}`,
        options: ["🏢 Onboard a new supplier", "🔍 Search for a supplier", "↩️ Back to menu"],
      });
      setStep("MENU");
    }
  }

  async function doSearch(query: string) {
    push({ role: "loading", text: "Searching…" });
    const { data: d } = await api<{ suppliers: { name: string; code: string; status: string; onboardingStage: string | null; category: string | null }[] }>(`/api/suppliers?q=${encodeURIComponent(query)}`);
    setMessages(p => p.filter(m => m.role !== "loading"));
    const sups = d.suppliers ?? [];
    if (!sups.length) {
      push({ role: "agent", text: `No suppliers found matching **"${query}"**.`, options: ["🔍 Search again", "↩️ Back to menu"] });
    } else {
      const lines = sups.slice(0, 5).map(s =>
        `• **${s.name}** (${s.code}) — ${s.status} · ${STAGE_LABELS[s.onboardingStage ?? ""] || "—"}\n  ${s.category || "—"}`
      ).join("\n\n");
      push({ role: "agent", text: `Found **${sups.length}** result${sups.length !== 1 ? "s" : ""}:\n\n${lines}` });
    }
    goMenu();
  }

  async function doCreate() {
    push({ role: "loading", text: "Creating supplier…" });
    const { ok, data: d } = await api<{ supplier: { id: string; code: string }; error?: string }>("/api/suppliers", "POST", {
      name: data.name, contactName: data.contactName, contactEmail: data.contactEmail,
      contactPhone: data.contactPhone, category: data.category, city: data.city,
      businessJustification: data.businessJustification, country: "India", currency: "INR",
    });
    setMessages(p => p.filter(m => m.role !== "loading"));

    if (!ok) {
      push({ role: "error", text: `Failed to create supplier: ${(d as { error?: string }).error || "Please try again."}` });
      goMenu();
      return;
    }

    const supplierId = d.supplier.id;
    setData(prev => ({ ...prev, supplierId, supplierName: prev.name }));
    onRefresh?.();

    push({
      role: "success",
      text: `🎉 **${data.name}** created!\n\n📋 Code: **${d.supplier.code}**\n🔄 Stage: **Registration**\n\nLet's complete the onboarding profile to unlock all stages.`,
      options: ["📝 Continue with Business Profile", "⏭️ Do it later"],
    });
    setStep("PROFILE_LEGAL");
  }

  async function doSaveProfile() {
    if (!data.supplierId) { goMenu(); return; }
    push({ role: "loading", text: "Saving onboarding profile…" });

    const { ok, data: d } = await api<{ completionScore?: number; error?: string }>(
      `/api/suppliers/${data.supplierId}/onboarding`,
      "POST",
      {
        legalName: data.legalName, businessType: data.businessType,
        panNumber: data.panNumber, gstNumber: data.gstNumber, msmeNumber: data.msmeNumber,
        beneficiaryName: data.beneficiaryName, bankName: data.bankName,
        accountNumber: data.accountNumber, ifscCode: data.ifscCode, accountType: data.accountType,
        womenOwned: data.womenOwned ?? false, minorityOwned: data.minorityOwned ?? false,
        smallBusiness: data.smallBusiness ?? false,
      }
    );
    setMessages(p => p.filter(m => m.role !== "loading"));

    if (!ok) {
      push({ role: "error", text: "Failed to save profile. Please try again." });
    } else {
      push({
        role: "success",
        text: `✅ **Onboarding profile saved!**\n\nCompletion: **${d.completionScore ?? 0}%**\n\nNow let's add the required compliance documents:\n• PAN Card\n• GST Certificate\n• Certificate of Incorporation\n• Cancelled Cheque`,
        options: ["📄 Add required documents", "✅ Done for now"],
      });
      onRefresh?.();
    }
    setStep("DOCS_TYPE");
    setData(d2 => ({ ...d2, docSupplierId: d2.supplierId, docSupplierName: d2.supplierName }));
  }

  async function doFindSupplierForDoc(query: string) {
    push({ role: "loading", text: "Looking up supplier…" });
    const { data: d } = await api<{ suppliers: { id: string; name: string; code: string; documents: { type: string }[] }[] }>(`/api/suppliers?q=${encodeURIComponent(query)}`);
    setMessages(p => p.filter(m => m.role !== "loading"));
    const sups = d.suppliers ?? [];

    if (!sups.length) {
      push({ role: "agent", text: `No supplier found matching **"${query}"**. Please try the supplier code (e.g. SUP-001) or exact name.` });
      return;
    }

    const sup = sups[0];
    setData(d2 => ({ ...d2, docSupplierId: sup.id, docSupplierName: sup.name }));
    setStep("DOCS_TYPE");
    push({
      role: "agent",
      text: `Adding document to **${sup.name}**.\n\nWhich **document type** would you like to add?`,
      options: [
        "📄 PAN Card", "📄 GST Certificate", "📄 Certificate of Incorporation",
        "📄 Cancelled Cheque", "📄 Bank Statement", "📄 ISO Certificate", "📄 Other",
      ],
    });
  }

  async function doAddDoc(docTypeKey: string) {
    const sid = data.docSupplierId || data.supplierId;
    const sname = data.docSupplierName || data.supplierName;
    if (!sid) { push({ role: "agent", text: "Supplier not found. Please try again." }); goMenu(); return; }

    const docLabel = DOC_TYPES[docTypeKey] ?? docTypeKey;
    const docName  = `${docLabel} — ${sname}`;

    push({ role: "loading", text: "Adding document record…" });
    const { ok } = await api(`/api/suppliers/${sid}/documents`, "POST", {
      type: docTypeKey, name: docName, fileUrl: "#",
    });
    setMessages(p => p.filter(m => m.role !== "loading"));

    if (ok) {
      push({
        role: "success",
        text: `✅ **${docLabel}** added!\n\n📌 Status: **Pending verification**\n\nThe procurement team can verify this from the Supplier detail page.`,
        options: ["📄 Add another document", "✅ Done"],
      });
      onRefresh?.();
    } else {
      push({ role: "error", text: "Failed to add document." });
    }
    setStep("MENU");
  }

  async function doAdvance(query: string) {
    push({ role: "loading", text: "Looking up supplier…" });
    const { data: d } = await api<{ suppliers: { id: string; name: string; onboardingStage: string | null }[] }>(`/api/suppliers?q=${encodeURIComponent(query)}`);
    setMessages(p => p.filter(m => m.role !== "loading"));
    const sups = d.suppliers ?? [];

    if (!sups.length) {
      push({ role: "agent", text: `No supplier found matching **"${query}"**.` });
      goMenu();
      return;
    }

    const sup = sups[0];
    const curIdx  = STAGE_ORDER.indexOf(sup.onboardingStage ?? "REGISTRATION");
    const nxtStage = STAGE_ORDER[curIdx + 1];

    if (!nxtStage) {
      push({ role: "agent", text: `**${sup.name}** is already at the final stage: **${STAGE_LABELS[sup.onboardingStage ?? ""]}** ✅` });
      goMenu();
      return;
    }

    push({ role: "loading", text: `Advancing to ${STAGE_LABELS[nxtStage]}…` });
    const { ok } = await api(`/api/suppliers/${sup.id}`, "PATCH", {
      onboardingStage: nxtStage,
      ...(nxtStage === "ACTIVE" ? { status: "ACTIVE" } : {}),
    });
    setMessages(p => p.filter(m => m.role !== "loading"));

    if (ok) {
      push({
        role: "success",
        text: `✅ **${sup.name}** advanced!\n\n📍 Before: **${STAGE_LABELS[sup.onboardingStage ?? "REGISTRATION"]}**\n➡️ Now: **${STAGE_LABELS[nxtStage]}**${nxtStage === "ACTIVE" ? "\n\n🎉 Supplier is now fully **ACTIVE**!" : ""}`,
      });
      onRefresh?.();
    } else {
      push({ role: "error", text: "Failed to advance stage." });
    }
    goMenu();
  }

  const progress = PROGRESS[step] ?? 0;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 ${
          open
            ? "bg-gray-800"
            : "bg-gradient-to-br from-[#1A2A52] to-[#2D5A9B] hover:scale-110 hover:shadow-xl"
        }`}
        title="Supplier Assistant"
      >
        {open ? (
          <X className="size-5 text-white" />
        ) : (
          <>
            <Building2 className="size-6 text-white" />
            <span className="absolute top-0.5 right-0.5 size-3.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
          </>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ width: 400, maxHeight: "min(650px, calc(100vh - 130px))" }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1A2A52] to-[#2D5A9B] px-4 py-3 shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Building2 className="size-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white leading-tight">Supplier Onboarding</p>
                <p className="text-[10px] text-white/60">AI-powered · End-to-end orchestration</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X className="size-4" />
              </button>
            </div>
            {progress > 0 && (
              <div>
                <div className="flex justify-between text-[10px] text-white/60 mb-1">
                  <span>Onboarding progress</span>
                  <span className="font-semibold">{progress}%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-1.5 bg-[#C8A04D] rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 bg-gray-50/40">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "loading" ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-1 pl-1">
                    <Loader2 className="size-3.5 animate-spin shrink-0 text-[#1A2A52]" />
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
                    <div className={`size-7 rounded-full flex items-center justify-center shrink-0 mb-0.5 shadow-sm ${
                      msg.role === "success" ? "bg-emerald-500"
                      : msg.role === "error"   ? "bg-red-500"
                      : "bg-[#1A2A52]"
                    }`}>
                      {msg.role === "success" ? (
                        <CheckCircle2 className="size-4 text-white" />
                      ) : msg.role === "error" ? (
                        <AlertCircle className="size-4 text-white" />
                      ) : (
                        <Building2 className="size-3.5 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className={`text-xs leading-relaxed px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm ${
                        msg.role === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                        : msg.role === "error"  ? "bg-red-50 border border-red-200 text-red-800"
                        : "bg-white border border-gray-100 text-gray-800"
                      }`}>
                        {bold(msg.text)}
                      </div>
                      {msg.options && msg.options.length > 0 && (
                        <div className="space-y-1.5 pl-0.5">
                          {msg.options.map((opt, oi) => (
                            <button
                              key={oi}
                              onClick={() => !busy && handleOption(opt)}
                              disabled={busy}
                              className="flex items-center gap-2 text-left w-full text-xs font-medium bg-white border border-gray-200 hover:border-[#1A2A52] hover:bg-[#1A2A52]/5 text-gray-700 hover:text-[#1A2A52] px-3 py-2 rounded-xl transition-all duration-150 disabled:opacity-50 shadow-sm"
                            >
                              <ChevronRight className="size-3 text-[#C8A04D] shrink-0" />
                              <span>{opt}</span>
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

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100 shrink-0 bg-white">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-[#1A2A52] focus-within:ring-1 focus-within:ring-[#1A2A52]/15 transition-all">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && !busy) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  step === "ADD_EMAIL"     ? "email@company.com or skip" :
                  step === "ADD_PHONE"     ? "+91-XXXXXXXXXX or skip" :
                  step === "PROFILE_PAN"  ? "ABCDE1234F or skip" :
                  step === "PROFILE_GST"  ? "27AABCN1234F1ZX or skip" :
                  step === "BANK_IFSC"    ? "HDFC0001234 or skip" :
                  step === "MENU"         ? "Type 1–5 or use buttons above…" :
                  "Type your response…"
                }
                disabled={busy}
                className="flex-1 text-xs bg-transparent outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-40"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || busy}
                className="size-7 bg-[#1A2A52] rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-[#243766] transition-colors shrink-0"
              >
                {busy
                  ? <Loader2 className="size-3 text-white animate-spin" />
                  : <Send className="size-3 text-white" />
                }
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 text-center">Enter to send · Buttons for quick replies</p>
          </div>
        </div>
      )}
    </>
  );
}
