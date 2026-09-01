"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { ShaderAnimation } from "@/components/ui/shader-animation";
import { EVENT } from "@/lib/event";

const EASE = [0.16, 1, 0.3, 1] as const;
const EXTRUDE = 22;
const TITLE_CLASS =
  "font-display text-[clamp(4.2rem,18vw,11.5rem)] leading-none font-medium tracking-[-0.055em] whitespace-nowrap";
/** Long enough to read UTOPIA, short enough not to drag. Total ~4.5s. */
const HOLD_MS = 3700;
const FADE_MS = 800;

type PreloaderProps = {
  onComplete: () => void;
};

export function Preloader({ onComplete }: PreloaderProps) {
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    const lift = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const done = window.setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onComplete();
    }, HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(lift);
      window.clearTimeout(done);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-100 overflow-hidden bg-void"
      data-intro="hold"
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: reduced ? 0.2 : FADE_MS / 1000, ease: EASE }}
      aria-hidden={leaving}
    >
      <ShaderAnimation className="absolute inset-0 h-full w-full" />

      {/* Deep vignette so the rings glow out of black instead of filling the frame. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(3,3,7,0.78)_94%)]" />
      {/* Projector scanlines + grain, same room tone as the rest of the site. */}
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.02)_0px,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_4px)] opacity-60" />
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.13] mix-blend-soft-light" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: leaving ? 0 : 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
          className="mb-9 flex items-center gap-4"
        >
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-electric-300/50 sm:w-16" />
          <p className="font-mono text-[10px] tracking-[0.42em] text-electric-200/65 uppercase">
            {EVENT.host}
          </p>
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-electric-300/50 sm:w-16" />
        </motion.div>

        <UtopiaTitle3D leaving={leaving} />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: leaving ? 0 : 1 }}
          transition={{ duration: 0.6, delay: 0.32, ease: EASE }}
          className="font-display mt-9 text-lg text-bone/50 italic sm:text-xl"
        >
          {EVENT.subTagline}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: leaving ? 0 : 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.44, ease: EASE }}
          className="mt-5 font-mono text-[9px] tracking-[0.36em] text-bone/40 uppercase"
        >
          {EVENT.shortDateLabel} · {EVENT.venueCode}
        </motion.p>
      </div>
    </motion.div>
  );
}

function UtopiaTitle3D({ leaving }: { leaving: boolean }) {
  return (
    <div className="[perspective:1500px]">
      <motion.div
        className="relative"
        style={{ transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, rotateX: 42, rotateY: -36, z: -160, scale: 0.82 }}
        animate={
          leaving
            ? { opacity: 0, rotateX: 6, rotateY: 8, z: 90, scale: 1.07 }
            : {
                opacity: 1,
                rotateX: [20, 13, 20],
                rotateY: [-18, -10, -18],
                z: 0,
                scale: 1,
              }
        }
        transition={
          leaving
            ? { duration: FADE_MS / 1000, ease: EASE }
            : {
                opacity: { duration: 0.75, ease: EASE },
                scale: { duration: 0.75, ease: EASE },
                z: { duration: 0.75, ease: EASE },
                rotateX: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
                rotateY: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
              }
        }
      >
        {Array.from({ length: EXTRUDE }, (_, layer) => {
          const i = EXTRUDE - 1 - layer;
          const face = i === 0;
          const t = i / (EXTRUDE - 1);
          return (
            <span
              key={i}
              aria-hidden={!face}
              className={`${TITLE_CLASS} absolute top-1/2 left-1/2`}
              style={{
                transform: `translate(-50%, -50%) translateZ(${-i * 2.6}px)`,
                color: face
                  ? "#2a2c3a"
                  : t < 0.22
                    ? `rgba(58, 62, 92, ${0.9 - t * 0.2})`
                    : t < 0.5
                      ? `rgba(32, 34, 58, ${0.85 - t * 0.2})`
                      : `rgba(14, 15, 28, ${0.95 - t * 0.15})`,
                textShadow: face
                  ? "0 1px 0 rgba(244,244,248,0.22), 0 0 18px rgba(125,139,255,0.22), 0 0 40px rgba(3,3,7,0.45)"
                  : "none",
              }}
            >
              {EVENT.name}
            </span>
          );
        })}

        {/* Faint floor reflection to sell the object sitting in space. */}
        <span
          aria-hidden
          className={`${TITLE_CLASS} absolute top-1/2 left-1/2`}
          style={{
            transform:
              "translate(-50%, -50%) translateZ(-2px) translateY(96%) scaleY(-0.9)",
            color: "rgba(42, 44, 58, 0.38)",
            maskImage:
              "linear-gradient(to bottom, transparent 18%, rgba(0,0,0,0.85) 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 18%, rgba(0,0,0,0.85) 100%)",
            filter: "blur(2px)",
          }}
        >
          {EVENT.name}
        </span>

        <span className={`${TITLE_CLASS} invisible`}>{EVENT.name}</span>
      </motion.div>
    </div>
  );
}
