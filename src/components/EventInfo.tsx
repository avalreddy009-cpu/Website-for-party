"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  Clock3,
  Lock,
  MapPin,
  ShieldCheck,
  Volume2,
} from "lucide-react";

import { EVENT } from "@/lib/event";
import { Countdown } from "./Countdown";
import { Reveal, SectionLabel, SplitText } from "./ui/Reveal";

const DETAILS = [
  {
    icon: CalendarDays,
    label: "DATE",
    value: EVENT.dateLabel,
    note: "One afternoon. No repeat.",
  },
  {
    icon: Clock3,
    label: "TIME",
    value: EVENT.timeLabel,
    note: EVENT.doorsLabel,
  },
  {
    icon: MapPin,
    label: "VENUE",
    value: EVENT.venueTeaser,
    note: EVENT.cityHint,
  },
  {
    icon: ShieldCheck,
    label: "ENTRY",
    value: EVENT.ageLabel,
    note: "Pass + ID at the gate, no exceptions.",
  },
];

export function EventInfo() {
  const reduced = useReducedMotion();

  return (
    <section
      id="event"
      className="relative mx-auto w-full max-w-7xl px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
        <div>
          <Reveal>
            <SectionLabel>EVENT DOSSIER / 001</SectionLabel>
          </Reveal>

          <h2 className="font-display mt-7 text-5xl leading-[0.88] tracking-[0.01em] text-bone uppercase sm:text-7xl lg:text-8xl">
            <SplitText text="SEPTEMBER" lineClassName="pb-[0.08em]" />
            <span className="block text-stroke">
              <SplitText
                text="TWENTY SEVEN"
                by="word"
                stagger={0.09}
                lineClassName="pb-[0.08em]"
              />
            </span>
          </h2>

          <Reveal delay={0.15}>
            <p className="mt-8 max-w-lg text-sm leading-relaxed text-bone/55 sm:text-base">
              Five hours of daylight distortion. A single room, a wall of sound,
              and a crowd that was invited for a reason.{" "}
              <span className="text-bone/90">
                {EVENT.name} is not a festival — it is a disappearance.
              </span>
            </p>
          </Reveal>

          <ul className="mt-12 divide-y divide-white/8 border-y border-white/8">
            {DETAILS.map(({ icon: Icon, label, value, note }, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, x: reduced ? 0 : -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{
                  duration: 0.7,
                  delay: i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="group relative flex items-start gap-4 py-5 sm:gap-6"
              >
                <span className="absolute inset-y-0 left-0 w-0 bg-gradient-to-r from-electric-500/12 to-transparent transition-all duration-500 group-hover:w-full" />

                <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-electric-300/25 bg-electric-500/8 text-electric-200 transition-all duration-500 group-hover:border-cyan-glow/60 group-hover:text-cyan-glow group-hover:shadow-[0_0_24px_-4px_rgba(85,230,255,0.7)]">
                  <Icon className="size-4" strokeWidth={2} />
                </span>

                <div className="relative flex-1">
                  <p className="font-mono text-[9px] tracking-[0.34em] text-bone/35 uppercase">
                    {label}
                  </p>
                  <p className="font-display mt-1.5 text-xl tracking-[0.03em] text-bone uppercase sm:text-2xl">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-bone/45">{note}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-6">
          <Reveal distance={60}>
            <div className="glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-9">
              <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-[radial-gradient(circle,rgba(31,91,255,0.45),transparent_65%)] blur-2xl animate-glow-pulse" />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(to_bottom,rgba(85,230,255,0.14),transparent)]"
                animate={reduced ? {} : { y: ["-100%", "420%"] }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              />
              <div className="relative">
                <Countdown />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12} distance={60}>
            <div className="group glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <SectionLabel>VENUE TEASER</SectionLabel>
                <Lock className="size-3.5 text-bone/30" />
              </div>

              <p className="font-display mt-6 text-3xl leading-none tracking-[0.02em] text-transparent uppercase sm:text-4xl [-webkit-text-stroke:1.5px_rgba(243,245,255,0.45)]">
                CLASSIFIED
              </p>

              <p className="mt-4 max-w-sm text-xs leading-relaxed text-bone/50 sm:text-sm">
                {EVENT.venueHint}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {["WAREHOUSE", "OPEN AIR DECK", "360° SOUND"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[9px] tracking-[0.24em] text-bone/55 uppercase transition-colors duration-300 hover:border-cyan-glow/50 hover:text-cyan-glow"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-7 flex items-center gap-2.5 font-mono text-[9px] tracking-[0.28em] text-bone/35 uppercase">
                <Volume2 className="size-3.5 text-electric-300" />
                LINEUP ANNOUNCEMENT IMMINENT
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
