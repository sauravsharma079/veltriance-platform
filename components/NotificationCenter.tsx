"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, CheckSquare, X, FileText, Building2 } from "lucide-react";

type Notification = {
  id: string; type: string; title: string; body: string;
  href: string; urgent: boolean; createdAt: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  approval_needed: <CheckSquare className="size-4 text-amber-500" />,
  approved: <CheckSquare className="size-4 text-green-500" />,
  rejected: <X className="size-4 text-red-500" />,
  suppliers: <Building2 className="size-4 text-[#1A2A52]" />,
  default: <FileText className="size-4 text-gray-400" />,
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications ?? []);
        setUnread(d.unreadCount ?? 0);
      });
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center size-9 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Bell className="size-4.5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 size-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-60 top-16 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
            <p className="font-semibold text-gray-900 text-sm">Notifications</p>
            {unread > 0 && (
              <span className="text-xs bg-red-50 text-red-600 font-medium px-2 py-0.5 rounded-full">{unread} urgent</span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="size-6 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">All caught up!</p>
              </div>
            ) : (
              notifications.map(n => (
                <Link key={n.id} href={n.href} onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${n.urgent ? "bg-amber-50/30" : ""}`}>
                  <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${n.urgent ? "bg-amber-100" : "bg-gray-100"}`}>
                    {TYPE_ICON[n.type] ?? TYPE_ICON.default}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{n.title}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {n.urgent && <span className="size-2 rounded-full bg-amber-500 shrink-0 mt-2" />}
                </Link>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-gray-100">
            <Link href="/dashboard/approvals" onClick={() => setOpen(false)}
              className="text-xs text-[#1A2A52] font-medium hover:underline">
              View all approvals →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
