"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowDown, MapPin, Ticket } from "lucide-react";

import { EVENT } from "@/lib/event";
import { NeonButton } from "./ui/NeonButton";
import { SplitText } from "./ui/Reveal";

const EASE = [0.16, 1, 0.3, 1] as const;

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

  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "26%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const posterY = useTransform(scrollYProgress, [0, 1], ["0%", "-14%"]);

  return (
    <section
      id="top"
      ref={sectionRef}
      className="relative flex min-h-[100svh] items-center overflow-hidden px-5 pt-32 pb-24 sm:px-8 lg:pt-28"
    >
      {/* Real crowd footage from the teaser, graded down to room tone. */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/media/crowd-blue.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="film object-cover object-center opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030307] via-[#030307]/55 to-[#030307]" />
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_50%,transparent,rgba(3,3,7,0.85))]" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <motion.div
          style={
            reduced ? undefined : { y: contentY, opacity: contentOpacity }
          }
          className="flex flex-col items-center text-center lg:items-start lg:text-left"
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
            className="glass flex items-center gap-3 rounded-full px-4 py-2"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-electric-300 opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-electric-300" />
            </span>
            <span className="font-mono text-[9px] tracking-[0.34em] text-bone/70 uppercase sm:text-[10px]">
              {EVENT.host} · CHAPTER 01
            </span>
          </motion.div>

          <h1 className="mt-8">
            <span className="sr-only">
              {EVENT.name} by {EVENT.host} — {EVENT.tagline}
            </span>
            <span className="font-display glow-text block text-[22vw] leading-[0.82] font-light tracking-[-0.015em] text-bone uppercase sm:text-[13rem] lg:text-[11rem] xl:text-[13rem]">
              {ready ? (
                <SplitText
                  text={EVENT.name}
                  animateOnMount
                  delay={0.2}
                  stagger={0.075}
                  lineClassName="pb-[0.06em]"
                />
              ) : (
                <span className="opacity-0">{EVENT.name}</span>
              )}
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.8, ease: EASE }}
            className="font-mono text-[10px] tracking-[0.4em] text-bone/50 uppercase sm:text-xs"
          >
            BY {EVENT.host}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, delay: 0.95, ease: EASE }}
            className="font-display mt-8 max-w-xl text-2xl leading-[1.15] font-light text-bone italic sm:text-4xl"
          >
            {EVENT.tagline}.
            <span className="text-electric-300"> {EVENT.subTagline}.</span>
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, delay: 1.05, ease: EASE }}
            className="mt-5 max-w-md text-sm leading-relaxed text-bone/55"
          >
            Sunday afternoon, five hours, one room in Hyderabad. Unlimited food,
            unlimited mocktails, and not a single drop of alcohol on the premises.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, delay: 1.2, ease: EASE }}
            className="mt-10 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4"
          >
            <NeonButton href="#passes" size="lg">
              <Ticket className="size-4" strokeWidth={2} />
              GET PASSES
            </NeonButton>
            <NeonButton href="#venue" variant="ghost" size="lg">
              <MapPin className="size-4" strokeWidth={2} />
              THE VENUE
            </NeonButton>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={ready ? { opacity: 1 } : {}}
            transition={{ duration: 1, delay: 1.35 }}
            className="mt-12 grid w-full max-w-lg grid-cols-2 gap-x-8 gap-y-6 border-t border-white/10 pt-8 sm:grid-cols-3"
          >
            {[
              { label: "WHEN", value: "SUN 27 SEP" },
              { label: "DOORS", value: "12 — 5 PM" },
              { label: "WHERE", value: "OUZO CLUB" },
            ].map((item) => (
              <div key={item.label}>
                <dt className="font-mono text-[8px] tracking-[0.3em] text-bone/35 uppercase">
                  {item.label}
                </dt>
                <dd className="font-display mt-1.5 text-lg tracking-[0.02em] text-bone uppercase sm:text-xl">
                  {item.value}
                </dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        {/* The actual poster, propped up like it's taped to a wall. */}
        <motion.div
          style={reduced ? undefined : { y: posterY }}
          initial={{ opacity: 0, y: 60, rotate: -4 }}
          animate={ready ? { opacity: 1, y: 0, rotate: -2.2 } : {}}
          transition={{ duration: 1.3, delay: 0.5, ease: EASE }}
          className="relative mx-auto w-full max-w-sm lg:max-w-none"
        >
          <motion.div
            animate={reduced ? {} : { rotate: [-2.2, -0.8, -2.2], y: [0, -10, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(96,105,240,0.35),transparent_68%)] blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/12 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95)]">
              <Image
                src="/media/poster.jpg"
                alt={`${EVENT.name} by ${EVENT.host} — ${EVENT.dateLabel}, ${EVENT.timeLabel}`}
                width={1200}
                height={1184}
                priority
                sizes="(max-width: 1024px) 90vw, 460px"
                className="h-auto w-full"
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(3,3,7,0.55),transparent_38%)]" />
              <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-soft-light" />
            </div>
            <p className="mt-4 text-center font-mono text-[9px] tracking-[0.28em] text-bone/30 uppercase">
              THE POSTER · SEP 27 · HYDERABAD
            </p>
          </motion.div>
        </motion.div>
      </div>

      <motion.a
        href="#story"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : {}}
        transition={{ duration: 1, delay: 1.6 }}
        className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 font-mono text-[9px] tracking-[0.32em] text-bone/30 uppercase transition-colors hover:text-bone/70"
      >
        KEEP GOING
        <motion.span
          animate={reduced ? {} : { y: [0, 7, 0] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown className="size-3.5" />
        </motion.span>
      </motion.a>
    </section>
  );
}
