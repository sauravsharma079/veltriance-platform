"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, X } from "lucide-react";

export function ImpersonationBanner({
  userName,
  userRole,
  adminName,
}: {
  userName: string;
  userRole: string;
  adminName: string;
}) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  async function handleExit() {
    setExiting(true);
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    router.push("/dashboard/admin");
    router.refresh();
  }

  return (
    <div className="bg-amber-500 text-white px-5 py-2.5 flex items-center justify-between text-sm shrink-0">
      <div className="flex items-center gap-2">
        <Eye className="size-4 shrink-0" />
        <span>
          You ({adminName}) are viewing as{" "}
          <strong>{userName}</strong>{" "}
          <span className="opacity-75">({userRole.toLowerCase()})</span>
          {" "}— all actions you take will be performed as this user.
        </span>
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1 rounded-lg text-xs font-medium shrink-0 ml-4 disabled:opacity-50"
      >
        <X className="size-3.5" />
        {exiting ? "Exiting…" : "Exit — return to my account"}
      </button>
    </div>
  );
}
