"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  UtensilsCrossed,
} from "lucide-react";

import { EVENT } from "@/lib/event";
import { Countdown } from "./Countdown";
import { VenueGallery } from "./VenueGallery";
import { Reveal, SectionLabel } from "./ui/Reveal";

const DETAILS = [
  {
    icon: CalendarDays,
    label: "DATE",
    value: EVENT.dateLabel,
    note: "A Sunday, on purpose. Monday is not our problem.",
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
    value: EVENT.venueName,
    note: `${EVENT.venueCity} — full address in the maps link.`,
  },
  {
    icon: UtensilsCrossed,
    label: "INCLUDED",
    value: "FOOD + MOCKTAILS",
    note: "Unlimited, both of them. No drink tokens, no queueing to pay.",
  },
];

export function EventInfo() {
  const reduced = useReducedMotion();

  return (
    <section
      id="venue"
      className="relative mx-auto w-full max-w-7xl px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Reveal>
            <SectionLabel>[ 03 ] THE VENUE</SectionLabel>
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="font-display mt-8 text-4xl leading-[1.05] font-light text-bone sm:text-6xl">
              {EVENT.venueName.split(" and ")[0]}
              <span className="block text-bone/45 italic">and Kitchen</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-bone/60">
              Low ceilings, loud rig, and a kitchen that stays open the whole
              five hours. It&apos;s in {EVENT.venueCity} — tap Maps, then swipe
              the photos like a place page.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.18}>
          <a
            href={EVENT.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group glass inline-flex items-center gap-3 rounded-full py-3 pr-5 pl-4 font-mono text-[10px] tracking-[0.22em] text-bone/85 uppercase transition-all duration-300 hover:border-electric-300/50 hover:text-bone"
          >
            <MapPin className="size-4 text-electric-300" strokeWidth={2} />
            {EVENT.venueName}
            <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </Reveal>
      </div>

      <Reveal delay={0.12} className="mt-10">
        <VenueGallery />
      </Reveal>

      <div className="mt-16 grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <ul className="divide-y divide-white/8 border-y border-white/8">
          {DETAILS.map(({ icon: Icon, label, value, note }, i) => (
            <motion.li
              key={label}
              initial={{ opacity: 0, x: reduced ? 0 : -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{
                duration: 0.7,
                delay: i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="group relative flex items-start gap-4 py-5 sm:gap-6"
            >
              <span className="absolute inset-y-0 left-0 w-0 bg-gradient-to-r from-electric-500/10 to-transparent transition-all duration-500 group-hover:w-full" />

              <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-electric-300/22 bg-electric-500/6 text-electric-200 transition-all duration-500 group-hover:border-electric-300/60 group-hover:shadow-[0_0_22px_-6px_rgba(125,139,255,0.9)]">
                <Icon className="size-4" strokeWidth={1.8} />
              </span>

              <div className="relative flex-1">
                <p className="font-mono text-[9px] tracking-[0.3em] text-bone/35 uppercase">
                  {label}
                </p>
                <p className="font-display mt-1.5 text-xl leading-tight text-bone sm:text-2xl">
                  {value}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-bone/45">
                  {note}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>

        <Reveal distance={50}>
          <div className="glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-9">
            <div className="animate-glow-pulse pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-[radial-gradient(circle,rgba(96,105,240,0.4),transparent_65%)] blur-2xl" />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(to_bottom,rgba(154,164,255,0.12),transparent)]"
              animate={reduced ? {} : { y: ["-100%", "420%"] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: "linear" }}
            />
            <div className="relative">
              <Countdown />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
