"use client";
import CsvUploadModal, { CsvUploadConfig } from "@/components/CsvUploadModal";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

type Requisition = {
  id: string;
  requisitionNumber: string;
  title: string;
  status: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  requestor: { name: string };
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-500 border-gray-200",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  MANAGER_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  DIRECTOR_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  PROCUREMENT_REVIEW: "bg-purple-50 text-purple-700 border-purple-200",
  FINANCE_APPROVAL: "bg-purple-50 text-purple-700 border-purple-200",
  ERP_SYNC_PENDING: "bg-indigo-50 text-indigo-700 border-indigo-200",
  COMPLETED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function RequisitionsPage() {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/requisitions?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => setRequisitions(d.requisitions ?? []))
      .finally(() => setLoading(false));
  }, [scope]);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Requisitions</h1>
          <p className="text-sm text-gray-500 mt-1">Track requests from draft through to completion.</p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
          <button
            onClick={() => setScope("mine")}
            className={`px-3 py-1.5 rounded-md transition-colors ${scope === "mine" ? "bg-white shadow-sm font-medium text-gray-900" : "text-gray-500"}`}
          >
            Mine
          </button>
          <button
            onClick={() => setScope("all")}
            className={`px-3 py-1.5 rounded-md transition-colors ${scope === "all" ? "bg-white shadow-sm font-medium text-gray-900" : "text-gray-500"}`}
          >
            All
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 px-5 py-8 text-center">Loading…</p>
        ) : requisitions.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <FileText className="size-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No requisitions yet.</p>

            <button onClick={() => setShowReqUpload(true)} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5 mr-2"><svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>Upload CSV</button>            <Link href="/dashboard/intake" className="text-sm text-[#1A2A52] font-medium hover:underline mt-1 inline-block">
              Submit your first request
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Requestor</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-5 py-3.5">
                    <Link href={`/dashboard/requisitions/${r.id}`} className="font-medium text-[#1A2A52] hover:underline">
                      {r.requisitionNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">{r.title}</td>
                  <td className="px-5 py-3.5 text-gray-500">{r.requestor.name}</td>
                  <td className="px-5 py-3.5 text-gray-700">
                    {r.currency} {Number(r.totalAmount).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[r.status] ?? ""}`}>
                      {r.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showReqUpload && (
        <CsvUploadModal
          config={{
            title: "Bulk Upload Requisitions",
            description: "Import purchase requisitions from CSV. All start as DRAFT status.",
            endpoint: "/api/upload/requisitions",
            templateName: "veltriance_requisitions_template",
            headers: ["title","category","amount","priority","department","justification","supplier","glAccount","quantity","deliveryLocation"],
            requiredHeaders: ["title","amount"],
            exampleRows: [
              ["MacBook Pro 14-inch for Engineering","IT Hardware","142000","HIGH","Engineering","Required for new hire","Lenovo India","6100","1","Ace HQ Bengaluru"],
              ["Adobe Creative Cloud 10 seats","Software & Licenses","180000","MEDIUM","Marketing","Required for design team","Adobe Systems","6200","1",""],
              ["Ergonomic Chairs 20 units","Facilities & Infra","72000","LOW","HR","New office setup","","6500","20",""],
            ],
          }}
          onClose={() => setShowReqUpload(false)}
          onSuccess={() => { setShowReqUpload(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}
