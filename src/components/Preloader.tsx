"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { EVENT } from "@/lib/event";

const BOOT_LINES = [
  "WARMING UP THE RIG",
  "POINTING THE LASERS",
  "STOCKING THE MOCKTAIL BAR",
  "UNLOCKING THE DOOR",
];

type PreloaderProps = {
  onComplete: () => void;
};

export function Preloader({ onComplete }: PreloaderProps) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const completed = useRef(false);

  useEffect(() => {
    if (reduced) {
      const timeout = window.setTimeout(onComplete, 250);
      return () => window.clearTimeout(timeout);
    }

    const duration = 2400;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const linear = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - linear, 3);
      // A small stall near the end so it reads as a projector, not a spinner.
      const stutter = linear > 0.83 && linear < 0.92 ? -0.028 : 0;
      setProgress(Math.min(100, Math.max(0, (eased + stutter) * 100)));

      if (linear < 1) {
        frame = requestAnimationFrame(tick);
      } else if (!completed.current) {
        completed.current = true;
        setExiting(true);
        window.setTimeout(onComplete, 1100);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onComplete, reduced]);

  const displayProgress = reduced ? 100 : progress;
  const isExiting = reduced || exiting;
  const rounded = Math.round(displayProgress);
  const activeLine = Math.min(
    BOOT_LINES.length - 1,
    Math.floor((rounded / 100) * BOOT_LINES.length),
  );

  return (
    <motion.div
      className="fixed inset-0 z-100 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4, delay: 0.5 } }}
    >
      <div className="absolute inset-0 bg-[#020206]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(96,105,240,0.16),transparent_58%)]" />
      <div className="noise-overlay absolute inset-0 opacity-[0.14] mix-blend-soft-light" />

      <motion.div
        className="absolute top-0 left-0 h-[38%] w-full bg-[linear-gradient(to_bottom,transparent,rgba(154,164,255,0.07),transparent)]"
        animate={{ y: ["-40%", "260%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />

      {/* Shutters part to hand the screen over to the hero. */}
      <motion.div
        className="absolute inset-x-0 top-0 z-20 h-1/2 origin-top border-b border-electric-400/25 bg-[#020206]"
        initial={{ y: 0 }}
        animate={isExiting ? { y: "-100%" } : { y: 0 }}
        transition={{ duration: 1, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 z-20 h-1/2 origin-bottom border-t border-electric-400/25 bg-[#020206]"
        initial={{ y: 0 }}
        animate={isExiting ? { y: "100%" } : { y: 0 }}
        transition={{ duration: 1, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
      />

      <motion.div
        className="relative z-30 flex w-full max-w-xl flex-col items-center gap-8 px-6 text-center"
        animate={
          isExiting
            ? { opacity: 0, scale: 1.28, filter: "blur(14px)" }
            : { opacity: 1, scale: 1 }
        }
        transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
      >
        <motion.p
          className="font-mono text-[10px] tracking-[0.5em] text-electric-200/70 uppercase"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          {EVENT.host}
        </motion.p>

        <h1 className="font-display glow-text text-6xl leading-none font-light tracking-[0.02em] text-bone uppercase sm:text-8xl">
          {Array.from(EVENT.name).map((letter, i) => (
            <motion.span
              key={`${letter}-${i}`}
              className="inline-block"
              initial={{ opacity: 0, y: 36, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.9,
                delay: 0.1 + i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {letter}
            </motion.span>
          ))}
        </h1>

        <div className="w-full">
          <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] tracking-[0.26em] text-bone/45 uppercase">
            <motion.span
              key={activeLine}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {BOOT_LINES[activeLine]}
            </motion.span>
            <span className="text-electric-200 tabular-nums">
              {String(rounded).padStart(3, "0")}%
            </span>
          </div>

          <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-white/8">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-electric-500 via-electric-300 to-bone"
              style={{ width: `${displayProgress}%` }}
            />
            <motion.div
              className="absolute inset-y-0 w-16 bg-white/40 blur-md"
              style={{ left: `calc(${displayProgress}% - 32px)` }}
            />
          </div>

          <div className="mt-4 flex justify-between font-mono text-[9px] tracking-[0.26em] text-bone/25 uppercase">
            <span>{EVENT.shortDateLabel}</span>
            <span>{EVENT.venueCity}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
