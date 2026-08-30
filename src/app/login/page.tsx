"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Mail, RefreshCw, ShieldCheck } from "lucide-react";

import { BackgroundFX } from "@/components/BackgroundFX";
import { Navbar } from "@/components/Navbar";
import { EVENT } from "@/lib/event";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetch("/api/account/session")
        .then((response) => response.json())
        .then((data: { authenticated: boolean }) => {
          if (data.authenticated) router.replace("/account");
        })
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  const requestCode = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        fields?: { email?: string };
        devCode?: string;
        resendAfterSeconds?: number;
      };
      if (!response.ok) {
        setError(data.fields?.email ?? data.error ?? "Couldn't send that.");
        setBusy(false);
        return;
      }
      setDevCode(data.devCode ?? null);
      setResendIn(data.resendAfterSeconds ?? 45);
      setCode("");
      setStep("code");
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (override?: string) => {
    const value = (override ?? code).replace(/\D/g, "");
    if (value.length !== 6) {
      setError("All six digits, please.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/login/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: value }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "That code didn't work.");
        setCode("");
        setBusy(false);
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setError("No connection. Try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <BackgroundFX />
      <Navbar />
      <main className="relative flex min-h-[100svh] flex-1 items-center justify-center px-5 pt-28 pb-16 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="glass-strong relative w-full max-w-md overflow-hidden rounded-3xl p-7 sm:p-9"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric-300 to-transparent"
          />

          <p className="font-mono text-[9px] tracking-[0.32em] text-electric-200/70 uppercase">
            {EVENT.name} · YOUR PASSES
          </p>
          <h1 className="font-display mt-2 text-3xl font-light text-bone sm:text-4xl">
            {step === "email" ? "Guest login" : "Check your inbox"}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-bone/45">
            {step === "email"
              ? "Use the email you bought with. We'll send a 6-digit code — no password, no staff phrase."
              : `Sent to ${email}. Staff don't log in here.`}
          </p>

          {step === "email" ? (
            <form
              className="relative mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void requestCode();
              }}
            >
              <label className="block">
                <span className="mb-2 block font-mono text-[9px] tracking-[0.28em] text-bone/40 uppercase">
                  EMAIL
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/2 px-4 py-3.5 focus-within:border-electric-300/60">
                  <Mail className="size-4 shrink-0 text-bone/35" />
                  <input
                    type="email"
                    value={email}
                    autoComplete="email"
                    autoFocus
                    disabled={busy}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@somewhere.com"
                    className="w-full bg-transparent text-sm text-bone placeholder:text-bone/25 focus:outline-none"
                  />
                </div>
              </label>

              {error && (
                <p className="rounded-xl border border-signal/35 bg-signal/8 px-4 py-3 text-[12px] text-signal-soft">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-full bg-bone px-6 py-3.5 font-mono text-[10px] font-bold tracking-[0.2em] text-void uppercase transition-transform duration-300 hover:scale-[1.02] disabled:scale-100 disabled:opacity-50"
              >
                <span className="absolute inset-0 translate-y-full bg-gradient-to-br from-electric-500 to-violet-haze transition-transform duration-500 group-hover:translate-y-0" />
                <span className="relative flex items-center gap-2.5 transition-colors duration-300 group-hover:text-bone">
                  {busy ? "SENDING…" : "EMAIL ME A CODE"}
                  {!busy && <ArrowRight className="size-3.5" />}
                </span>
              </button>
            </form>
          ) : (
            <form
              className="relative mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void confirm();
              }}
            >
              <label className="block">
                <span className="mb-2 block font-mono text-[9px] tracking-[0.28em] text-bone/40 uppercase">
                  6-DIGIT CODE
                </span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(next);
                    setError(null);
                    if (next.length === 6) window.setTimeout(() => void confirm(next), 80);
                  }}
                  className="font-display w-full rounded-2xl border border-white/10 bg-white/2 px-4 py-4 text-center text-3xl tracking-[0.34em] text-bone focus:border-electric-300/60 focus:outline-none"
                />
              </label>

              {error && (
                <p className="rounded-xl border border-signal/35 bg-signal/8 px-4 py-3 text-[12px] text-signal-soft">
                  {error}
                </p>
              )}

              {devCode && (
                <p className="rounded-xl border border-electric-300/25 bg-electric-500/8 px-4 py-2.5 text-center text-[11px] text-electric-100">
                  Dev mode — code{" "}
                  <span className="font-mono text-base tracking-[0.28em] text-bone">{devCode}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-full bg-bone px-6 py-3.5 font-mono text-[10px] font-bold tracking-[0.2em] text-void uppercase disabled:opacity-50"
              >
                <span className="relative">{busy ? "CHECKING…" : "SEE MY PASSES"}</span>
              </button>

              <button
                type="button"
                onClick={() => void requestCode()}
                disabled={resendIn > 0 || busy}
                className="flex w-full items-center justify-center gap-2 font-mono text-[9px] tracking-[0.22em] text-bone/45 uppercase disabled:opacity-40"
              >
                <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
                {resendIn > 0 ? `RESEND IN ${resendIn}S` : "SEND IT AGAIN"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                  setCode("");
                }}
                className="w-full font-mono text-[9px] tracking-[0.22em] text-bone/35 uppercase"
              >
                USE A DIFFERENT EMAIL
              </button>
            </form>
          )}

          <div className="relative mt-7 flex items-start gap-2.5 border-t border-white/8 pt-5">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-bone/30" />
            <p className="text-[11px] leading-relaxed text-bone/35">
              Buying a pass? Start from the homepage. This page only shows reservations already
              tied to your inbox.
            </p>
          </div>
        </motion.div>
      </main>
    </>
  );
}
