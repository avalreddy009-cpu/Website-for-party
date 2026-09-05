"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

import type { ScanLog, ScanResult } from "@/server/store";

const TONE: Record<ScanResult, string> = {
  admitted: "#4ade80",
  "already-in": "#fbbf24",
  unpaid: "#fb923c",
  rejected: "#ff3b3b",
  invalid: "#ff3b3b",
  "no-record": "#7d8bff",
};

export default function ScanLogsPage() {
  const [scans, setScans] = useState<ScanLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/scans");
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Couldn't load scans.");
        return;
      }
      setScans(data.scans);
    } catch {
      setError("No connection. Try refreshing.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return (
    <div className="flex-1">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[9px] tracking-[0.32em] text-electric-200/70 uppercase">
            DOOR ACTIVITY
          </p>
          <h1 className="font-display mt-2 text-3xl font-light text-bone sm:text-4xl">
            Scan logs
          </h1>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-bone/45">
            Tonight&apos;s door scans.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-full border border-white/12 px-4 py-2.5 font-mono text-[9px] tracking-[0.22em] text-bone/60 uppercase hover:border-electric-300/50 hover:text-electric-200 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          REFRESH
        </button>
      </div>

      {error && (
        <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-signal/35 bg-signal/8 px-4 py-3 text-[12px] text-signal-soft">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-8 space-y-2">
        {!scans && !error && (
          <div className="flex items-center justify-center gap-2.5 py-16 font-mono text-[10px] tracking-[0.2em] text-bone/35 uppercase">
            <Loader2 className="size-4 animate-spin" />
            LOADING LOGS
          </div>
        )}
        {scans && scans.length === 0 && (
          <div className="glass rounded-2xl px-6 py-14 text-center font-mono text-[10px] tracking-[0.2em] text-bone/35 uppercase">
            NO SCANS YET
          </div>
        )}
        {scans?.map((scan) => (
          <div key={scan.id} className="glass flex flex-wrap items-start justify-between gap-3 rounded-2xl px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm text-bone">
                {scan.name ??
                  (scan.result === "no-record" ? "Signed pass · order missing" : "Unknown payload")}
              </p>
              <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-bone/40">
                {scan.passCode ?? "—"} · {scan.reference ?? (scan.result === "no-record" ? "lost from store" : "no match")} · {scan.email ?? ""}
              </p>
              <p className="mt-1 truncate font-mono text-[9px] text-bone/25">{scan.payload}</p>
            </div>
            <div className="text-right">
              <p
                className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase"
                style={{ color: TONE[scan.result] }}
              >
                {scan.result === "no-record" ? "NO RECORD" : scan.result}
              </p>
              <p className="mt-1 font-mono text-[9px] text-bone/35">
                {new Date(scan.at).toLocaleString("en-IN", { hour12: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
