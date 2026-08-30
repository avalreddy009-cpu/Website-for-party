"use client";

import { Mail, ShieldCheck, Zap } from "lucide-react";

import { EVENT } from "@/lib/event";
import { PASSES, type PassTier } from "@/lib/passes";
import { PassCard } from "./PassCard";
import { Reveal, SectionLabel } from "./ui/Reveal";

type PassTiersProps = {
  onBuy: (pass: PassTier) => void;
};

export function PassTiers({ onBuy }: PassTiersProps) {
  return (
    <section
      id="passes"
      className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
        <div>
          <Reveal>
            <SectionLabel>[ 04 ] THE PASSES</SectionLabel>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-display mt-8 text-4xl leading-[1.05] font-light text-bone sm:text-6xl">
              Two passes.
              <span className="block text-bone/45 italic">
                One of them has a table.
              </span>
            </h2>
          </Reveal>
        </div>

        <Reveal delay={0.18} className="max-w-sm">
          <p className="text-sm leading-relaxed text-bone/55">
            Early Bird is the cheapest this gets — the price goes up when it
            sells out, not when we feel like it. Flip a card to see exactly
            what&apos;s included before you pay anything.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 font-mono text-[9px] tracking-[0.22em] text-bone/40 uppercase">
            <span className="flex items-center gap-2">
              <Mail className="size-3.5 text-electric-300" /> EMAIL VERIFIED
            </span>
            <span className="flex items-center gap-2">
              <Zap className="size-3.5 text-electric-300" /> INSTANT HOLD
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-electric-300" /> NO CARD YET
            </span>
          </div>
        </Reveal>
      </div>

      <div className="mt-16 grid gap-8 sm:mt-20 md:grid-cols-2 lg:gap-10">
        {PASSES.map((pass, i) => (
          <PassCard key={pass.id} pass={pass} index={i} onBuy={onBuy} />
        ))}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-12 text-center text-xs leading-relaxed text-bone/35">
          Passes are held against your email, not your card — we send the payment
          link after you confirm. Questions?{" "}
          <a
            href={`mailto:${EVENT.email}`}
            className="text-bone/60 underline decoration-white/20 underline-offset-4 transition-colors hover:text-electric-200"
          >
            {EVENT.email}
          </a>
        </p>
      </Reveal>
    </section>
  );
}
