
"use client";

import {
  CheckCircle2, FileText, Package, ShoppingCart,
  Shield, Zap, ArrowRight, Plus,
} from "lucide-react";
import Link from "next/link";

export default function IntakePage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">

      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">New Purchase Request</h1>
          <p className="text-xs text-gray-400 mt-0.5">Submit a request and track it through approval to PO</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/requisitions"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1A2A52] transition-colors">
            <FileText className="size-4" /> View requisitions
          </Link>
          <Link href="/dashboard/purchase-orders"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1A2A52] transition-colors">
            <Package className="size-4" /> Purchase orders
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Start CTA */}
        <div className="flex-1 p-6 flex flex-col items-center justify-center min-w-0" style={{ maxWidth: 640 }}>
          <div className="size-16 rounded-2xl bg-[#1A2A52]/8 flex items-center justify-center mb-5">
            <FileText className="size-7 text-[#1A2A52]" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1.5">Start a new request</h2>
          <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
            Fill in what you need — the form adapts to your category and captures everything approvers need to review it.
          </p>
          <Link href="/dashboard/intake/form"
            className="flex items-center gap-2 bg-[#1A2A52] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#243766] transition-colors">
            <Plus className="size-4" /> New request
          </Link>
        </div>

        {/* RIGHT: Info panel */}
        <div className="w-80 bg-white border-l border-gray-100 flex flex-col overflow-y-auto shrink-0">

          {/* Procurement flow */}
          <div className="p-6 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">How it works</p>
            <div className="space-y-4">
              {[
                {
                  icon: FileText, color: "bg-blue-50 text-blue-600",
                  title: "1. Intake",
                  desc: "Tell Aria what you need. It searches suppliers, collects quantities & prices, and builds the requisition.",
                },
                {
                  icon: CheckCircle2, color: "bg-amber-50 text-amber-600",
                  title: "2. Approval",
                  desc: "Requisition is submitted for approval. Approvers review and sign off based on amount & category rules.",
                },
                {
                  icon: ShoppingCart, color: "bg-emerald-50 text-emerald-600",
                  title: "3. Purchase Order",
                  desc: "Once approved, Aria generates the PO and sends it directly to the supplier.",
                },
              ].map(s => (
                <div key={s.title} className="flex items-start gap-3">
                  <div className={`size-9 rounded-xl ${s.color} flex items-center justify-center shrink-0 mt-0.5`}>
                    <s.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Approval rules */}
          <div className="p-6 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Approval thresholds</p>
            <div className="space-y-2">
              {[
                { range: "Up to ₹5 Lakh",    route: "Manager only",              color: "bg-green-100 text-green-700"  },
                { range: "₹5L – ₹25L",       route: "Manager + Finance",         color: "bg-amber-100 text-amber-700"  },
                { range: "Above ₹25L",        route: "Manager + Director + Finance", color: "bg-red-100 text-red-700"  },
              ].map(r => (
                <div key={r.range} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                  <span className="text-xs font-semibold text-gray-800">{r.range}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.color}`}>{r.route}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="p-6 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aria can</p>
            <div className="space-y-2">
              {[
                "Search your supplier directory",
                "Build line items from plain English",
                "Calculate GST automatically",
                "Submit for approval instantly",
                "Approve requisitions",
                "Generate Purchase Orders",
                "Check status anytime",
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-700">
                  <Zap className="size-3 text-[#C8A04D] shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="p-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick actions</p>
            <div className="space-y-2">
              {[
                { href: "/dashboard/requisitions",  label: "View all requisitions",  icon: FileText    },
                { href: "/dashboard/approvals",     label: "Pending approvals",      icon: CheckCircle2 },
                { href: "/dashboard/purchase-orders",label: "Purchase orders",       icon: Package      },
                { href: "/dashboard/suppliers",     label: "Supplier directory",     icon: Shield       },
              ].map(l => (
                <Link key={l.href} href={l.href}
                  className="flex items-center gap-2.5 text-xs text-gray-600 hover:text-[#1A2A52] hover:bg-gray-50 px-3 py-2.5 rounded-xl transition-all group">
                  <l.icon className="size-4 text-gray-400 group-hover:text-[#1A2A52] transition-colors" />
                  <span className="flex-1">{l.label}</span>
                  <ArrowRight className="size-3 text-gray-300 group-hover:text-[#1A2A52]" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
