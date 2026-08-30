"use client";

import { ShieldCheck, Zap } from "lucide-react";

import { PASSES, type PassTier } from "@/lib/passes";
import { PassCard } from "./PassCard";
import { Reveal, SectionLabel, SplitText } from "./ui/Reveal";

type PassTiersProps = {
  onBuy: (pass: PassTier) => void;
};

export function PassTiers({ onBuy }: PassTiersProps) {
  return (
    <section
      id="passes"
      className="relative mx-auto w-full max-w-7xl px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
        <div>
          <Reveal>
            <SectionLabel>THE PASSES / 002</SectionLabel>
          </Reveal>
          <h2 className="font-display mt-7 text-5xl leading-[0.88] tracking-[0.01em] text-bone uppercase sm:text-7xl lg:text-8xl">
            <SplitText text="PICK YOUR" lineClassName="pb-[0.08em]" />
            <span className="block text-stroke">
              <SplitText text="ESCAPE" delay={0.1} lineClassName="pb-[0.08em]" />
            </span>
          </h2>
        </div>

        <Reveal delay={0.2} className="max-w-sm">
          <p className="text-sm leading-relaxed text-bone/55">
            Three ways in. Every pass is capped, every tier closes early. Flip a
            card to read what it buys you, then take it to checkout.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4 font-mono text-[9px] tracking-[0.24em] text-bone/40 uppercase">
            <span className="flex items-center gap-2">
              <Zap className="size-3.5 text-cyan-glow" /> INSTANT E-PASS
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-cyan-glow" /> SECURE CHECKOUT
            </span>
          </div>
        </Reveal>
      </div>

      <div className="mt-16 grid gap-8 sm:mt-20 md:grid-cols-2 lg:grid-cols-3 lg:gap-7">
        {PASSES.map((pass, i) => (
          <PassCard key={pass.id} pass={pass} index={i} onBuy={onBuy} />
        ))}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-12 text-center font-mono text-[9px] tracking-[0.28em] text-bone/30 uppercase">
          ALL SALES FINAL · PASSES ARE TRANSFERABLE UNTIL SEP 25 · NO ENTRY WITHOUT VALID ID
        </p>
      </Reveal>
    </section>
  );
}
