"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { ShaderAnimation } from "@/components/ui/shader-animation";
import { EVENT } from "@/lib/event";

const EASE = [0.16, 1, 0.3, 1] as const;
const EXTRUDE = 16;

type PreloaderProps = {
  onComplete: () => void;
};

export function Preloader({ onComplete }: PreloaderProps) {
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    if (reduced) {
      const timeout = window.setTimeout(() => {
        if (finished.current) return;
        finished.current = true;
        onComplete();
      }, 80);
      return () => window.clearTimeout(timeout);
    }

    const lift = window.setTimeout(() => setLeaving(true), 2400);
    const done = window.setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onComplete();
    }, 3180);
    return () => {
      window.clearTimeout(lift);
      window.clearTimeout(done);
    };
  }, [onComplete, reduced]);

  return (
    <motion.div
      className="fixed inset-0 z-100 overflow-hidden bg-void"
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: reduced ? 0.01 : 0.72, ease: EASE }}
      aria-hidden={leaving}
    >
      <ShaderAnimation className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(3,3,7,0.72)_100%)]" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: leaving ? 0 : 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
          className="mb-8 font-mono text-[10px] tracking-[0.42em] text-bone/55 uppercase"
        >
          {EVENT.host}
        </motion.p>

        <UtopiaTitle3D leaving={leaving} />

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: leaving ? 0 : 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.38, ease: EASE }}
          className="mt-10 font-mono text-[9px] tracking-[0.36em] text-bone/45 uppercase"
        >
          {EVENT.shortDateLabel} · {EVENT.venueCode}
        </motion.p>
      </div>
    </motion.div>
  );
}

function UtopiaTitle3D({ leaving }: { leaving: boolean }) {
  return (
    <div className="[perspective:1600px]">
      <motion.div
        className="relative"
        style={{ transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, rotateX: 38, rotateY: -32, z: -120, scale: 0.86 }}
        animate={
          leaving
            ? { opacity: 0, rotateX: 8, rotateY: 6, z: 80, scale: 1.06 }
            : {
                opacity: 1,
                rotateX: [18, 12, 18],
                rotateY: [-16, -9, -16],
                z: 0,
                scale: 1,
              }
        }
        transition={
          leaving
            ? { duration: 0.7, ease: EASE }
            : {
                opacity: { duration: 0.85, ease: EASE },
                scale: { duration: 0.85, ease: EASE },
                z: { duration: 0.85, ease: EASE },
                rotateX: { duration: 5.4, repeat: Infinity, ease: "easeInOut" },
                rotateY: { duration: 5.4, repeat: Infinity, ease: "easeInOut" },
              }
        }
      >
        {Array.from({ length: EXTRUDE }, (_, i) => {
          const face = i === 0;
          const t = i / (EXTRUDE - 1);
          return (
            <span
              key={i}
              aria-hidden={!face}
              className="font-display absolute top-1/2 left-1/2 text-[clamp(4.2rem,18vw,11.5rem)] leading-none font-medium tracking-[-0.055em] whitespace-nowrap"
              style={{
                transform: `translate(-50%, -50%) translateZ(${-i * 2.4}px)`,
                color: face
                  ? "#f7f7fb"
                  : t < 0.28
                    ? `rgba(188, 194, 255, ${0.7 - t})`
                    : t < 0.55
                      ? `rgba(96, 105, 240, ${0.55 - t * 0.35})`
                      : "#14132a",
                textShadow: face
                  ? "0 0 28px rgba(244,244,248,0.35), 0 0 70px rgba(125,139,255,0.45), 0 0 140px rgba(255,59,59,0.16)"
                  : "none",
              }}
            >
              {EVENT.name}
            </span>
          );
        })}
        <span className="font-display invisible text-[clamp(4.2rem,18vw,11.5rem)] leading-none font-medium tracking-[-0.055em] whitespace-nowrap">
          {EVENT.name}
        </span>
      </motion.div>
    </div>
  );
}
