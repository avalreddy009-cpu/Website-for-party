"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { formatPrice } from "@/lib/event";
import { DEFAULT_PASS_PRICES, PASSES } from "@/lib/passes";

export function PassPriceEditor() {
  const [early, setEarly] = useState(String(DEFAULT_PASS_PRICES.early));
  const [vip, setVip] = useState(String(DEFAULT_PASS_PRICES.vip));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetch("/api/admin/prices")
        .then((response) => response.json())
        .then((data: { early?: number; vip?: number }) => {
          if (typeof data.early === "number") setEarly(String(data.early));
          if (typeof data.vip === "number") setVip(String(data.vip));
        })
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/admin/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          early: Number(early.replace(/[^\d]/g, "")),
          vip: Number(vip.replace(/[^\d]/g, "")),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        fields?: { early?: string; vip?: string };
        early?: number;
        vip?: number;
      };
      if (!response.ok) {
        setError(data.fields?.early ?? data.fields?.vip ?? data.error ?? "Couldn't save that.");
        return;
      }
      if (typeof data.early === "number") setEarly(String(data.early));
      if (typeof data.vip === "number") setVip(String(data.vip));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass mt-8 rounded-2xl border border-white/10 p-5 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[9px] tracking-[0.32em] text-electric-200/70 uppercase">
            PASS PRICES
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-bone/45">
            Changes go live on the site and at checkout. Already-paid orders keep their original total.
          </p>
        </div>
        {saved && (
          <p className="font-mono text-[9px] tracking-[0.22em] text-electric-200/80 uppercase">
            SAVED
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        {PASSES.map((pass) => {
          const value = pass.id === "early" ? early : vip;
          const setValue = pass.id === "early" ? setEarly : setVip;
          return (
            <label key={pass.id} className="block">
              <span className="font-mono text-[8px] tracking-[0.24em] text-bone/35 uppercase">
                {pass.name}
              </span>
              <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/2 px-3.5 py-2.5 focus-within:border-electric-300/50">
                <span className="font-mono text-[12px] text-bone/40">₹</span>
                <input
                  inputMode="numeric"
                  value={value}
                  onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
                  className="w-full bg-transparent font-display text-xl font-light text-bone tabular-nums outline-none"
                />
              </span>
            </label>
          );
        })}

        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="flex h-[46px] items-center justify-center gap-2 rounded-full bg-bone px-5 font-mono text-[9px] font-bold tracking-[0.2em] text-void uppercase transition-transform duration-300 hover:scale-[1.03] disabled:scale-100 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          SAVE PRICES
        </button>
      </div>

      {error && (
        <p className="mt-3 text-[12px] leading-relaxed text-signal-soft">{error}</p>
      )}

      <p className="mt-3 font-mono text-[8px] tracking-[0.18em] text-bone/30 uppercase">
        Live preview · Early {formatPrice(Number(early) || 0)} · VIP {formatPrice(Number(vip) || 0)}
      </p>
    </div>
  );
}
