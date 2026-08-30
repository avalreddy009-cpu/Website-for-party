"use client";

import { useSyncExternalStore } from "react";

/**
 * A single shared 1s ticker. Modelled as an external store so components read
 * the clock during render instead of writing time into state from an effect,
 * and so the server snapshot (0) keeps hydration deterministic.
 */
const listeners = new Set<() => void>();
let intervalId: number | null = null;
let snapshot = 0;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (intervalId === null) {
    snapshot = Date.now();
    intervalId = window.setInterval(() => {
      snapshot = Date.now();
      listeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => 0;

/** Milliseconds since epoch, refreshed every second. `0` until mounted. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
