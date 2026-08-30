"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowDown, Clock, Compass, Ticket } from "lucide-react";

import { EVENT } from "@/lib/event";
import { NeonButton } from "./ui/NeonButton";
import { SplitText } from "./ui/Reveal";

const EASE = [0.16, 1, 0.3, 1] as const;

const META = [
  { icon: Compass, label: EVENT.dateLabel },
  { icon: Clock, label: EVENT.timeLabel },
  { icon: Ticket, label: EVENT.venueTeaser },
];

type HeroProps = {
  ready: boolean;
};

export function Hero({ ready }: HeroProps) {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "34%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const contentBlur = useTransform(
    scrollYProgress,
    [0, 1],
    ["blur(0px)", "blur(8px)"],
  );

  return (
    <section
      id="top"
      ref={sectionRef}
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pt-28 pb-20 sm:px-8"
    >
      <motion.div
        style={
          reduced
            ? undefined
            : { y: contentY, opacity: contentOpacity, filter: contentBlur }
        }
        className="relative z-10 flex w-full max-w-6xl flex-col items-center text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
          className="glass mb-8 flex items-center gap-3 rounded-full px-4 py-2"
        >
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-glow opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-cyan-glow" />
          </span>
          <span className="font-mono text-[9px] tracking-[0.4em] text-bone/70 uppercase sm:text-[10px]">
            {EVENT.host} PRESENTS
          </span>
        </motion.div>

        <h1 className="relative select-none">
          <span className="sr-only">
            {EVENT.name} by {EVENT.host}
          </span>

          <span className="relative block">
            {/* Chromatic ghost layers behind the headline for a mis-registered print feel. */}
            <motion.span
              aria-hidden
              className="font-display absolute inset-0 text-[19vw] leading-[0.78] tracking-[-0.01em] text-electric-500/55 uppercase mix-blend-screen blur-[3px] sm:text-[15rem] lg:text-[19rem]"
              animate={
                reduced || !ready
                  ? {}
                  : { x: [-7, 5, -4], y: [4, -3, 5], opacity: [0.45, 0.7, 0.45] }
              }
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            >
              {EVENT.name}
            </motion.span>
            <motion.span
              aria-hidden
              className="font-display absolute inset-0 text-[19vw] leading-[0.78] tracking-[-0.01em] text-cyan-glow/45 uppercase mix-blend-screen blur-[5px] sm:text-[15rem] lg:text-[19rem]"
              animate={
                reduced || !ready
                  ? {}
                  : { x: [6, -5, 7], y: [-5, 4, -3], opacity: [0.35, 0.6, 0.35] }
              }
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            >
              {EVENT.name}
            </motion.span>

            <span className="font-display relative block text-[19vw] leading-[0.78] tracking-[-0.01em] text-bone uppercase glow-text sm:text-[15rem] lg:text-[19rem]">
              {ready ? (
                <SplitText
                  text={EVENT.name}
                  animateOnMount
                  delay={0.2}
                  stagger={0.07}
                  lineClassName="pb-[0.06em]"
                />
              ) : (
                <span className="opacity-0">{EVENT.name}</span>
              )}
            </span>
          </span>

          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.85, ease: EASE }}
            className="mt-1 flex items-center justify-center gap-3 font-mono text-[10px] tracking-[0.44em] text-bone/55 uppercase sm:gap-5 sm:text-xs"
          >
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-electric-300/60 sm:w-20" />
            BY {EVENT.host}
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-electric-300/60 sm:w-20" />
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, delay: 1, ease: EASE }}
          className="mt-10 max-w-2xl text-balance"
        >
          <span className="font-display block text-2xl leading-[1.05] tracking-[0.02em] text-bone uppercase sm:text-4xl">
            {EVENT.tagline}
          </span>
          <span className="mt-2 block font-mono text-[10px] tracking-[0.3em] text-electric-200/75 uppercase sm:text-xs">
            {EVENT.subTagline}
          </span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, delay: 1.15, ease: EASE }}
          className="mt-11 flex flex-col items-center gap-4 sm:flex-row sm:gap-5"
        >
          <NeonButton href="#passes" size="lg">
            <Ticket className="size-4" strokeWidth={2.5} />
            GET PASSES
          </NeonButton>
          <NeonButton href="#event" variant="ghost" size="lg">
            EVENT DETAILS
          </NeonButton>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0 }}
          animate={ready ? { opacity: 1 } : {}}
          transition={{ duration: 1, delay: 1.35 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
        >
          {META.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.26em] text-bone/50 uppercase transition-colors hover:text-bone/85"
            >
              <Icon className="size-3.5 text-electric-300" strokeWidth={2} />
              {label}
            </li>
          ))}
        </motion.ul>
      </motion.div>

      <motion.a
        href="#event"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : {}}
        transition={{ duration: 1, delay: 1.6 }}
        className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 font-mono text-[9px] tracking-[0.35em] text-bone/35 uppercase transition-colors hover:text-bone/80"
      >
        SCROLL
        <motion.span
          animate={reduced ? {} : { y: [0, 8, 0] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown className="size-3.5" />
        </motion.span>
      </motion.a>
    </section>
  );
}
