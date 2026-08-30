"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Mail } from "lucide-react";

import { EVENT } from "@/lib/event";
import { Reveal } from "./ui/Reveal";
import { InstagramGlyph, YoutubeGlyph } from "./ui/SocialIcons";

const SOCIALS = [
  { label: "INSTAGRAM", href: EVENT.instagram, icon: InstagramGlyph },
  { label: "YOUTUBE", href: EVENT.youtube, icon: YoutubeGlyph },
];

export function Footer() {
  const reduced = useReducedMotion();
  const year = 2026;

  return (
    <footer
      id="info"
      className="relative mt-10 overflow-hidden border-t border-white/8"
    >
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[120%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(31,91,255,0.35),transparent_65%)] blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl px-5 pt-20 pb-10 sm:px-8 sm:pt-24">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-mono text-[9px] tracking-[0.36em] text-bone/35 uppercase">
              {EVENT.host}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-bone/50">
              We build rooms that don&apos;t exist the next morning.{" "}
              {EVENT.name} is our September escape — {EVENT.dateLabel}, five
              hours, one location, no spectators.
            </p>

            <a
              href={`mailto:${EVENT.email}`}
              className="group mt-7 inline-flex items-center gap-2.5 font-mono text-[10px] tracking-[0.24em] text-bone/70 uppercase transition-colors hover:text-cyan-glow"
            >
              <Mail className="size-3.5" />
              {EVENT.email}
              <ArrowUpRight className="size-3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.36em] text-bone/35 uppercase">
              FOLLOW
            </p>
            <ul className="mt-5 space-y-3.5">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 font-mono text-[10px] tracking-[0.26em] text-bone/60 uppercase transition-colors hover:text-bone"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full border border-white/10 transition-all duration-300 group-hover:border-cyan-glow/60 group-hover:text-cyan-glow group-hover:shadow-[0_0_20px_-4px_rgba(85,230,255,0.8)]">
                      <Icon className="size-3.5" />
                    </span>
                    {label}
                    <ArrowUpRight className="size-3 opacity-0 transition-all duration-300 group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.36em] text-bone/35 uppercase">
              THE DETAILS
            </p>
            <ul className="mt-5 space-y-3 font-mono text-[10px] tracking-[0.2em] text-bone/50 uppercase">
              <li>{EVENT.dateLabel}</li>
              <li>{EVENT.timeLabel}</li>
              <li>{EVENT.venueTeaser}</li>
              <li>{EVENT.ageLabel}</li>
            </ul>
          </div>
        </div>

        <Reveal className="mt-16" distance={30}>
          <div className="relative select-none">
            <motion.h2
              className="font-display text-center text-[21vw] leading-[0.8] tracking-[0.02em] uppercase text-stroke lg:text-[17rem]"
              animate={reduced ? {} : { opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            >
              {EVENT.name}
            </motion.h2>
            <span
              aria-hidden
              className="font-display pointer-events-none absolute inset-0 text-center text-[21vw] leading-[0.8] tracking-[0.02em] text-electric-500/12 uppercase blur-[6px] lg:text-[17rem]"
            >
              {EVENT.name}
            </span>
          </div>
        </Reveal>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-7 sm:flex-row">
          <p className="font-mono text-[9px] tracking-[0.24em] text-bone/30 uppercase">
            © {year} {EVENT.host}. ALL RIGHTS RESERVED.
          </p>
          <p className="font-mono text-[9px] tracking-[0.24em] text-bone/30 uppercase">
            THE PARTY FOR THE RIGHT PEOPLE
          </p>
        </div>
      </div>
    </footer>
  );
}
