"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MessageSquarePlus,
  Building2,
  CheckSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "REQUESTOR" | "APPROVER" | "PROCUREMENT" | "ADMIN";

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["REQUESTOR", "APPROVER", "PROCUREMENT", "ADMIN"] },
  { href: "/dashboard/intake", label: "New Request", icon: MessageSquarePlus, roles: ["REQUESTOR", "APPROVER", "PROCUREMENT", "ADMIN"] },
  { href: "/dashboard/requisitions", label: "Requisitions", icon: FileText, roles: ["REQUESTOR", "APPROVER", "PROCUREMENT", "ADMIN"] },
  { href: "/dashboard/approvals", label: "My Approvals", icon: CheckSquare, roles: ["APPROVER", "PROCUREMENT", "ADMIN"] },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: Building2, roles: ["PROCUREMENT", "ADMIN"] },
  { href: "/dashboard/admin", label: "Admin", icon: Settings, roles: ["ADMIN"] },
];

export function Sidebar({ role, name, email, organizationName }: { role: Role; name: string; email: string; organizationName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <aside className="w-60 shrink-0 bg-[#0B0F19] text-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
        <div className="size-7 rounded bg-gradient-to-br from-[#1A2A52] to-[#C8A04D] shrink-0" />
        <div className="min-w-0">
          <span className="font-semibold tracking-tight block leading-tight">Veltriance</span>
          <span className="text-[11px] text-white/40 truncate block leading-tight">{organizationName}</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? "bg-white/10 text-white font-medium" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-white/40 truncate">{email}</p>
          <span className="inline-block mt-1.5 text-[10px] font-medium uppercase tracking-wide text-[#C8A04D] bg-[#C8A04D]/10 px-2 py-0.5 rounded-full">
            {role.toLowerCase()}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
