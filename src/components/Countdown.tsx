"use client";

import { AnimatePresence, motion } from "framer-motion";

import { getEventDate } from "@/lib/event";
import { useNow } from "@/lib/useNow";

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

const UNITS: { key: keyof Omit<Remaining, "done">; label: string }[] = [
  { key: "days", label: "DAYS" },
  { key: "hours", label: "HRS" },
  { key: "minutes", label: "MIN" },
  { key: "seconds", label: "SEC" },
];

function diff(target: Date, now: number): Remaining {
  const delta = target.getTime() - now;
  if (delta <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const totalSeconds = Math.floor(delta / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: false,
  };
}

export function Countdown() {
  const now = useNow();
  const target = getEventDate(now === 0 ? undefined : new Date(now));
  const remaining: Remaining | null = now === 0 ? null : diff(target, now);

  return (
    <div className="w-full">
      <div className="mb-5 flex items-center justify-between font-mono text-[9px] tracking-[0.34em] text-bone/40 uppercase sm:text-[10px]">
        <span className="text-electric-200/80">
          {remaining?.done ? "IT'S HAPPENING NOW" : "DOORS OPEN IN"}
        </span>
        <span suppressHydrationWarning>
          {target.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
        {UNITS.map(({ key, label }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, delay: i * 0.09, ease: [0.16, 1, 0.3, 1] }}
            className="group glass relative overflow-hidden rounded-xl px-1 py-4 text-center sm:rounded-2xl sm:px-2 sm:py-7"
          >
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric-300/70 to-transparent" />
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(31,91,255,0.28),transparent_70%)] opacity-60 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative flex h-[1.05em] items-center justify-center overflow-hidden font-display text-4xl leading-none font-light text-bone tabular-nums sm:text-6xl lg:text-7xl">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={remaining ? remaining[key] : "idle"}
                  initial={{ y: "-100%", opacity: 0, filter: "blur(6px)" }}
                  animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: "100%", opacity: 0, filter: "blur(6px)" }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="block"
                >
                  {remaining
                    ? String(remaining[key]).padStart(2, "0")
                    : "--"}
                </motion.span>
              </AnimatePresence>
            </div>

            <p className="relative mt-2.5 font-mono text-[8px] tracking-[0.3em] text-bone/40 uppercase sm:text-[10px]">
              {label}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
