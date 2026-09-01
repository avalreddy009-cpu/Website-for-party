"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Mail, MapPin } from "lucide-react";

import { EVENT } from "@/lib/event";
import { Reveal } from "./ui/Reveal";
import { InstagramGlyph } from "./ui/SocialIcons";

const SOCIALS = [
  { label: "INSTAGRAM", href: EVENT.instagram, icon: InstagramGlyph },
];

export function Footer() {
  const reduced = useReducedMotion();

  return (
    <footer
      id="contact"
      className="relative mt-10 overflow-hidden border-t border-white/8"
    >
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[120%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(96,105,240,0.22),transparent_65%)] blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl px-5 pt-20 pb-10 sm:px-8 sm:pt-24">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-mono text-[9px] tracking-[0.34em] text-bone/35 uppercase">
              {EVENT.host}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-bone/50">
              UTOPIA is our September chapter — one Sunday afternoon, one room,
              and a crowd that came to dance instead of drink. If that sounds
              like your people, you already know what to do.
            </p>

            <a
              href={`mailto:${EVENT.email}`}
              className="group mt-7 inline-flex items-center gap-2.5 font-mono text-[10px] tracking-[0.22em] text-bone/70 uppercase transition-colors hover:text-electric-200"
            >
              <Mail className="size-3.5" />
              {EVENT.email}
              <ArrowUpRight className="size-3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.34em] text-bone/35 uppercase">
              FOLLOW
            </p>
            <ul className="mt-5 space-y-3.5">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 font-mono text-[10px] tracking-[0.24em] text-bone/60 uppercase transition-colors hover:text-bone"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full border border-white/10 transition-all duration-300 group-hover:border-electric-300/60 group-hover:text-electric-200 group-hover:shadow-[0_0_20px_-6px_rgba(154,164,255,0.9)]">
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
            <p className="font-mono text-[9px] tracking-[0.34em] text-bone/35 uppercase">
              THE DETAILS
            </p>
            <ul className="mt-5 space-y-3 font-mono text-[10px] tracking-[0.18em] text-bone/50 uppercase">
              <li>{EVENT.dateLabel}</li>
              <li>{EVENT.timeLabel}</li>
              <li>{EVENT.venueName}</li>
              <li className="text-signal-soft/80">{EVENT.policyShort}</li>
            </ul>
            <a
              href={EVENT.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-5 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-bone/70 uppercase transition-colors hover:text-electric-200"
            >
              <MapPin className="size-3.5" />
              OPEN IN MAPS
              <ArrowUpRight className="size-3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>

        <Reveal className="mt-16" distance={30}>
          <div className="relative select-none">
            <motion.h2
              className="font-display text-stroke text-center text-[22vw] leading-[0.85] font-light tracking-[0.01em] uppercase lg:text-[16rem]"
              animate={reduced ? {} : { opacity: [0.5, 0.95, 0.5] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            >
              {EVENT.name}
            </motion.h2>
            <span
              aria-hidden
              className="font-display pointer-events-none absolute inset-0 text-center text-[22vw] leading-[0.85] font-light tracking-[0.01em] text-electric-500/10 uppercase blur-[6px] lg:text-[16rem]"
            >
              {EVENT.name}
            </span>
          </div>
        </Reveal>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-7 sm:flex-row">
          <p className="font-mono text-[9px] tracking-[0.22em] text-bone/30 uppercase">
            © 2026 {EVENT.host}. ALL RIGHTS RESERVED.
          </p>
          <p className="font-mono text-[9px] tracking-[0.22em] text-bone/30 uppercase">
            {EVENT.tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
