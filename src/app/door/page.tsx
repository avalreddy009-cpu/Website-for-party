"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  Loader2,
  LogOut,
  ScanLine,
  ShieldAlert,
  User,
  X,
} from "lucide-react";

import { BackgroundFX } from "@/components/BackgroundFX";
import { PhraseUnlock } from "@/components/PhraseUnlock";
import { decodeQrFromVideo } from "@/lib/decode-qr-frame";
import { EVENT } from "@/lib/event";
import { getPassById } from "@/lib/passes";
import type { ScanLog, ScanResult } from "@/server/store";

const RESULT_COPY: Record<ScanResult, { label: string; tone: string; detail: string }> = {
  admitted: {
    label: "LET THEM IN",
    tone: "#4ade80",
    detail: "First scan. Entry email just went out.",
  },
  "already-in": {
    label: "ALREADY INSIDE",
    tone: "#fbbf24",
    detail: "This pass was scanned before. Still them — don't turn them away unless it feels off.",
  },
  unpaid: {
    label: "NOT APPROVED",
    tone: "#fb923c",
    detail: "Reservation exists but payment hasn't been confirmed in the CMS.",
  },
  rejected: {
    label: "REJECTED",
    tone: "#ff3b3b",
    detail: "This order was rejected. Do not admit.",
  },
  invalid: {
    label: "NOT A PASS",
    tone: "#ff3b3b",
    detail: "Couldn't match that QR or code to a paid pass.",
  },
};

type ScanResponse = {
  result: ScanResult;
  pass: {
    name: string;
    passCode?: string;
    reference: string;
    quantity: number;
    passId: "early" | "vip";
    enteredAt?: number;
    status: string;
  } | null;
  scan: ScanLog;
  error?: string;
};

export default function DoorPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<ScanResponse | null>(null);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const busyRef = useRef(false);
  const submitScanRef = useRef<(payload: string) => Promise<void>>(async () => {});
  const autoScanned = useRef(false);

  const loadLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/door/scan");
      const data = await response.json();
      if (response.ok) setLogs(data.scans ?? []);
    } catch {
      // Door still works without the sidebar.
    }
  }, []);

  useEffect(() => {
    fetch("/api/door/session")
      .then((response) => response.json())
      .then((data: { authenticated: boolean }) => setAuthed(Boolean(data.authenticated)))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    const timeout = window.setTimeout(() => {
      void loadLogs();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [authed, loadLogs]);

  const submitScan = useCallback(
    async (payload: string) => {
      const value = payload.trim();
      if (!value || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/door/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: value }),
        });
        const data = (await response.json()) as ScanResponse;
        if (!response.ok) {
          setError(data.error ?? "Scan didn't go through.");
          return;
        }
        setLatest(data);
        setManual("");
        void loadLogs();
      } catch {
        setError("No connection. Try again.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [loadLogs],
  );

  useEffect(() => {
    submitScanRef.current = submitScan;
  }, [submitScan]);

  useEffect(() => {
    if (!authed || autoScanned.current || typeof window === "undefined") return;
    const payload = new URLSearchParams(window.location.search).get("p");
    if (!payload) return;
    autoScanned.current = true;
    const timeout = window.setTimeout(() => {
      void submitScan(payload);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [authed, submitScan]);

  useEffect(() => {
    if (!cameraOn) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;
    let raf = 0;
    const start = async () => {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.setAttribute("playsinline", "true");
          video.setAttribute("webkit-playsinline", "true");
          video.srcObject = stream;
          await video.play();
        }

        if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
        const canvas = canvasRef.current;
        let lastAttempt = 0;

        const tick = () => {
          if (cancelled) return;
          raf = requestAnimationFrame(tick);
          const live = videoRef.current;
          if (!live || scanningRef.current) return;
          const now = Date.now();
          if (now - lastAttempt < 140) return;
          lastAttempt = now;

          const value = decodeQrFromVideo(live, canvas);
          if (!value) return;
          scanningRef.current = true;
          void submitScanRef.current(value).finally(() => {
            window.setTimeout(() => {
              scanningRef.current = false;
            }, 1800);
          });
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCameraError("Camera permission denied. Type the 6-digit door code instead.");
      }
    };
    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOn]);

  const logout = async () => {
    await fetch("/api/door/logout", { method: "POST" });
    setAuthed(false);
    setLatest(null);
    setLogs([]);
  };

  return (
    <>
      <BackgroundFX />
      <main className="relative mx-auto flex min-h-[100svh] w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-8">
        {authed === null && (
          <p className="m-auto font-mono text-[10px] tracking-[0.22em] text-bone/40 uppercase">
            CHECKING…
          </p>
        )}

        {authed === false && (
          <div className="m-auto w-full max-w-lg">
            <div className="glass-strong rounded-3xl p-7 sm:p-9">
              <PhraseUnlock
                eyebrow={`${EVENT.host} · DOOR`}
                title="Door phrase"
                hint="Twelve words, same idea as the CMS. Door staff get this phrase — not the CMS one — so a scanner can't approve payments."
                submitLabel="UNLOCK DOOR"
                endpoint="/api/door/login"
                onUnlocked={() => setAuthed(true)}
              />
            </div>
          </div>
        )}

        {authed && (
          <div className="flex flex-1 flex-col gap-8">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[9px] tracking-[0.32em] text-electric-200/70 uppercase">
                  {EVENT.name} · DOOR
                </p>
                <h1 className="font-display mt-1 text-3xl font-light text-bone">Scan a pass</h1>
                <p className="mt-2 max-w-md text-xs text-bone/45">
                  Point the camera at the QR, or type the 6-digit door code
                  (the big number on the pass email — not the UTP-XXXX reference).
                  First good scan emails them that they&apos;re in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 font-mono text-[9px] tracking-[0.22em] text-bone/60 uppercase hover:border-signal/50 hover:text-signal-soft"
              >
                <LogOut className="size-3.5" />
                LOCK
              </button>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="glass overflow-hidden rounded-3xl">
                  <div className="relative aspect-[4/3] bg-black/40">
                    {cameraOn ? (
                      <video
                        ref={videoRef}
                        className="size-full object-cover"
                        muted
                        playsInline
                        autoPlay
                      />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-3 text-bone/40">
                        <ScanLine className="size-10" />
                        <p className="font-mono text-[9px] tracking-[0.22em] uppercase">
                          CAMERA OFF
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setCameraOn((on) => !on)}
                      className="flex items-center gap-2 font-mono text-[9px] tracking-[0.2em] text-bone/70 uppercase"
                    >
                      <Camera className="size-3.5" />
                      {cameraOn ? "STOP CAMERA" : "START CAMERA"}
                    </button>
                    {busy && <Loader2 className="size-4 animate-spin text-electric-200" />}
                  </div>
                </div>

                {cameraError && (
                  <p className="rounded-xl border border-signal/30 bg-signal/8 px-4 py-3 text-[12px] text-signal-soft">
                    {cameraError}
                  </p>
                )}

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitScan(manual);
                  }}
                  className="glass flex items-center gap-2 rounded-2xl px-3 py-2"
                >
                  <input
                    value={manual}
                    onChange={(event) => setManual(event.target.value)}
                    placeholder="6-digit door code, UTP-XXXX ref, or QR payload"
                    className="flex-1 bg-transparent px-2 py-2 font-mono text-sm text-bone placeholder:text-bone/30 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy || !manual.trim()}
                    className="rounded-full bg-bone px-4 py-2 font-mono text-[9px] font-bold tracking-[0.18em] text-void uppercase disabled:opacity-40"
                  >
                    CHECK
                  </button>
                </form>

                {error && (
                  <p className="rounded-xl border border-signal/35 bg-signal/8 px-4 py-3 text-[12px] text-signal-soft">
                    {error}
                  </p>
                )}

                <AnimatePresence>
                  {latest && (
                    <motion.div
                      key={latest.scan.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-3xl border p-5"
                      style={{
                        borderColor: `${RESULT_COPY[latest.result].tone}66`,
                        background: `${RESULT_COPY[latest.result].tone}14`,
                      }}
                    >
                      <p
                        className="font-mono text-[10px] font-bold tracking-[0.24em] uppercase"
                        style={{ color: RESULT_COPY[latest.result].tone }}
                      >
                        {RESULT_COPY[latest.result].label}
                      </p>
                      {latest.pass ? (
                        <>
                          <p className="font-display mt-2 flex items-center gap-2 text-2xl text-bone">
                            <User className="size-5 text-bone/40" />
                            {latest.pass.name}
                          </p>
                          <p className="mt-1 font-mono text-sm tracking-[0.2em] text-bone/70">
                            {latest.pass.passCode} · {latest.pass.reference}
                          </p>
                          <p className="mt-1 text-xs text-bone/50">
                            {latest.pass.quantity} × {getPassById(latest.pass.passId).name}
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 flex items-center gap-2 text-bone">
                          <ShieldAlert className="size-4" />
                          No matching pass
                        </p>
                      )}
                      <p className="mt-3 text-xs text-bone/55">
                        {RESULT_COPY[latest.result].detail}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <p className="font-mono text-[9px] tracking-[0.24em] text-bone/40 uppercase">
                  TONIGHT&apos;S SCANS
                </p>
                <div className="mt-3 space-y-2">
                  {logs.length === 0 && (
                    <p className="glass rounded-2xl px-4 py-8 text-center font-mono text-[9px] tracking-[0.2em] text-bone/35 uppercase">
                      NOTHING SCANNED YET
                    </p>
                  )}
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="glass flex items-start justify-between gap-3 rounded-2xl px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-bone">{log.name ?? "Unknown"}</p>
                        <p className="font-mono text-[10px] tracking-[0.12em] text-bone/40">
                          {log.passCode ?? "—"} · {log.reference ?? "no ref"}
                        </p>
                      </div>
                      <span
                        className="shrink-0 font-mono text-[8px] tracking-[0.16em] uppercase"
                        style={{ color: RESULT_COPY[log.result].tone }}
                      >
                        {log.result === "admitted" ? (
                          <Check className="inline size-3" />
                        ) : log.result === "invalid" ? (
                          <X className="inline size-3" />
                        ) : null}{" "}
                        {log.result}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
