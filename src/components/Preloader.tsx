"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { EVENT } from "@/lib/event";

const EASE = [0.76, 0, 0.24, 1] as const;
const PAPER = "#efe6d2";
const INK = "#1a140c";
const VOID = "#030307";

type PreloaderProps = {
  onComplete: () => void;
};

export function Preloader({ onComplete }: PreloaderProps) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [open, setOpen] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    const measure = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (reduced) {
      const timeout = window.setTimeout(() => {
        if (finished.current) return;
        finished.current = true;
        onComplete();
      }, 80);
      return () => window.clearTimeout(timeout);
    }

    // Stamp lands, then the paper lifts. Keep it under a beat and a half.
    const lift = window.setTimeout(() => setOpen(true), 720);
    const done = window.setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onComplete();
    }, 1580);
    return () => {
      window.clearTimeout(lift);
      window.clearTimeout(done);
    };
  }, [onComplete, reduced]);

  const lifting = reduced || open;
  const bulge = Math.min(240, Math.max(140, size.h * 0.2));
  const paperPath =
    size.w > 0
      ? `M0 0 L${size.w} 0 L${size.w} ${size.h} Q${size.w / 2} ${size.h + bulge} 0 ${size.h} Z`
      : "";
  const flatPath =
    size.w > 0
      ? `M0 0 L${size.w} 0 L${size.w} ${size.h} Q${size.w / 2} ${size.h} 0 ${size.h} Z`
      : "";

  return (
    <motion.div
      className="fixed inset-0 z-100 overflow-visible"
      style={{ backgroundColor: PAPER, color: INK }}
      initial={{ y: 0 }}
      animate={lifting ? { y: "-108%" } : { y: 0 }}
      transition={{
        duration: reduced ? 0.01 : 0.78,
        ease: EASE,
        delay: reduced ? 0 : 0.02,
      }}
      aria-hidden={lifting}
    >
      {size.w > 0 && (
        <svg
          className="pointer-events-none absolute top-0 left-0 z-0 h-[calc(100%+260px)] w-full"
          aria-hidden
        >
          <motion.path
            fill={PAPER}
            initial={{ d: paperPath }}
            animate={{ d: lifting ? flatPath : paperPath }}
            transition={{ duration: 0.7, ease: EASE }}
          />
        </svg>
      )}

      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.18] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Ticket punch-holes down the left edge. */}
      <div className="absolute top-0 bottom-0 left-0 z-20 flex w-7 flex-col justify-between py-8 sm:w-9">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="mx-auto block size-2.5 rounded-full sm:size-3"
            style={{ backgroundColor: VOID, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)" }}
          />
        ))}
      </div>

      <div className="relative z-20 flex h-full flex-col justify-between px-10 py-8 sm:px-14 sm:py-10">
        <div className="flex items-start justify-between gap-4 font-sans text-[11px] tracking-[0.18em] uppercase">
          <p>{EVENT.host}</p>
          <p className="text-right">
            {EVENT.shortDateLabel}
            <span className="mt-1 block tracking-[0.14em] normal-case opacity-70">
              {EVENT.timeLabel.replace("—", "–")}
            </span>
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 1.55, rotate: -11, y: 18 }}
            animate={{ opacity: 1, scale: 1, rotate: -2.4, y: 0 }}
            transition={{
              duration: 0.42,
              ease: [0.16, 1, 0.3, 1],
              delay: 0.06,
            }}
          >
            <StampMark />
          </motion.div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <p className="max-w-[14rem] font-display text-2xl leading-none italic sm:text-3xl">
            {EVENT.venueName}
          </p>
          <p className="text-right font-sans text-[11px] tracking-[0.16em] uppercase">
            {EVENT.venueCity}
            <span className="mt-1 block opacity-70">Doors at 12</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function StampMark() {
  return (
    <div
      className="relative grid size-[min(72vw,280px)] place-items-center"
      style={{ color: "#3a2158" }}
    >
      <svg viewBox="0 0 280 280" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle
          cx="140"
          cy="140"
          r="132"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          opacity="0.92"
        />
        <circle
          cx="140"
          cy="140"
          r="118"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeDasharray="2.5 5.5"
          opacity="0.75"
        />
        <path
          id="utopia-stamp-rim"
          d="M140,140 m-100,0 a100,100 0 1,1 200,0 a100,100 0 1,1 -200,0"
          fill="none"
        />
        <text
          fill="currentColor"
          fontSize="11"
          letterSpacing="4.2"
          className="uppercase"
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          <textPath href="#utopia-stamp-rim" startOffset="18%">
            HYDERABAD · OUZO · SUN 27 SEP ·
          </textPath>
        </text>
      </svg>

      <div className="relative text-center" style={{ mixBlendMode: "multiply" }}>
        <p className="font-display text-[clamp(2.6rem,8vw,4.4rem)] leading-[0.82] font-medium tracking-[-0.03em]">
          {EVENT.name}
        </p>
      </div>
    </div>
  );
}
