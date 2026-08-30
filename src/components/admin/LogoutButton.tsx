"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 font-mono text-[9px] tracking-[0.22em] text-bone/60 uppercase transition-all duration-300 hover:border-signal/50 hover:text-signal-soft disabled:opacity-50"
    >
      <LogOut className="size-3.5" />
      {busy ? "SIGNING OUT…" : "SIGN OUT"}
    </button>
  );
}
