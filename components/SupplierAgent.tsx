"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Building2, X, Send, Loader2, CheckCircle2,
  AlertCircle, ChevronRight, Upload,
} from "lucide-react";
import { requirementsFor, SUPPORTED_COUNTRIES, DOC_TYPE_LABELS } from "@/lib/onboarding-requirements";
import type { RiskBreakdown as RiskBreakdownT } from "@/lib/supplier-risk";

type Msg = {
  role: "agent" | "user" | "success" | "error" | "loading";
  text: string;
  options?: string[];
};

type Step =
  | "MENU"
  | "ADD_NAME" | "ADD_CATEGORY" | "ADD_COUNTRY" | "ADD_CONTACT" | "ADD_EMAIL"
  | "ADD_PHONE" | "ADD_CITY" | "ADD_JUSTIFICATION" | "ADD_CONFIRM"
  | "PROFILE_LEGAL" | "PROFILE_TYPE" | "PROFILE_TAX" | "PROFILE_MSME"
  | "BANK_BENEFICIARY" | "BANK_FIELDS" | "BANK_TYPE"
  | "COMPLIANCE" | "QUESTIONNAIRE"
  | "DOCS_SEARCH" | "DOCS_TYPE" | "DOCS_ATTACH"
  | "RISK_DECLARATION"
  | "SEARCH" | "ADVANCE" | "RISK_LOOKUP";

type QuestField = { fieldKey: string; name: string; fieldType: string; options: string[]; required: boolean; helpText?: string | null };

type Data = {
  name?: string; category?: string; country?: string; contactName?: string; contactEmail?: string;
  contactPhone?: string; city?: string; businessJustification?: string;
  legalName?: string; businessType?: string;
  panNumber?: string; gstNumber?: string; taxIdValue?: string; msmeNumber?: string;
  beneficiaryName?: string; bankName?: string; accountNumber?: string;
  ifscCode?: string; routingNumber?: string; bsb?: string; iban?: string; swiftCode?: string;
  accountType?: string;
  womenOwned?: boolean; minorityOwned?: boolean; smallBusiness?: boolean;
  supplierId?: string; supplierName?: string; docSupplierId?: string; docSupplierName?: string;
  questFields?: QuestField[]; questIdx?: number; questAnswers?: Record<string, string>;
  taxIdx?: number; bankIdx?: number;
  docChecklist?: string[]; pendingDocType?: string;
  riskDeclIdx?: number; riskDeclarations?: Record<string, boolean>;
};

const FALLBACK_CATS = [
  "IT Hardware","Software & Licenses","Cloud Services","Consulting Services",
  "Office Supplies","Facilities","Logistics","Marketing","Professional Services","Other",
];
const BIZ_TYPES_DEFAULT = ["Private Limited","LLP","Partnership","Proprietorship","Public Limited"];
const BIZ_TYPES_BY_COUNTRY: Record<string, string[]> = {
  "United States": ["LLC","C-Corporation","S-Corporation","Partnership","Sole Proprietorship"],
  "United Kingdom": ["Private Limited Company","Public Limited Company","LLP","Partnership","Sole Trader"],
};
function bizTypesFor(country?: string) { return (country && BIZ_TYPES_BY_COUNTRY[country]) || BIZ_TYPES_DEFAULT; }

const AD_HOC_DOC_OPTIONS = Object.entries(DOC_TYPE_LABELS).map(([, label]) => `📄 ${label}`);

const RISK_DECL_QUESTIONS: { key: string; text: string }[] = [
  { key: "hasInsurance", text: "Does this supplier carry business/liability insurance?" },
  { key: "hasBCP", text: "Does this supplier have a documented business continuity / disaster recovery plan?" },
  { key: "hasAntiBriberyPolicy", text: "Does this supplier have a formal anti-bribery / anti-corruption policy?" },
  { key: "hasLegalDisputes", text: "Is this supplier currently involved in any pending legal disputes or regulatory action?" },
];

const STAGE_LABELS: Record<string, string> = {
  REGISTRATION:"Registration", VALIDATION:"Validation",
  RISK_ASSESSMENT:"Risk Assessment", COMPLIANCE_REVIEW:"Compliance Review",
  PROCUREMENT_APPROVAL:"Procurement Approval", ACTIVE:"Active",
};
const STAGE_ORDER = ["REGISTRATION","VALIDATION","RISK_ASSESSMENT","COMPLIANCE_REVIEW","PROCUREMENT_APPROVAL","ACTIVE"];

const PROGRESS: Partial<Record<Step, number>> = {
  MENU:0, ADD_NAME:6, ADD_CATEGORY:11, ADD_COUNTRY:15, ADD_CONTACT:19, ADD_EMAIL:23,
  ADD_PHONE:26, ADD_CITY:29, ADD_JUSTIFICATION:32, ADD_CONFIRM:35,
  PROFILE_LEGAL:42, PROFILE_TYPE:46, PROFILE_TAX:52, PROFILE_MSME:56,
  BANK_BENEFICIARY:62, BANK_FIELDS:68, BANK_TYPE:74,
  COMPLIANCE:80, DOCS_SEARCH:84, DOCS_TYPE:86, DOCS_ATTACH:90, RISK_DECLARATION:96,
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

function renderRiskText(name: string, b: RiskBreakdownT): string {
  const lines = b.domains.map(dm => `**${dm.domain}** — ${dm.score}/100\n${dm.rationale.map(r => `  • ${r}`).join("\n")}`).join("\n\n");
  return `📊 **Risk Assessment — ${name}**\n\nRisk Score **${b.riskScore}/100** (${b.riskLevel}) · Compliance **${b.complianceScore}%**\n\n${lines}\n\n_Not yet assessed (needs a connected data source): ${b.unscored.map(u => u.domain).join(", ")}._`;
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
    "📊 Explain supplier risk",
  ],
};

export function SupplierAgent({ onRefresh }: { onRefresh?: () => void }) {
  const [open, setOpen]         = useState(false);
  const [step, setStep]         = useState<Step>("MENU");
  const [data, setData]         = useState<Data>({});
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [messages, setMessages] = useState<Msg[]>([MENU_MSG]);
  const [cats, setCats]         = useState<string[]>(FALLBACK_CATS);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/lookups?type=CATEGORY")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const labels = Array.isArray(d?.lookups) ? d.lookups.map((l: { label: string }) => l.label) : [];
        if (labels.length) setCats(labels);
      })
      .catch(() => {});
  }, [open]);

  const push = useCallback((...msgs: Msg[]) => setMessages(p => [...p, ...msgs]), []);

  function goMenu() {
    setStep("MENU");
    setData({});
    push(MENU_MSG);
  }

  // Lets other parts of the suppliers section (e.g. the "Onboard Supplier" button on
  // the list page) open this bot and jump straight into onboarding, without lifting
  // state through the layout — this component is mounted once in the section layout.
  useEffect(() => {
    function onOpenOnboard() {
      setOpen(true);
      setData({});
      setStep("ADD_NAME");
      setMessages([MENU_MSG, { role: "agent", text: "**Step 1 of 4 — Basic Info**\n\nWhat is the **company name**?" }]);
    }
    window.addEventListener("veltriance:onboard-supplier", onOpenOnboard);
    return () => window.removeEventListener("veltriance:onboard-supplier", onOpenOnboard);
  }, []);

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
          } else if (t.includes("6") || t.includes("risk")) {
            setStep("RISK_LOOKUP");
            push({ role: "agent", text: "Enter the **supplier code or name** to explain its risk assessment:" });
          } else {
            push({ role: "agent", text: "Please choose 1–6 or click a button above.", options: MENU_MSG.options });
          }
          break;
        }

        // ── BASIC INFO ────────────────────────────────────────────────────────
        case "ADD_NAME": {
          if (text.length < 2) { push({ role: "agent", text: "Please enter a valid company name (at least 2 characters)." }); break; }
          setData(d => ({ ...d, name: text }));
          setStep("ADD_CATEGORY");
          push({ role: "agent", text: `**${text}** ✓\n\nWhat **category** best describes this supplier?`, options: cats.map((c, i) => `${i + 1}. ${c}`) });
          break;
        }

        case "ADD_CATEGORY": {
          const num = parseInt(text);
          const cat = isNaN(num) ? cats.find(c => c.toLowerCase().includes(text.toLowerCase())) : cats[num - 1];
          if (!cat) { push({ role: "agent", text: "Pick 1–10 or type the category name.", options: cats.map((c, i) => `${i + 1}. ${c}`) }); break; }
          setData(d => ({ ...d, category: cat }));
          setStep("ADD_COUNTRY");
          push({
            role: "agent",
            text: `**${cat}** ✓\n\nWhich **country** is this supplier based in? This determines which tax ID, banking details, and documents are required.`,
            options: SUPPORTED_COUNTRIES.map((c, i) => `${i + 1}. ${c}`),
          });
          break;
        }

        case "ADD_COUNTRY": {
          const num = parseInt(text);
          const country = !isNaN(num) ? SUPPORTED_COUNTRIES[num - 1] : SUPPORTED_COUNTRIES.find(c => c.toLowerCase().includes(text.toLowerCase()));
          if (!country) { push({ role: "agent", text: "Please pick a country from the list.", options: SUPPORTED_COUNTRIES.map((c, i) => `${i + 1}. ${c}`) }); break; }
          setData(d => ({ ...d, country }));
          setStep("ADD_CONTACT");
          push({ role: "agent", text: `**${country}** ✓\n\nWhat is the **contact person's name**? (type 'skip' to skip)` });
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
            text: `📋 **Summary — please confirm:**\n\n🏢 **Company:** ${d2.name}\n📦 **Category:** ${d2.category}\n🌍 **Country:** ${d2.country}\n👤 **Contact:** ${d2.contactName || "—"}\n📧 **Email:** ${d2.contactEmail || "—"}\n📞 **Phone:** ${d2.contactPhone || "—"}\n🏙️ **City:** ${d2.city || "—"}\n\nShall I create this supplier?`,
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
          const bt = bizTypesFor(data.country);
          push({ role: "agent", text: "What is the **business / entity type**?", options: bt.map((t, i) => `${i + 1}. ${t}`) });
          break;
        }

        case "PROFILE_TYPE": {
          const bt = bizTypesFor(data.country);
          const num = parseInt(text);
          const chosen = isNaN(num) ? bt.find(b => b.toLowerCase().includes(text.toLowerCase())) : bt[num - 1];
          if (!chosen) { push({ role: "agent", text: `Pick 1–${bt.length}.`, options: bt.map((t, i) => `${i + 1}. ${t}`) }); break; }
          setData(d => ({ ...d, businessType: chosen.toUpperCase().replace(/\s+/g, "_") }));
          setStep("PROFILE_TAX");
          setData(d => ({ ...d, taxIdx: 0 }));
          const taxFields = requirementsFor(data.country).taxFields;
          const f0 = taxFields[0];
          push({ role: "agent", text: `**${chosen}** ✓\n\n**${f0.label}?**${f0.placeholder ? ` (e.g. ${f0.placeholder})` : ""}${f0.helpText ? `\n${f0.helpText}` : ""} (type 'skip' if not available)` });
          break;
        }

        case "PROFILE_TAX": {
          const taxFields = requirementsFor(data.country).taxFields;
          const idx = data.taxIdx ?? 0;
          const f = taxFields[idx];
          if (!f) { setStep("BANK_BENEFICIARY"); break; }
          setData(d => ({ ...d, [f.key]: skip ? undefined : text.toUpperCase() }));
          const nextIdx = idx + 1;
          if (nextIdx >= taxFields.length) {
            if (data.country === "India") {
              setStep("PROFILE_MSME");
              push({ role: "agent", text: "**MSME registration number?** (type 'skip' if not applicable)" });
            } else {
              setStep("BANK_BENEFICIARY");
              push({ role: "agent", text: "✅ Tax details saved!\n\n**Step 3 of 4 — Banking Details**\n\n**Beneficiary name** (name on the bank account)?" });
            }
          } else {
            setData(d => ({ ...d, taxIdx: nextIdx }));
            const nf = taxFields[nextIdx];
            push({ role: "agent", text: `**${nf.label}?**${nf.placeholder ? ` (e.g. ${nf.placeholder})` : ""}${nf.helpText ? `\n${nf.helpText}` : ""} (type 'skip' if not available)` });
          }
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
          setStep("BANK_FIELDS");
          setData(d => ({ ...d, bankIdx: 0 }));
          const bankFields = requirementsFor(data.country).bankFields;
          const f0 = bankFields[0];
          push({ role: "agent", text: `**${f0.label}?**${f0.placeholder ? ` (e.g. ${f0.placeholder})` : ""}` });
          break;
        }

        case "BANK_FIELDS": {
          const bankFields = requirementsFor(data.country).bankFields;
          const idx = data.bankIdx ?? 0;
          const f = bankFields[idx];
          if (!f) { setStep("BANK_TYPE"); break; }
          setData(d => ({ ...d, [f.key]: skip ? undefined : (f.key === "bankName" ? text : text.toUpperCase()) }));
          const nextIdx = idx + 1;
          if (nextIdx >= bankFields.length) {
            setStep("BANK_TYPE");
            push({ role: "agent", text: "**Account type?**", options: ["Savings", "Current"] });
          } else {
            setData(d => ({ ...d, bankIdx: nextIdx }));
            const nf = bankFields[nextIdx];
            push({ role: "agent", text: `**${nf.label}?**${nf.placeholder ? ` (e.g. ${nf.placeholder})` : ""} (type 'skip' to skip)` });
          }
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

        // ── DYNAMIC QUESTIONNAIRE ─────────────────────────────────────────────
        case "QUESTIONNAIRE": {
          await doQuestionnaireAnswer(text, skip);
          break;
        }

        // ── RISK EXPLAIN (menu) ──────────────────────────────────────────────
        case "RISK_LOOKUP": {
          await doExplainRisk(text);
          break;
        }

        // ── RISK DECLARATION (onboarding) ────────────────────────────────────
        case "RISK_DECLARATION": {
          await doRiskDeclarationAnswer(text);
          break;
        }

        // ── DOCS ──────────────────────────────────────────────────────────────
        case "DOCS_SEARCH": {
          await doFindSupplierForDoc(text);
          break;
        }

        case "DOCS_TYPE": {
          const t = text.toLowerCase();
          if (t.includes("add another")) { askDocType(); break; }
          if (t.includes("done")) { push({ role: "agent", text: "All done for now." }); goMenu(); break; }
          const docTypeKey = Object.entries(DOC_TYPE_LABELS).find(([, v]) => v.toLowerCase() === t)?.[0]
            ?? Object.entries(DOC_TYPE_LABELS).find(([, v]) => v.toLowerCase().includes(t.replace(/^\d+\.\s*📄?\s*/, "")))?.[0]
            ?? "OTHER";
          setData(d => ({ ...d, pendingDocType: docTypeKey }));
          setStep("DOCS_ATTACH");
          push({ role: "agent", text: `Please attach the **${DOC_TYPE_LABELS[docTypeKey] ?? docTypeKey}**. Accepted: PDF, JPG, PNG (max 10MB).`, options: ["⏭️ Skip this document"] });
          break;
        }

        case "DOCS_ATTACH": {
          if (text.toLowerCase().includes("skip")) {
            push({ role: "agent", text: `Skipped — you can attach the **${DOC_TYPE_LABELS[data.pendingDocType ?? ""] ?? data.pendingDocType}** later from the supplier detail page.` });
            advanceDocChecklist();
          } else {
            push({ role: "agent", text: "Please attach a file using the picker below, or type **skip**.", options: ["⏭️ Skip this document"] });
          }
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
    const clean = opt.replace(/^[\d]+\.\s*/, "").replace(/^[🏢📋🔍📄⬆️✅❌⏭️]\s*/u, "").trim();

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

    // Bank type
    if (step === "BANK_TYPE") { push({ role: "user", text: opt }); handleSend(clean); return; }

    // Business type
    if (step === "PROFILE_TYPE") { push({ role: "user", text: opt }); handleSend(clean); return; }

    // Category
    if (step === "ADD_CATEGORY") { push({ role: "user", text: opt }); handleSend(clean); return; }

    // Country
    if (step === "ADD_COUNTRY") { push({ role: "user", text: opt }); handleSend(clean); return; }

    // Compliance
    if (step === "COMPLIANCE") { push({ role: "user", text: opt }); handleSend(clean); return; }

    // Dynamic questionnaire dropdown options
    if (step === "QUESTIONNAIRE") { push({ role: "user", text: opt }); handleSend(clean); return; }

    // Doc type selection (both onboarding-driven and ad-hoc)
    if (step === "DOCS_TYPE") { push({ role: "user", text: opt }); handleSend(clean); return; }

    // Skip document / risk declaration Yes-No / anything else with a step-specific handler
    if (step === "DOCS_ATTACH") { push({ role: "user", text: opt }); handleSend(clean); return; }
    if (step === "RISK_DECLARATION") { push({ role: "user", text: opt }); handleSend(clean); return; }

    // Menu options
    if (step === "MENU") { push({ role: "user", text: opt }); handleSend(opt); return; }

    // Confirm
    if (step === "ADD_CONFIRM") { push({ role: "user", text: opt }); handleSend(opt); return; }

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
      contactPhone: data.contactPhone, category: data.category, city: data.city, country: data.country,
      businessJustification: data.businessJustification,
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

    const req = requirementsFor(data.country);
    const payload: Record<string, unknown> = {
      country: data.country, legalName: data.legalName, businessType: data.businessType,
      beneficiaryName: data.beneficiaryName, bankName: data.bankName, accountType: data.accountType,
      womenOwned: data.womenOwned ?? false, minorityOwned: data.minorityOwned ?? false,
      smallBusiness: data.smallBusiness ?? false,
    };
    if (data.country === "India") payload.msmeNumber = data.msmeNumber;
    for (const f of [...req.taxFields, ...req.bankFields]) payload[f.key] = (data as Record<string, unknown>)[f.key];

    const { ok, data: d } = await api<{ completionScore?: number; error?: string }>(
      `/api/suppliers/${data.supplierId}/onboarding`, "POST", payload
    );
    setMessages(p => p.filter(m => m.role !== "loading"));

    if (!ok) {
      const err = (d as { error?: string }).error || "Failed to save profile. Please try again.";
      push({ role: "error", text: err });
      const badTaxField = req.taxFields.find(f => err.includes(f.key));
      const badBankField = req.bankFields.find(f => err.includes(f.key));
      if (badTaxField) {
        setStep("PROFILE_TAX");
        setData(d2 => ({ ...d2, taxIdx: req.taxFields.indexOf(badTaxField) }));
        push({ role: "agent", text: `Please re-enter a valid **${badTaxField.label}**${badTaxField.placeholder ? ` (e.g. ${badTaxField.placeholder})` : ""}.` });
      } else if (badBankField) {
        setStep("BANK_FIELDS");
        setData(d2 => ({ ...d2, bankIdx: req.bankFields.indexOf(badBankField) }));
        push({ role: "agent", text: `Please re-enter a valid **${badBankField.label}**${badBankField.placeholder ? ` (e.g. ${badBankField.placeholder})` : ""}.` });
      } else {
        setStep("PROFILE_LEGAL");
        push({ role: "agent", text: "Let's redo the business profile — what is the **legal / registered company name**?" });
      }
      return;
    }

    push({
      role: "success",
      text: `✅ **Onboarding profile saved!**\n\nCompletion: **${d.completionScore ?? 0}%**`,
    });
    onRefresh?.();

    const { data: q } = await api<{ fields: QuestField[] }>(`/api/suppliers/${data.supplierId}/questionnaire`);
    const fields = q.fields ?? [];
    if (fields.length > 0) {
      setData(d2 => ({ ...d2, questFields: fields, questIdx: 0, questAnswers: {} }));
      setStep("QUESTIONNAIRE");
      const f = fields[0];
      push({ role: "agent", text: `This organization has a few extra questions for suppliers like this one.\n\n**${f.name}**${f.helpText ? `\n${f.helpText}` : ""}${f.required ? "" : " (type 'skip' to skip)"}`, options: f.fieldType === "DROPDOWN" ? f.options : undefined });
      return;
    }

    startDocChecklist();
  }

  async function doQuestionnaireAnswer(text: string, skip: boolean) {
    const fields = data.questFields ?? [];
    const idx = data.questIdx ?? 0;
    const f = fields[idx];
    if (!f) { startDocChecklist(); return; }
    if (f.required && !text.trim()) {
      push({ role: "agent", text: `**${f.name}** is required.`, options: f.fieldType === "DROPDOWN" ? f.options : undefined });
      return;
    }
    const answers = { ...(data.questAnswers ?? {}), [f.fieldKey]: skip ? "" : text.trim() };
    const nextIdx = idx + 1;
    if (nextIdx >= fields.length) {
      push({ role: "loading", text: "Saving answers…" });
      const { ok } = await api(`/api/suppliers/${data.supplierId}/questionnaire`, "POST", { answers });
      setMessages(p => p.filter(m => m.role !== "loading"));
      push({ role: ok ? "success" : "error", text: ok ? "✅ Saved additional details." : "Some answers didn't save — you can update them later from the supplier detail page." });
      setData(d2 => ({ ...d2, questAnswers: answers }));
      startDocChecklist();
    } else {
      setData(d2 => ({ ...d2, questAnswers: answers, questIdx: nextIdx }));
      const nf = fields[nextIdx];
      push({ role: "agent", text: `**${nf.name}**${nf.helpText ? `\n${nf.helpText}` : ""}${nf.required ? "" : " (type 'skip' to skip)"}`, options: nf.fieldType === "DROPDOWN" ? nf.options : undefined });
    }
  }

  // ── Document checklist (onboarding) ─────────────────────────────────────────

  function startDocChecklist() {
    const sid = data.supplierId;
    const req = requirementsFor(data.country);
    setData(d => ({ ...d, docSupplierId: sid, docSupplierName: d.supplierName, docChecklist: req.requiredDocs.slice() }));
    push({
      role: "agent",
      text: `Now let's collect the documents required for a **${data.country}** supplier:\n${req.requiredDocs.map(t => `• ${DOC_TYPE_LABELS[t] ?? t}`).join("\n")}`,
    });
    advanceDocChecklistFrom(req.requiredDocs.slice());
  }

  function advanceDocChecklistFrom(remaining: string[] | undefined) {
    if (remaining === undefined) {
      push({ role: "agent", text: "Add another document or type **done**.", options: ["📄 Add another document", "✅ Done"] });
      setStep("DOCS_TYPE");
      return;
    }
    if (remaining.length === 0) {
      push({ role: "agent", text: "✅ All required documents collected.\n\n**Risk Assessment** — a few quick questions:" });
      setData(d => ({ ...d, riskDeclIdx: 0, riskDeclarations: {} }));
      setStep("RISK_DECLARATION");
      push({ role: "agent", text: `**${RISK_DECL_QUESTIONS[0].text}**`, options: ["Yes", "No"] });
      return;
    }
    const [next, ...rest] = remaining;
    setData(d => ({ ...d, docChecklist: rest, pendingDocType: next }));
    setStep("DOCS_ATTACH");
    push({ role: "agent", text: `Please attach the **${DOC_TYPE_LABELS[next] ?? next}**. Accepted: PDF, JPG, PNG (max 10MB).`, options: ["⏭️ Skip this document"] });
  }

  function advanceDocChecklist() {
    advanceDocChecklistFrom(data.docChecklist);
  }

  function askDocType() {
    setData(d => ({ ...d, docChecklist: undefined }));
    setStep("DOCS_TYPE");
    push({ role: "agent", text: "Which **document type** would you like to add?", options: AD_HOC_DOC_OPTIONS });
  }

  async function doUploadDoc(file: File) {
    const sid = data.docSupplierId || data.supplierId;
    const docType = data.pendingDocType;
    const sname = data.docSupplierName || data.supplierName || "this supplier";
    if (!sid || !docType) { goMenu(); return; }

    push({ role: "user", text: `📎 ${file.name}` });
    push({ role: "loading", text: "Uploading and running automated checks…" });
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", docType);
      form.append("name", `${DOC_TYPE_LABELS[docType] ?? docType} — ${sname}`);
      const res = await fetch(`/api/suppliers/${sid}/documents/upload`, { method: "POST", body: form });
      const d = await res.json();
      setMessages(p => p.filter(m => m.role !== "loading"));

      if (!res.ok) {
        push({ role: "error", text: (d.error as string) || "Upload failed. Please try again or type 'skip'." });
        return;
      }

      const notes = ((d.scan?.notes as string[]) ?? []).map(n => `  • ${n}`).join("\n");
      push({
        role: d.scan?.passed ? "success" : "error",
        text: `${d.scan?.passed ? "✅" : "⚠️"} **${DOC_TYPE_LABELS[docType] ?? docType}** uploaded.\n\n**Automated checks:**\n${notes}\n\n_Format/consistency checks only — not proof the document is authentic. A human reviewer should still confirm that from the supplier detail page._`,
      });
      onRefresh?.();
      advanceDocChecklist();
    } finally {
      setBusy(false);
    }
  }

  async function doRiskDeclarationAnswer(text: string) {
    const idx = data.riskDeclIdx ?? 0;
    const q = RISK_DECL_QUESTIONS[idx];
    if (!q) { await finishRiskAssessment(); return; }
    const yes = /^y(es)?$/i.test(text.trim()) || text.toLowerCase().includes("yes");
    const no = /^n(o)?$/i.test(text.trim()) || text.toLowerCase().includes("no");
    if (!yes && !no) { push({ role: "agent", text: "Please answer **Yes** or **No**.", options: ["Yes", "No"] }); return; }

    const answers = { ...(data.riskDeclarations ?? {}), [q.key]: yes };
    const nextIdx = idx + 1;
    if (nextIdx >= RISK_DECL_QUESTIONS.length) {
      setData(d => ({ ...d, riskDeclarations: answers }));
      await finishRiskAssessment(answers);
    } else {
      setData(d => ({ ...d, riskDeclarations: answers, riskDeclIdx: nextIdx }));
      push({ role: "agent", text: `**${RISK_DECL_QUESTIONS[nextIdx].text}**`, options: ["Yes", "No"] });
    }
  }

  async function finishRiskAssessment(answers?: Record<string, boolean>) {
    const sid = data.supplierId;
    if (!sid) { goMenu(); return; }
    push({ role: "loading", text: "Saving risk declaration and computing risk assessment…" });
    const { ok, data: rd } = await api<{ breakdown: RiskBreakdownT }>(`/api/suppliers/${sid}/risk-declarations`, "POST", {
      riskDeclarations: answers ?? data.riskDeclarations ?? {},
    });
    setMessages(p => p.filter(m => m.role !== "loading"));
    onRefresh?.();
    if (!ok || !rd.breakdown) { push({ role: "error", text: "Could not complete the risk assessment." }); goMenu(); return; }
    push({ role: "success", text: renderRiskText(data.supplierName ?? "this supplier", rd.breakdown) });
    goMenu();
  }

  async function doExplainRisk(query: string) {
    push({ role: "loading", text: "Looking up supplier…" });
    const { data: d } = await api<{ suppliers: { id: string; name: string }[] }>(`/api/suppliers?q=${encodeURIComponent(query)}`);
    setMessages(p => p.filter(m => m.role !== "loading"));
    const sups = d.suppliers ?? [];
    if (!sups.length) { push({ role: "agent", text: `No supplier found matching **"${query}"**.` }); goMenu(); return; }
    const sup = sups[0];

    push({ role: "loading", text: `Computing risk assessment for ${sup.name}…` });
    const { ok, data: rd } = await api<{ breakdown: RiskBreakdownT }>(`/api/suppliers/${sup.id}/risk-assessment`, "POST");
    setMessages(p => p.filter(m => m.role !== "loading"));
    if (!ok || !rd.breakdown) { push({ role: "error", text: "Could not compute a risk assessment for this supplier." }); goMenu(); return; }

    push({ role: "agent", text: renderRiskText(sup.name, rd.breakdown) });
    goMenu();
  }

  async function doFindSupplierForDoc(query: string) {
    push({ role: "loading", text: "Looking up supplier…" });
    const { data: d } = await api<{ suppliers: { id: string; name: string; code: string }[] }>(`/api/suppliers?q=${encodeURIComponent(query)}`);
    setMessages(p => p.filter(m => m.role !== "loading"));
    const sups = d.suppliers ?? [];

    if (!sups.length) {
      push({ role: "agent", text: `No supplier found matching **"${query}"**. Please try the supplier code (e.g. SUP-001) or exact name.` });
      return;
    }

    const sup = sups[0];
    setData(d2 => ({ ...d2, docSupplierId: sup.id, docSupplierName: sup.name, docChecklist: undefined }));
    setStep("DOCS_TYPE");
    push({
      role: "agent",
      text: `Adding document to **${sup.name}**.\n\nWhich **document type** would you like to add?`,
      options: AD_HOC_DOC_OPTIONS,
    });
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

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    await doUploadDoc(file);
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
                      <div className={`text-xs leading-relaxed px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm whitespace-pre-wrap ${
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
            {step === "DOCS_ATTACH" ? (
              <label className="flex items-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#1A2A52] transition-colors">
                <Upload className="size-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500 truncate flex-1">{busy ? "Uploading…" : "Click to attach a PDF, JPG, or PNG (max 10MB)"}</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  disabled={busy}
                  onChange={handleFileInput}
                />
              </label>
            ) : (
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
                    step === "MENU"          ? "Type 1–6 or use buttons above…" :
                    step === "RISK_DECLARATION" ? "Yes or No" :
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
            )}
            <p className="text-[10px] text-gray-400 mt-1 text-center">{step === "DOCS_ATTACH" ? "Or type skip to come back to this later" : "Enter to send · Buttons for quick replies"}</p>
          </div>
        </div>
      )}
    </>
  );
}
