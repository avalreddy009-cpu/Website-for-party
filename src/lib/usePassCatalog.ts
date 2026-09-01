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

export function usePassCatalog() {
  const [prices, setPrices] = useState<PassPriceTable>(DEFAULT_PASS_PRICES);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetch("/api/passes/prices")
        .then((response) => response.json())
        .then((data: Partial<PassPriceTable>) => {
          const early = Number(data.early);
          const vip = Number(data.vip);
          if (Number.isInteger(early) && early >= 1 && Number.isInteger(vip) && vip >= 1) {
            setPrices({ early, vip });
          }
        })
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const catalog = catalogWithPrices(prices);
  const byId = (id: PassId): PassTier =>
    catalog.find((pass) => pass.id === id) ?? PASSES[0];

  return { catalog, prices, byId };
}
