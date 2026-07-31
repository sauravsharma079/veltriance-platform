
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, MessageSquarePlus, Building2,
  CheckSquare, Settings, LogOut, ShoppingCart, Search,
  Plug, Code2, Package,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NotificationCenter } from "@/components/NotificationCenter";

type Role = "REQUESTOR" | "APPROVER" | "PROCUREMENT" | "ADMIN";

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { href: "/dashboard",                 label: "Overview",        icon: LayoutDashboard,   roles: ["REQUESTOR","APPROVER","PROCUREMENT","ADMIN"] },
  { href: "/dashboard/intake",          label: "New Request",     icon: MessageSquarePlus, roles: ["REQUESTOR","APPROVER","PROCUREMENT","ADMIN"] },
  { href: "/dashboard/requisitions",    label: "Requisitions",    icon: FileText,          roles: ["REQUESTOR","APPROVER","PROCUREMENT","ADMIN"] },
  { href: "/dashboard/approvals",       label: "My Approvals",    icon: CheckSquare,       roles: ["APPROVER","PROCUREMENT","ADMIN"] },
  { href: "/dashboard/suppliers",       label: "Suppliers",       icon: Building2,         roles: ["REQUESTOR","APPROVER","PROCUREMENT","ADMIN"] },
  { href: "/dashboard/catalogs",        label: "Catalogs",        icon: Package,           roles: ["REQUESTOR","APPROVER","PROCUREMENT","ADMIN"] },
  { href: "/dashboard/purchase-orders", label: "Purchase Orders", icon: ShoppingCart,      roles: ["PROCUREMENT","ADMIN"] },
];

const CONFIG_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { href: "/dashboard/integrations",   label: "Connections",  icon: Plug,     roles: ["PROCUREMENT","ADMIN"] },
  { href: "/dashboard/developer",      label: "Developer",    icon: Code2,    roles: ["ADMIN"] },
  { href: "/dashboard/admin",          label: "Admin",        icon: Settings, roles: ["ADMIN"] },
];

export function Sidebar({ role, name, email, organizationName }: {
  role: Role; name: string; email: string; organizationName: string;
}) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function openSearch() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  }

  const navItems    = NAV_ITEMS.filter(i => i.roles.includes(role));
  const configItems = CONFIG_ITEMS.filter(i => i.roles.includes(role));

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-60 shrink-0 bg-[#0B0F19] text-white flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-gradient-to-br from-[#1A2A52] to-[#C8A04D] shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold tracking-tight text-sm leading-tight">Veltriance</p>
            <p className="text-[10px] text-white/40 truncate leading-tight">{organizationName}</p>
          </div>
        </div>
        <div className="flex items-center">
          <NotificationCenter />
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5">
        <button onClick={openSearch}
          className="w-full flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-xl px-3 py-2 text-sm text-white/40 hover:text-white/60">
          <Search className="size-3.5" />
          <span className="flex-1 text-left text-xs">Search…</span>
          <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Main nav */}
      <nav className="px-3 space-y-0.5">
        {navItems.map(item => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${active ? "bg-white/10 text-white font-medium" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
              <Icon className="size-4" />{item.label}
            </Link>
          );
        })}
      </nav>

      {/* Config nav */}
      {configItems.length > 0 && (
        <div className="px-3 mt-4">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-3 mb-1.5">Configuration</p>
          <div className="space-y-0.5">
            {configItems.map(item => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${active ? "bg-white/10 text-white font-medium" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
                  <Icon className="size-4" />{item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* User */}
      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="size-7 rounded-full bg-[#1A2A52] flex items-center justify-center text-xs font-bold text-[#C8A04D] shrink-0">
            {name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{name}</p>
            <p className="text-[10px] text-white/40 truncate leading-tight">{email}</p>
          </div>
        </div>
        <span className="inline-block ml-3 mb-1 text-[10px] font-medium uppercase tracking-wide text-[#C8A04D] bg-[#C8A04D]/10 px-2 py-0.5 rounded-full">
          {role.toLowerCase()}
        </span>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors">
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
