"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";

type NeonButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "solid" | "ghost";
  size?: "md" | "lg";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
};

/**
 * Magnetic CTA: the label drifts toward the cursor while an aurora sweep and a
 * breathing halo run underneath, so the button feels charged before it's clicked.
 */
export function NeonButton({
  children,
  onClick,
  href,
  variant = "solid",
  size = "md",
  className,
  disabled,
  type = "button",
}: NeonButtonProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 18 });
  const springY = useSpring(y, { stiffness: 260, damping: 18 });

  const handleMove = (event: React.PointerEvent) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(((event.clientX - rect.left) / rect.width - 0.5) * 18);
    y.set(((event.clientY - rect.top) / rect.height - 0.5) * 12);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const sizing =
    size === "lg"
      ? "px-9 py-4 text-xs sm:px-12 sm:py-5 sm:text-sm"
      : "px-6 py-3 text-[11px]";

  const base = `group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full font-mono font-bold tracking-[0.2em] uppercase transition-colors duration-300 ${sizing} ${
    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
  } ${className ?? ""}`;

  const content = (
    <>
      {variant === "solid" ? (
        <>
          <span className="absolute inset-0 bg-bone" />
          <span className="absolute inset-0 translate-y-full bg-gradient-to-br from-electric-500 via-electric-400 to-violet-haze transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0" />
          <span className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:shadow-[inset_0_0_30px_rgba(255,255,255,0.35)]" />
        </>
      ) : (
        <>
          <span className="absolute inset-0 border border-bone/25 rounded-full transition-colors duration-300 group-hover:border-electric-300/70" />
          <span className="absolute inset-0 bg-electric-300/0 transition-colors duration-500 group-hover:bg-electric-300/8" />
        </>
      )}

      {!reduced && !disabled && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-full"
          animate={{
            boxShadow: [
              "0 0 24px -6px rgba(96,105,240,0.5)",
              "0 0 62px 4px rgba(125,139,255,0.45)",
              "0 0 24px -6px rgba(96,105,240,0.5)",
            ],
          }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <motion.span
        style={reduced ? undefined : { x: springX, y: springY }}
        className={`relative z-10 flex items-center gap-2.5 whitespace-nowrap ${
          variant === "solid"
            ? "text-void transition-colors duration-300 group-hover:text-bone"
            : "text-bone/80 group-hover:text-bone"
        }`}
      >
        {children}
      </motion.span>
    </>
  );

  if (href) {
    return (
      <motion.a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        className={base}
        onPointerMove={handleMove}
        onPointerLeave={reset}
        whileTap={{ scale: 0.97 }}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={base}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      whileTap={disabled ? undefined : { scale: 0.97 }}
    >
      {content}
    </motion.button>
  );
}
