"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, KeyRound } from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

type PhraseUnlockProps = {
  title: string;
  eyebrow: string;
  hint: string;
  submitLabel: string;
  endpoint: string;
  onUnlocked: () => void;
};

function emptyWords(): string[] {
  return Array.from({ length: 12 }, () => "");
}

export function PhraseUnlock({
  title,
  eyebrow,
  hint,
  submitLabel,
  endpoint,
  onUnlocked,
}: PhraseUnlockProps) {
  const [words, setWords] = useState<string[]>(emptyWords);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const id = window.setTimeout(() => boxes.current[0]?.focus(), 200);
    return () => window.clearTimeout(id);
  }, []);

  const fillFrom = (raw: string, start = 0) => {
    const incoming = raw
      .toLowerCase()
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 12 - start);
    setWords((prev) => {
      const next = [...prev];
      incoming.forEach((word, i) => {
        next[start + i] = word.replace(/[^a-z]/g, "");
      });
      return next;
    });
    const focusAt = Math.min(start + incoming.length, 11);
    window.setTimeout(() => boxes.current[focusAt]?.focus(), 0);
  };

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    const phrase = words.map((word) => word.trim().toLowerCase()).filter(Boolean);
    if (phrase.length !== 12) {
      setError("All twelve words, in order.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: phrase.join(" ") }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "That phrase doesn't unlock this.");
        setBusy(false);
        return;
      }
      onUnlocked();
    } catch {
      setError("No connection. Check your internet and try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="relative">
      <p className="font-mono text-[9px] tracking-[0.32em] text-electric-200/70 uppercase">
        {eyebrow}
      </p>
      <h1 className="font-display mt-2 text-3xl font-light text-bone sm:text-4xl">{title}</h1>
      <p className="mt-2 text-xs leading-relaxed text-bone/45">{hint}</p>

      <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {words.map((word, i) => (
          <label key={i} className="relative">
            <span className="pointer-events-none absolute top-2 left-3 font-mono text-[8px] tracking-[0.18em] text-bone/30">
              {String(i + 1).padStart(2, "0")}
            </span>
            <input
              ref={(element) => {
                boxes.current[i] = element;
              }}
              value={word}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text");
                if (text.trim().split(/[\s,]+/).length > 1) {
                  event.preventDefault();
                  fillFrom(text, i);
                }
              }}
              onChange={(event) => {
                const value = event.target.value.toLowerCase();
                if (value.includes(" ") || value.includes(",")) {
                  fillFrom(value, i);
                  return;
                }
                setWords((prev) => {
                  const next = [...prev];
                  next[i] = value.replace(/[^a-z]/g, "");
                  return next;
                });
              }}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter" || event.key === "Tab") {
                  if (event.key !== "Tab") event.preventDefault();
                  if (i < 11) boxes.current[i + 1]?.focus();
                  else if (event.key === "Enter") void submit();
                }
                if (event.key === "Backspace" && !word && i > 0) {
                  boxes.current[i - 1]?.focus();
                }
              }}
              className="w-full rounded-xl border border-white/10 bg-white/2 px-3 pt-6 pb-2.5 font-mono text-[13px] text-bone placeholder:text-bone/20 focus:border-electric-300/60 focus:outline-none disabled:opacity-50"
              placeholder="word"
            />
          </label>
        ))}
      </div>

      <motion.div
        animate={error ? { x: [0, -7, 6, -3, 0] } : { x: 0 }}
        transition={{ duration: 0.42, ease: EASE }}
        className="mt-4"
      >
        {error && (
          <p className="rounded-xl border border-signal/35 bg-signal/8 px-4 py-3 text-[12px] leading-relaxed text-signal-soft">
            {error}
          </p>
        )}
      </motion.div>

      <button
        type="submit"
        disabled={busy}
        className="group relative mt-5 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-full bg-bone px-6 py-3.5 font-mono text-[10px] font-bold tracking-[0.2em] text-void uppercase transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-50"
      >
        <span className="absolute inset-0 translate-y-full bg-gradient-to-br from-electric-500 via-electric-400 to-violet-haze transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0" />
        <span className="relative flex items-center gap-2.5 transition-colors duration-300 group-hover:text-bone">
          <KeyRound className="size-3.5" />
          {busy ? "UNLOCKING…" : submitLabel}
          {!busy && <ArrowRight className="size-3.5" />}
        </span>
      </button>
    </form>
  );
}
