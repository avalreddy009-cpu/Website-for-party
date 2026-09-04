"use client";

import { useEffect, useState } from "react";

import {
  catalogWithPrices,
  DEFAULT_PASS_PRICES,
  PASSES,
  type PassId,
  type PassPriceTable,
  type PassTier,
} from "@/lib/passes";

/**
 * Prices are editable from the CMS, so the catalog can't be a constant. We
 * refetch when the tab comes back to the foreground and on a slow timer — a
 * price edit mid-event should not need everyone to reload.
 */
const POLL_MS = 60_000;

export function usePassCatalog() {
  const [prices, setPrices] = useState<PassPriceTable>(DEFAULT_PASS_PRICES);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/passes/prices", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Partial<PassPriceTable>;
        const early = Number(data.early);
        const vip = Number(data.vip);
        if (cancelled) return;
        if (Number.isInteger(early) && early >= 1 && Number.isInteger(vip) && vip >= 1) {
          setPrices((prev) =>
            prev.early === early && prev.vip === vip ? prev : { early, vip },
          );
        }
      } catch {
        // Keep whatever we're already showing.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    void load();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => void load(), POLL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  const catalog = catalogWithPrices(prices);
  const byId = (id: PassId): PassTier =>
    catalog.find((pass) => pass.id === id) ?? PASSES[0];

  return { catalog, prices, byId };
}
