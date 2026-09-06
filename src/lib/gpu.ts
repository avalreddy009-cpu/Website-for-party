"use client";

import { useSyncExternalStore } from "react";

/** Phones, iPads, and reduced-motion — skip WebGL and stacked 3D layers. */
export function isLowPowerGpu(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.matchMedia("(max-width: 900px)").matches) return true;
    const ios =
      /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios;
  } catch {
    return true;
  }
}

function subscribeLowPower(onStoreChange: () => void) {
  const queries = [
    window.matchMedia("(prefers-reduced-motion: reduce)"),
    window.matchMedia("(pointer: coarse)"),
    window.matchMedia("(max-width: 900px)"),
  ];
  queries.forEach((query) => query.addEventListener("change", onStoreChange));
  window.addEventListener("orientationchange", onStoreChange);
  return () => {
    queries.forEach((query) =>
      query.removeEventListener("change", onStoreChange),
    );
    window.removeEventListener("orientationchange", onStoreChange);
  };
}

/** True on the server and until the client snapshot says otherwise. */
export function useLowPowerGpu(): boolean {
  return useSyncExternalStore(subscribeLowPower, isLowPowerGpu, () => true);
}

export const INTRO_FALLBACK_BG =
  "radial-gradient(ellipse at center, rgba(48,58,157,0.5) 0%, rgba(23,20,64,0.55) 38%, #030307 78%)";
