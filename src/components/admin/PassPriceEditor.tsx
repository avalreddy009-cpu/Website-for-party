"use client";

import { useEffect, useState } from "react";
import { IndianRupee, Loader2 } from "lucide-react";

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
    <section
      id="prices"
      className="glass-strong rounded-3xl border border-electric-300/25 p-6 sm:p-8"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[9px] tracking-[0.32em] text-electric-200/80 uppercase">
            LIVE SITE
          </p>
          <h2 className="font-display mt-2 text-3xl font-light text-bone sm:text-4xl">
            Edit pass prices
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-bone/55">
            Type the new rupee amount and save. The landing page and checkout
            update immediately. Already-paid orders keep what they paid.
          </p>
        </div>
        {saved && (
          <p className="font-mono text-[10px] tracking-[0.22em] text-electric-200 uppercase">
            SAVED · LIVE NOW
          </p>
        )}
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        {PASSES.map((pass) => {
          const value = pass.id === "early" ? early : vip;
          const setValue = pass.id === "early" ? setEarly : setVip;
          return (
            <label
              key={pass.id}
              className="block rounded-2xl border border-white/10 bg-white/3 p-5"
            >
              <span className="font-mono text-[10px] tracking-[0.28em] text-bone/50 uppercase">
                {pass.index} · {pass.name}
              </span>
              <span className="mt-1 block text-xs text-bone/40">{pass.subtitle}</span>
              <span className="mt-4 flex items-center gap-2 border-b border-white/12 pb-2">
                <IndianRupee className="size-6 text-bone/50" strokeWidth={1.6} />
                <input
                  inputMode="numeric"
                  value={value}
                  onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
                  className="w-full bg-transparent font-display text-4xl font-light text-bone tabular-nums outline-none sm:text-5xl"
                  aria-label={`${pass.name} price in rupees`}
                />
              </span>
              <span className="mt-2 block font-mono text-[9px] tracking-[0.18em] text-bone/30 uppercase">
                Shows as {formatPrice(Number(value) || 0)}
              </span>
            </label>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-bone px-6 py-4 font-mono text-[11px] font-bold tracking-[0.22em] text-void uppercase transition-transform duration-300 hover:scale-[1.01] disabled:scale-100 disabled:opacity-50 sm:w-auto sm:px-10"
      >
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        SAVE PRICES
      </button>

      {error && (
        <p className="mt-4 text-[13px] leading-relaxed text-signal-soft">{error}</p>
      )}
    </section>
  );
}
