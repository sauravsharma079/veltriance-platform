"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, Star } from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  status: "ACTIVE" | "PENDING_APPROVAL" | "BLOCKED" | "INACTIVE";
  preferred: boolean;
  rating: number | null;
  contactEmail: string | null;
};

const STATUS_STYLES: Record<Supplier["status"], string> = {
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  BLOCKED: "bg-red-50 text-red-700 border-red-200",
  INACTIVE: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = useCallback(async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/suppliers?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setSuppliers(data.suppliers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => fetchSuppliers(q), 250);
    return () => clearTimeout(timeout);
  }, [q, fetchSuppliers]);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Search the supplier master or request a new one.</p>
        </div>
        <Link
          href="/dashboard/suppliers/new"
          className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#243766] transition-colors"
        >
          <Plus className="size-4" />
          Request new supplier
        </Link>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, category, or code…"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-[#1A2A52] focus:ring-1 focus:ring-[#1A2A52]"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 px-5 py-8 text-center">Loading suppliers…</p>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-gray-400 px-5 py-8 text-center">
            No suppliers found. {q && "Try a different search, or "}
            <Link href="/dashboard/suppliers/new" className="text-[#1A2A52] font-medium hover:underline">
              request a new one
            </Link>
            .
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Supplier</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Rating</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {s.preferred && <Star className="size-3.5 fill-[#C8A04D] text-[#C8A04D]" />}
                      <span className="font-medium text-gray-900">{s.name}</span>
                    </div>
                    {s.contactEmail && <p className="text-xs text-gray-400 mt-0.5">{s.contactEmail}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{s.category ?? "—"}</td>
                  <td className="px-5 py-3.5 text-gray-600">{s.rating ? s.rating.toFixed(1) : "—"}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[s.status]}`}
                    >
                      {s.status.replace("_", " ").toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
