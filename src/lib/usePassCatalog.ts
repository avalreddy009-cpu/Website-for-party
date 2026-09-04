"use client";

import { useCallback, useEffect, useState } from "react";

import {
  catalogWithPrices,
  DEFAULT_PASS_PRICES,
  PASSES,
  type PassId,
  type PassPriceTable,
  type PassTier,
} from "@/lib/passes";

function readPrices(data: Partial<PassPriceTable>): PassPriceTable | null {
  const early = Number(data.early);
  const vip = Number(data.vip);
  if (Number.isInteger(early) && early >= 1 && Number.isInteger(vip) && vip >= 1) {
    return { early, vip };
  }
  return null;
}

export function usePassCatalog() {
  const [prices, setPrices] = useState<PassPriceTable>(DEFAULT_PASS_PRICES);

  const refresh = useCallback(() => {
    fetch("/api/passes/prices", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: Partial<PassPriceTable>) => {
        const next = readPrices(data);
        if (next) setPrices(next);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(refresh, 20_000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const catalog = catalogWithPrices(prices);
  const byId = (id: PassId): PassTier =>
    catalog.find((pass) => pass.id === id) ?? PASSES[0];

  return { catalog, prices, byId, refresh };
}
