"use client";

import { useEffect, useState } from "react";
import { Users, Building2 } from "lucide-react";

type AdminUser = { id: string; name: string; email: string; role: string; department: string | null };
type PendingSupplier = { id: string; name: string; category: string | null; businessJustification: string | null; requestedBy: { name: string; email: string } | null };

const ROLES = ["REQUESTOR", "APPROVER", "PROCUREMENT", "ADMIN"];

export default function AdminPage() {
  const [tab, setTab] = useState<"users" | "suppliers">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [suppliers, setSuppliers] = useState<PendingSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  function loadUsers() {
    fetch("/api/admin/users").then((r) => r.json()).then((d) => setUsers(d.users ?? []));
  }
  function loadSuppliers() {
    fetch("/api/suppliers?status=PENDING_APPROVAL").then((r) => r.json()).then((d) => setSuppliers(d.suppliers ?? []));
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadUsers(), loadSuppliers()]).finally(() => setLoading(false));
  }, []);

  async function updateRole(id: string, role: string) {
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, role } : x)));
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
  }

  async function decideSupplier(id: string, status: "ACTIVE" | "BLOCKED") {
    setSuppliers((s) => s.filter((x) => x.id !== id));
    await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">Manage user roles and review pending supplier requests.</p>

      <div className="flex gap-2 mb-5">
        <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={Users} label="Users" count={users.length} />
        <TabButton active={tab === "suppliers"} onClick={() => setTab("suppliers")} icon={Building2} label="Pending suppliers" count={suppliers.length} />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : tab === "users" ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Department</th>
                <th className="px-5 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{u.department ?? "—"}</td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#1A2A52]"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
              No suppliers waiting for review.
            </p>
          ) : (
            suppliers.map((s) => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.category} · requested by {s.requestedBy?.name ?? "unknown"}</p>
                  </div>
                </div>
                {s.businessJustification && (
                  <p className="text-sm text-gray-600 mt-2.5">{s.businessJustification}</p>
                )}
                <div className="flex gap-2 mt-3.5">
                  <button
                    onClick={() => decideSupplier(s.id, "ACTIVE")}
                    className="bg-green-600 text-white text-xs font-medium px-3.5 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decideSupplier(s.id, "BLOCKED")}
                    className="bg-white border border-red-200 text-red-600 text-xs font-medium px-3.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label, count,
}: { active: boolean; onClick: () => void; icon: typeof Users; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-[#1A2A52] text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
      <span className={`text-xs px-1.5 rounded-full ${active ? "bg-white/20" : "bg-gray-100"}`}>{count}</span>
    </button>
  );
}
