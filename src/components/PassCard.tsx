"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { ArrowLeft, Check, Sparkles, Ticket } from "lucide-react";

import { formatPrice } from "@/lib/event";
import type { PassTier } from "@/lib/passes";

const EASE = [0.16, 1, 0.3, 1] as const;

type PassCardProps = {
  pass: PassTier;
  index: number;
  onBuy: (pass: PassTier) => void;
};

export function PassCard({ pass, index, onBuy }: PassCardProps) {
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const tiltX = useSpring(0, { stiffness: 180, damping: 20 });
  const tiltY = useSpring(0, { stiffness: 180, damping: 20 });
  const pointerX = useMotionValue(50);
  const pointerY = useMotionValue(50);

  const spotlight = useMotionTemplate`radial-gradient(420px circle at ${pointerX}% ${pointerY}%, ${pass.accentSoft}, transparent 62%)`;

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    pointerX.set(px * 100);
    pointerY.set(py * 100);
    tiltY.set((px - 0.5) * 13);
    tiltX.set((0.5 - py) * 13);
  };

  const handleLeave = () => {
    setHovered(false);
    tiltX.set(0);
    tiltY.set(0);
    pointerX.set(50);
    pointerY.set(50);
  };

  const faceClass =
    "absolute inset-0 flex flex-col overflow-hidden rounded-[26px] p-6 backface-hidden sm:p-7";

  return (
    <motion.div
      initial={{ opacity: 0, y: 70, rotateX: reduced ? 0 : -8 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.95, delay: index * 0.12, ease: EASE }}
      className="perspective-card relative h-[560px] w-full sm:h-[580px]"
    >
      {/* Ambient halo that swells on hover. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[40px] blur-3xl transition-opacity duration-500"
        animate={{ opacity: hovered ? 0.85 : 0.32 }}
        style={{
          background: `radial-gradient(circle at 50% 45%, ${pass.accentSoft}, transparent 68%)`,
        }}
      />

      <motion.div
        ref={cardRef}
        onPointerMove={handleMove}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={handleLeave}
        style={
          reduced
            ? { transformStyle: "preserve-3d" }
            : { rotateX: tiltX, rotateY: tiltY, transformStyle: "preserve-3d" }
        }
        className="relative size-full"
      >
        <motion.div
          className="relative size-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.95, ease: [0.68, -0.15, 0.27, 1.15] }}
        >
          {/* ---------------- FRONT ---------------- */}
          <div
            className={`${faceClass} glass-strong`}
            style={{ borderColor: hovered ? pass.accentSoft : undefined }}
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500"
              style={{ background: spotlight, opacity: hovered ? 0.75 : 0 }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background: `linear-gradient(to right, transparent, ${pass.accent}, transparent)`,
              }}
            />
            <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-soft-light" />

            <div className="relative flex items-start justify-between">
              <span className="font-mono text-[10px] tracking-[0.34em] text-bone/35">
                {pass.index}
              </span>
              {pass.badge && (
                <motion.span
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[8px] font-bold tracking-[0.22em] uppercase"
                  style={{
                    color: pass.accent,
                    border: `1px solid ${pass.accentSoft}`,
                    background: "rgba(255,255,255,0.04)",
                  }}
                  animate={
                    reduced
                      ? {}
                      : {
                          boxShadow: [
                            `0 0 0px ${pass.accentSoft}`,
                            `0 0 22px -2px ${pass.accentSoft}`,
                            `0 0 0px ${pass.accentSoft}`,
                          ],
                        }
                  }
                  transition={{ duration: 2.6, repeat: Infinity }}
                >
                  <Sparkles className="size-2.5" />
                  {pass.badge}
                </motion.span>
              )}
            </div>

            <div className="relative mt-8">
              <p
                className="font-mono text-[9px] tracking-[0.34em] uppercase"
                style={{ color: pass.accent }}
              >
                {pass.subtitle}
              </p>
              <h3 className="font-display mt-3 text-3xl leading-[0.92] tracking-[0.02em] text-bone uppercase sm:text-4xl">
                {pass.name}
              </h3>
            </div>

            <div className="relative mt-7 flex items-end gap-3">
              <span className="font-display text-5xl leading-none text-bone tabular-nums sm:text-6xl">
                {formatPrice(pass.price)}
              </span>
              {pass.strikePrice && (
                <span className="mb-1.5 font-mono text-xs text-bone/30 line-through">
                  {formatPrice(pass.strikePrice)}
                </span>
              )}
            </div>
            <p className="relative mt-1.5 font-mono text-[9px] tracking-[0.26em] text-bone/35 uppercase">
              PER PERSON · ALL TAXES INCLUDED
            </p>

            <p className="relative mt-6 text-sm leading-relaxed text-bone/55">
              {pass.blurb}
            </p>

            <div className="relative mt-auto pt-6">
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between font-mono text-[8px] tracking-[0.24em] text-bone/35 uppercase">
                  <span>{pass.capacity}</span>
                  <span style={{ color: pass.accent }}>SELLING FAST</span>
                </div>
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(to right, ${pass.accent}, rgba(255,255,255,0.85))`,
                    }}
                    initial={{ width: "0%" }}
                    whileInView={{ width: `${68 + index * 9}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.4, delay: 0.4, ease: EASE }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onBuy(pass)}
                  className="group/buy relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-bone px-5 py-3.5 font-mono text-[10px] font-bold tracking-[0.22em] text-void uppercase transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
                >
                  <span
                    className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/buy:translate-y-0"
                    style={{
                      background: `linear-gradient(135deg, ${pass.accent}, #6b3bff)`,
                    }}
                  />
                  <Ticket
                    className="relative size-3.5 transition-colors duration-300 group-hover/buy:text-bone"
                    strokeWidth={2.5}
                  />
                  <span className="relative transition-colors duration-300 group-hover/buy:text-bone">
                    BUY PASS
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  aria-label={`View perks for ${pass.name}`}
                  className="rounded-full border border-white/12 px-5 py-3.5 font-mono text-[10px] tracking-[0.22em] text-bone/60 uppercase transition-all duration-300 hover:border-cyan-glow/60 hover:text-cyan-glow"
                >
                  PERKS
                </button>
              </div>
            </div>
          </div>

          {/* ---------------- BACK ---------------- */}
          <div
            className={`${faceClass} glass-strong rotate-y-180`}
            style={{ borderColor: pass.accentSoft }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(120% 90% at 50% 0%, ${pass.accentSoft}, transparent 62%)`,
                opacity: 0.5,
              }}
            />
            <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-soft-light" />

            <div className="relative flex items-center justify-between">
              <p
                className="font-mono text-[9px] tracking-[0.34em] uppercase"
                style={{ color: pass.accent }}
              >
                WHAT YOU GET
              </p>
              <span className="font-mono text-[10px] tracking-[0.3em] text-bone/35">
                {pass.index}
              </span>
            </div>

            <h3 className="font-display relative mt-4 text-2xl leading-[0.95] tracking-[0.02em] text-bone uppercase sm:text-3xl">
              {pass.name}
            </h3>

            <ul className="relative mt-6 flex-1 space-y-3.5 overflow-y-auto pr-1">
              {pass.perks.map((perk, i) => (
                <motion.li
                  key={perk}
                  className="flex items-start gap-3 text-[13px] leading-snug text-bone/70"
                  initial={false}
                  animate={
                    flipped
                      ? { opacity: 1, x: 0 }
                      : { opacity: 0, x: reduced ? 0 : -14 }
                  }
                  transition={{
                    duration: 0.5,
                    delay: flipped ? 0.42 + i * 0.07 : 0,
                    ease: EASE,
                  }}
                >
                  <span
                    className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full"
                    style={{ background: pass.accentSoft, color: "#050810" }}
                  >
                    <Check className="size-2.5" strokeWidth={3.5} />
                  </span>
                  {perk}
                </motion.li>
              ))}
            </ul>

            <div className="relative mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFlipped(false)}
                aria-label={`Back to ${pass.name} summary`}
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/12 text-bone/60 transition-all duration-300 hover:border-bone/40 hover:text-bone"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onBuy(pass)}
                className="group/buy relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-full border px-5 py-3.5 font-mono text-[10px] font-bold tracking-[0.22em] uppercase transition-transform duration-300 hover:scale-[1.03]"
                style={{ borderColor: pass.accentSoft, color: pass.accent }}
              >
                <span
                  className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/buy:translate-y-0"
                  style={{ background: pass.accent }}
                />
                <span className="relative transition-colors duration-300 group-hover/buy:text-void">
                  BUY {formatPrice(pass.price)}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
