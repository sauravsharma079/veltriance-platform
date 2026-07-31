"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { X, Send, Sparkles, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = { role: "agent" | "user"; text: string };
type QuickAction = { label: string; description: string; href?: string; action?: () => void };

// ─── Context knowledge base ───────────────────────────────────────────────────

function getPageContext(pathname: string) {
  if (pathname === "/dashboard") return {
    page: "Procurement Overview",
    greeting: "Here's your procurement dashboard. I can help you navigate or take action.",
    actions: [
      { label: "New purchase request",    description: "Start a requisition",          href: "/dashboard/intake" },
      { label: "View pending approvals",  description: "Items waiting on you",          href: "/dashboard/approvals" },
      { label: "Check purchase orders",   description: "Track active POs",              href: "/dashboard/purchase-orders" },
      { label: "Manage suppliers",        description: "View supplier directory",       href: "/dashboard/suppliers" },
    ],
  };
  if (pathname.startsWith("/dashboard/intake/form")) return {
    page: "New Purchase Request",
    greeting: "I'll guide you through this form step by step.",
    actions: [
      { label: "Step 1 — Header",    description: "Title, priority, dates, delivery" },
      { label: "Step 2 — Line items",description: "Items, supplier, GL coding" },
      { label: "Step 3 — Review",    description: "Check everything before submitting" },
      { label: "What is GL coding?", description: "Explain the chart of accounts" },
    ],
  };
  if (pathname.startsWith("/dashboard/intake")) return {
    page: "Intake",
    greeting: "Ready to raise a new purchase request?",
    actions: [
      { label: "Fill out a form",       description: "Structured intake with all fields", href: "/dashboard/intake/form" },
      { label: "What gets approved?",   description: "Explain the approval flow" },
      { label: "Who approves my req?",  description: "How approval chains work" },
    ],
  };
  if (pathname.match(/\/dashboard\/requisitions\/[^/]+$/)) return {
    page: "Requisition Detail",
    greeting: "Viewing this requisition. I can explain statuses or next steps.",
    actions: [
      { label: "What does PENDING mean?",  description: "Requisition status guide" },
      { label: "How does approval work?",  description: "Approval chain walkthrough" },
      { label: "When is a PO created?",    description: "After final approval" },
      { label: "Back to all requests",     description: "Return to list", href: "/dashboard/requisitions" },
    ],
  };
  if (pathname.startsWith("/dashboard/requisitions")) return {
    page: "Purchase Requests",
    greeting: "All your purchase requests are here.",
    actions: [
      { label: "Create a new request",  description: "Start the intake process",   href: "/dashboard/intake" },
      { label: "What are statuses?",    description: "Explain DRAFT, PENDING, APPROVED" },
      { label: "Filter by status",      description: "Use the filter bar at the top" },
      { label: "How long does approval take?", description: "Depends on your approval chain" },
    ],
  };
  if (pathname.match(/\/dashboard\/purchase-orders\/[^/]+\/print/)) return {
    page: "PO PDF Preview",
    greeting: "This is the print view of your purchase order.",
    actions: [
      { label: "Download as PDF",       description: "Use browser print → Save as PDF" },
      { label: "What's on this PO?",    description: "Explain PO sections" },
    ],
  };
  if (pathname.match(/\/dashboard\/purchase-orders\/[^/]+$/)) return {
    page: "Purchase Order Detail",
    greeting: "Reviewing this PO. I can help you send it or understand its status.",
    actions: [
      { label: "How to send a PO?",     description: "Routing it to the supplier" },
      { label: "Download as PDF",       description: "Click the Download PDF button above" },
      { label: "What is DRAFT status?", description: "PO needs review before sending" },
      { label: "Back to all POs",       description: "Return to list", href: "/dashboard/purchase-orders" },
    ],
  };
  if (pathname.startsWith("/dashboard/purchase-orders")) return {
    page: "Purchase Orders",
    greeting: "Your purchase orders live here — drafts, sent, and completed.",
    actions: [
      { label: "How are POs created?",  description: "Auto-created on requisition approval" },
      { label: "Send a draft PO",       description: "Open the PO and click Send" },
      { label: "What does SENT mean?",  description: "PO has been emailed to supplier" },
      { label: "Download PDF",          description: "Open any PO and click Download PDF" },
    ],
  };
  if (pathname.startsWith("/dashboard/suppliers/new")) return {
    page: "Add Supplier",
    greeting: "Let's add a new supplier to your directory.",
    actions: [
      { label: "Required fields",       description: "Name and email are the minimum" },
      { label: "What is a tier?",       description: "Preferred, Approved, or Restricted" },
      { label: "What is risk score?",   description: "0–100 vendor risk assessment" },
    ],
  };
  if (pathname.match(/\/dashboard\/suppliers\/[^/]+$/)) return {
    page: "Supplier Profile",
    greeting: "Viewing this supplier's full profile.",
    actions: [
      { label: "Edit supplier details", description: "Click any field to edit" },
      { label: "Add contacts",          description: "Scroll to Contacts section" },
      { label: "View their POs",        description: "Recent POs section at the bottom" },
      { label: "Mark as preferred",     description: "Toggle the Preferred switch" },
    ],
  };
  if (pathname.startsWith("/dashboard/suppliers")) return {
    page: "Suppliers",
    greeting: "Your supplier directory. I can help you find or add a supplier.",
    actions: [
      { label: "Add a supplier",        description: "Register a new vendor", href: "/dashboard/suppliers/new" },
      { label: "What is Preferred?",    description: "Preferred vs approved suppliers" },
      { label: "Pending approval",      description: "Suppliers waiting for review" },
      { label: "Risk levels",           description: "Low / Medium / High risk explained" },
    ],
  };
  if (pathname.startsWith("/dashboard/approvals")) return {
    page: "Approvals",
    greeting: "Items awaiting your decision.",
    actions: [
      { label: "How to approve?",       description: "Click Approve on a requisition" },
      { label: "How to reject?",        description: "Add a comment and reject" },
      { label: "What happens after?",   description: "Approval triggers PO creation" },
      { label: "Approval chain setup",  description: "Admin → Approval chains", href: "/dashboard/admin" },
    ],
  };
  if (pathname.startsWith("/dashboard/admin")) return {
    page: "Admin",
    greeting: "Workspace configuration. What would you like to set up?",
    actions: [
      { label: "Set up Chart of Accounts", description: "Admin → Chart of accounts tab" },
      { label: "Create lookup types",       description: "Admin → Lookups tab" },
      { label: "Configure approvals",       description: "Admin → Approval chains tab" },
      { label: "Invite a team member",      description: "Admin → Invite tab" },
    ],
  };
  return {
    page: "Dashboard",
    greeting: "How can I help you with procurement today?",
    actions: [
      { label: "Create a request",      description: "Start a new purchase request", href: "/dashboard/intake" },
      { label: "View requests",         description: "All requisitions",             href: "/dashboard/requisitions" },
      { label: "Purchase orders",       description: "Track POs",                    href: "/dashboard/purchase-orders" },
      { label: "Admin settings",        description: "Configure workspace",           href: "/dashboard/admin" },
    ],
  };
}

// ─── Rule-based NLU ──────────────────────────────────────────────────────────

function respond(msg: string, pathname: string): string {
  const m = msg.toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|sup|yo)\b/.test(m))
    return "Hello! I'm your Veltriance assistant. I can help you create requisitions, understand PO statuses, configure your workspace, or navigate to any page. What do you need?";

  // Requisitions
  if (m.includes("create") && (m.includes("req") || m.includes("request") || m.includes("purchase")))
    return "To create a purchase request, go to **New Request** in the sidebar or click the button at the top of any page. The form has three steps: Header (title, dates, delivery), Line items (items + supplier + GL coding), and Review. Each line item needs a supplier selected — that's mandatory.";

  if (m.includes("status") && (m.includes("req") || m.includes("request")))
    return "Requisition statuses:\n\n• **DRAFT** — Saved but not submitted\n• **PENDING_APPROVAL** — Submitted, awaiting approvers\n• **APPROVED** — All approved, PO auto-created\n• **REJECTED** — Declined with comment\n• **PO_CREATED** — Converted to a Purchase Order";

  // POs
  if (m.includes("po") || m.includes("purchase order")) {
    if (m.includes("create") || m.includes("how"))
      return "Purchase Orders are **auto-created** when a requisition is fully approved — you don't create them manually. Once created, go to Purchase Orders in the sidebar, open the draft PO, review it, then click **Send to Supplier**.";
    if (m.includes("status"))
      return "PO statuses:\n\n• **DRAFT** — Created, not sent yet\n• **SENT** — Emailed to supplier\n• **ACKNOWLEDGED** — Supplier confirmed\n• **RECEIVED** — Goods/services received\n• **CLOSED** — Fully complete";
    if (m.includes("pdf") || m.includes("download"))
      return "Open any Purchase Order and click **Download PDF** in the top right. This opens a print-optimised view — use your browser's print dialog and choose 'Save as PDF'.";
    return "Purchase Orders are auto-generated when requisitions are approved. Go to the **Purchase Orders** tab in the sidebar to see all your POs.";
  }

  // Approval
  if (m.includes("approv")) {
    if (m.includes("how") || m.includes("work") || m.includes("process"))
      return "The approval flow works like this:\n\n1. User submits a requisition\n2. The approval chain matches based on amount, category, or department\n3. Each approver gets a notification\n4. Once all steps approve, the PO is auto-created\n\nSet up approval chains in **Admin → Approval chains**.";
    if (m.includes("chain") || m.includes("setup") || m.includes("configure"))
      return "Go to **Admin → Approval chains** tab. Create a rule with conditions (amount range, category, department) and add sequential approval steps. Each step can be a Manager, Director, Procurement, Finance, or a named custom approver.";
    return "Go to the **Approvals** tab in the sidebar to see items waiting for your action.";
  }

  // COA / GL
  if (m.includes("coa") || m.includes("chart of account") || (m.includes("gl") && m.includes("account"))) {
    if (m.includes("setup") || m.includes("create") || m.includes("how"))
      return "Go to **Admin → Chart of accounts**. Create a COA with a name and company code, then define up to 5 named segments (e.g. Business Area, GL Account, Cost Center). Link segments to Lookup types so dropdowns populate automatically in requisition forms.";
    return "Chart of Accounts is configured under **Admin → Chart of accounts**. Each COA can have up to 5 custom-named segments linked to your Lookup values.";
  }

  // Lookups
  if (m.includes("lookup")) {
    if (m.includes("create") || m.includes("add"))
      return "Go to **Admin → Lookups**. Click **New lookup type**, name it (e.g. 'Cost Center'), and it creates a card. Expand it, click **Add values**, then enter Code + Label pairs one at a time or bulk-import via the textarea (format: `CODE, Label` per line).";
    return "Lookups are configured under **Admin → Lookups**. Create types like Cost Center, Department, or GL Account, then add values that power the dropdowns in your forms.";
  }

  // Suppliers
  if (m.includes("supplier") || m.includes("vendor")) {
    if (m.includes("add") || m.includes("create") || m.includes("new"))
      return "Go to **Suppliers → Add supplier** in the sidebar. Fill in the supplier name, contact email, and payment terms. You can also set a tier (Preferred/Approved/Restricted) and risk score. New suppliers go through an approval workflow before they're active.";
    if (m.includes("prefer"))
      return "A **Preferred supplier** has been vetted and is the first choice for procurement. Toggle the Preferred switch on any supplier's profile page to mark them. Preferred suppliers show first in the requisition form's supplier search.";
    return "Go to **Suppliers** in the sidebar to view and manage your vendor directory.";
  }

  // Users / invitations
  if (m.includes("invite") || (m.includes("add") && m.includes("user")) || m.includes("team member"))
    return "Go to **Admin → Invite** tab. Enter the person's name, email, and assign them a role:\n\n• **Requestor** — Can create requisitions\n• **Approver** — Can approve requisitions\n• **Procurement** — Can manage POs and suppliers\n• **Admin** — Full workspace access";

  if (m.includes("role") || m.includes("permission"))
    return "Roles in Veltriance:\n\n• **Requestor** — Create and track requisitions\n• **Approver** — Approve or reject requisitions\n• **Procurement** — Manage POs, suppliers, and all requests\n• **Admin** — Everything, plus user and workspace management";

  // Help
  if (m.includes("help") || m.includes("what can you") || m.includes("?"))
    return "I can help you with:\n\n• Creating purchase requests\n• Understanding PO statuses\n• Setting up approval chains\n• Configuring Chart of Accounts\n• Managing suppliers and users\n• Navigating the platform\n\nJust ask me anything!";

  return "I'm not sure I understood that. Try asking about creating a requisition, setting up approvals, configuring your Chart of Accounts, or managing suppliers. You can also type **help** to see what I can assist with.";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PageAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const pathname = usePathname();
  const ctx = getPageContext(pathname);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fresh greeting when page changes
  useEffect(() => {
    setMessages([{ role: "agent", text: ctx.greeting }]);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Admin and supplier pages have their own dedicated agents
  if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/suppliers")) return null;

  function send() {
    const text = input.trim();
    if (!text) return;
    const reply = respond(text, pathname);
    setMessages(m => [...m, { role: "user", text }, { role: "agent", text: reply }]);
    setInput("");
  }

  function renderText(text: string) {
    // Bold (**...**) and bullet points
    return text.split("\n").map((line, i) => {
      const parts = line.split(/\*\*([^*]+)\*\*/g);
      return (
        <p key={i} className={line.startsWith("•") ? "flex gap-1.5" : ""}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : <span key={j}>{part}</span>
          )}
        </p>
      );
    });
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-40 size-13 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open ? "bg-gray-700 rotate-45" : "bg-gradient-to-br from-[#1A2A52] to-[#2D5A9B] hover:scale-105"
        }`}
        style={{ width: 52, height: 52 }}
        aria-label="Open assistant">
        {open
          ? <X className="size-5 text-white" />
          : <Sparkles className="size-5 text-white" />
        }
        {/* Pulse ring */}
        {!open && (
          <span className="absolute inset-0 rounded-full ring-4 ring-[#1A2A52]/30 animate-ping" style={{ animationDuration: "2.5s" }} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ maxHeight: "min(520px, calc(100vh - 120px))" }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-[#1A2A52] to-[#2D5A9B] px-4 py-3 flex items-center gap-3">
            <div className="size-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Sparkles className="size-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">Veltriance Assistant</p>
              <p className="text-[10px] text-white/60 truncate">{ctx.page}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors">
              <X className="size-4" />
            </button>
          </div>

          {/* Quick actions */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">Quick actions</p>
            {ctx.actions.map((a, i) => (
              a.href ? (
                <Link key={i} href={a.href} onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1A2A52]/5 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 group-hover:text-[#1A2A52]">{a.label}</p>
                    <p className="text-[10px] text-gray-400">{a.description}</p>
                  </div>
                  <ExternalLink className="size-3 text-gray-300 group-hover:text-[#1A2A52] shrink-0 ml-2" />
                </Link>
              ) : (
                <button key={i} onClick={() => {
                  const reply = respond(a.label, pathname);
                  setMessages(m => [...m, { role: "user", text: a.label }, { role: "agent", text: reply }]);
                }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1A2A52]/5 transition-colors group text-left">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 group-hover:text-[#1A2A52]">{a.label}</p>
                    <p className="text-[10px] text-gray-400">{a.description}</p>
                  </div>
                  <ChevronRight className="size-3 text-gray-300 group-hover:text-[#1A2A52] shrink-0 ml-2" />
                </button>
              )
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "agent" && (
                  <div className="size-6 rounded-full bg-gradient-to-br from-[#1A2A52] to-[#2D5A9B] flex items-center justify-center shrink-0 mr-1.5 mt-0.5">
                    <Sparkles className="size-3 text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed space-y-0.5 ${
                  msg.role === "user"
                    ? "bg-[#1A2A52] text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}>
                  {renderText(msg.text)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-[#1A2A52] focus-within:ring-1 focus-within:ring-[#1A2A52]/20 transition-all">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask me anything…"
                className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-400" />
              <button onClick={send} disabled={!input.trim()}
                className="size-6 rounded-lg bg-[#1A2A52] flex items-center justify-center disabled:opacity-30 transition-opacity shrink-0">
                <Send className="size-3 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
