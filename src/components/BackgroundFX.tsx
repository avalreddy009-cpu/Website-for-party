"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

import { MaskMotif } from "./MaskMotif";

export function BackgroundFX() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 40, damping: 20, mass: 0.6 });
  const smoothY = useSpring(pointerY, { stiffness: 40, damping: 20, mass: 0.6 });

  const maskY = useTransform(scrollYProgress, [0, 1], ["0%", "-14%"]);
  const maskScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.12, 1.02]);
  const maskOpacity = useTransform(
    scrollYProgress,
    [0, 0.25, 0.7, 1],
    [0.5, 0.26, 0.34, 0.6],
  );
  const maskRotate = useTransform(scrollYProgress, [0, 1], [0, 6]);

  const glowOneX = useTransform(smoothX, [-1, 1], [-60, 60]);
  const glowOneY = useTransform(smoothY, [-1, 1], [-40, 40]);
  const glowTwoX = useTransform(smoothX, [-1, 1], [45, -45]);
  const glowTwoY = useTransform(smoothY, [-1, 1], [35, -35]);

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
      <div className="absolute inset-0 bg-[#030308]" />

      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(20,67,219,0.30),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_110%,rgba(107,59,255,0.22),transparent_65%)]" />

      <motion.div
        style={{ x: glowOneX, y: glowOneY }}
        className="absolute top-[-18%] left-[-12%] h-[62vw] w-[62vw] rounded-full bg-[radial-gradient(circle,rgba(31,91,255,0.55),transparent_62%)] blur-3xl animate-glow-pulse"
      />
      <motion.div
        style={{ x: glowTwoX, y: glowTwoY }}
        className="absolute top-[38%] right-[-16%] h-[54vw] w-[54vw] rounded-full bg-[radial-gradient(circle,rgba(85,230,255,0.34),transparent_64%)] blur-3xl animate-drift-slow"
      />
      <div className="absolute bottom-[-22%] left-[22%] h-[48vw] w-[48vw] rounded-full bg-[radial-gradient(circle,rgba(107,59,255,0.4),transparent_66%)] blur-3xl animate-drift-slower" />

      <motion.div
        style={
          reduced
            ? undefined
            : {
                y: maskY,
                scale: maskScale,
                opacity: maskOpacity,
                rotate: maskRotate,
              }
        }
        className="absolute top-1/2 left-1/2 h-[132vh] w-[132vh] -translate-x-1/2 -translate-y-1/2 opacity-40 mix-blend-screen"
      >
        <MaskMotif className="h-full w-full drop-shadow-[0_0_120px_rgba(31,91,255,0.55)]" />
      </motion.div>

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(110,166,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,166,255,0.055) 1px, transparent 1px)",
          backgroundSize: "88px 88px",
          maskImage:
            "radial-gradient(120% 90% at 50% 35%, #000 35%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(120% 90% at 50% 35%, #000 35%, transparent 78%)",
        }}
      />

      <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.028)_0px,rgba(255,255,255,0.028)_1px,transparent_1px,transparent_4px)] opacity-60" />

      <div className="noise-overlay absolute inset-0 opacity-[0.16] mix-blend-soft-light" />

      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_50%,transparent_38%,rgba(3,3,8,0.86)_100%)]" />
    </div>
  );
}
