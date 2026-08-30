"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  once?: boolean;
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function Reveal({
  children,
  className,
  delay = 0,
  distance = 40,
  once = true,
}: RevealProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : distance, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount: 0.35 }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

type SplitTextProps = {
  text: string;
  className?: string;
  lineClassName?: string;
  delay?: number;
  stagger?: number;
  by?: "char" | "word";
  animateOnMount?: boolean;
};

/**
 * Mask-based reveal: each token sits in an overflow-hidden box and slides up
 * from below the baseline, which reads as a poster being printed line by line.
 */
export function SplitText({
  text,
  className,
  lineClassName,
  delay = 0,
  stagger = 0.045,
  by = "char",
  animateOnMount = false,
}: SplitTextProps) {
  const reduced = useReducedMotion();
  const tokens = by === "char" ? Array.from(text) : text.split(" ");

  const container: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduced ? 0 : stagger, delayChildren: delay },
    },
  };

  const child: Variants = {
    hidden: { y: reduced ? 0 : "110%", opacity: reduced ? 0 : 1, skewY: reduced ? 0 : 7 },
    visible: {
      y: "0%",
      opacity: 1,
      skewY: 0,
      transition: { duration: 0.95, ease: EASE },
    },
  };

  return (
    <motion.span
      className={className}
      variants={container}
      initial="hidden"
      {...(animateOnMount
        ? { animate: "visible" }
        : { whileInView: "visible", viewport: { once: true, amount: 0.4 } })}
      aria-label={text}
    >
      {tokens.map((token, i) => (
        <span
          key={`${token}-${i}`}
          className={`inline-block overflow-hidden align-bottom ${lineClassName ?? ""}`}
          aria-hidden
        >
          <motion.span className="inline-block" variants={child}>
            {token === " " ? "\u00A0" : token}
            {by === "word" && i < tokens.length - 1 ? "\u00A0" : null}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

type SectionLabelProps = {
  children: ReactNode;
  className?: string;
};

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div
      className={`flex items-center gap-3 font-mono text-[10px] tracking-[0.42em] text-electric-200/70 uppercase sm:text-xs ${className ?? ""}`}
    >
      <span className="from-electric-400 h-px w-8 bg-gradient-to-r to-transparent sm:w-14" />
      {children}
    </div>
  );
}
