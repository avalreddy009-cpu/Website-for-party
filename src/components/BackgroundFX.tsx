"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * Room tone for the whole page: near-black, two slow periwinkle glows that
 * drift with the cursor, projector scanlines and film grain on top. Deliberately
 * quiet — the photography and the poster do the talking.
 */
export function BackgroundFX() {
  const reduced = useReducedMotion();

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 38, damping: 22, mass: 0.7 });
  const smoothY = useSpring(pointerY, { stiffness: 38, damping: 22, mass: 0.7 });

  const glowOneX = useTransform(smoothX, [-1, 1], [-44, 44]);
  const glowOneY = useTransform(smoothY, [-1, 1], [-30, 30]);
  const glowTwoX = useTransform(smoothX, [-1, 1], [34, -34]);
  const glowTwoY = useTransform(smoothY, [-1, 1], [26, -26]);

  useEffect(() => {
    if (reduced) return;
    const onMove = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth) * 2 - 1);
      pointerY.set((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerX, pointerY, reduced]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#030307]" />

      <motion.div
        style={{ x: glowOneX, y: glowOneY }}
        className="animate-glow-pulse absolute top-[-24%] left-[-18%] h-[54vw] w-[54vw] rounded-full bg-[radial-gradient(circle,rgba(96,105,240,0.22),transparent_62%)] blur-3xl"
      />
      <motion.div
        style={{ x: glowTwoX, y: glowTwoY }}
        className="animate-drift-slow absolute top-[46%] right-[-22%] h-[46vw] w-[46vw] rounded-full bg-[radial-gradient(circle,rgba(125,139,255,0.14),transparent_64%)] blur-3xl"
      />
      <div className="animate-drift-slower absolute bottom-[-28%] left-[26%] h-[40vw] w-[40vw] rounded-full bg-[radial-gradient(circle,rgba(255,59,59,0.07),transparent_66%)] blur-3xl" />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(154,164,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(154,164,255,0.04) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          maskImage:
            "radial-gradient(120% 90% at 50% 30%, #000 30%, transparent 76%)",
          WebkitMaskImage:
            "radial-gradient(120% 90% at 50% 30%, #000 30%, transparent 76%)",
        }}
      />

      <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.022)_0px,rgba(255,255,255,0.022)_1px,transparent_1px,transparent_4px)] opacity-70" />

      <div className="noise-overlay absolute inset-0 opacity-[0.15] mix-blend-soft-light" />

      <div className="absolute inset-0 bg-[radial-gradient(110%_110%_at_50%_45%,transparent_28%,rgba(2,2,6,0.9)_94%)]" />
    </div>
  );
}
