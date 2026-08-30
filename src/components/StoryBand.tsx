"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { EVENT } from "@/lib/event";
import { Reveal, SectionLabel } from "./ui/Reveal";

/**
 * The teaser's own title card, full bleed. It already says everything, so
 * nothing is layered on top of it — it just breathes between sections.
 */
export function TeaserBand() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [1.14, 1]);
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <div
      ref={ref}
      className="relative h-[46vh] min-h-[280px] w-full overflow-hidden border-y border-white/8 sm:h-[62vh]"
    >
      <motion.div
        style={reduced ? undefined : { scale, y }}
        className="absolute inset-0"
      >
        <Image
          src="/media/utopia-red.jpg"
          alt="UTOPIA — the party for the right people"
          fill
          sizes="100vw"
          className="object-cover object-center opacity-90"
        />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#030307] via-transparent to-[#030307]" />
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-soft-light" />
    </div>
  );
}

const NUMBERS = [
  { value: "5", label: "hours of it" },
  { value: "0", label: "drops of alcohol" },
  { value: "∞", label: "food & mocktails" },
];

export function StoryBand() {
  return (
    <section
      id="story"
      className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32"
    >
      <Reveal>
        <SectionLabel>[ 01 ] WHAT THIS IS</SectionLabel>
      </Reveal>

      <Reveal delay={0.1}>
        <h2 className="font-display mt-8 max-w-3xl text-3xl leading-[1.12] font-light text-bone sm:text-5xl lg:text-6xl">
          A day party for everyone who keeps getting told{" "}
          <span className="text-bone/40 italic">&ldquo;not tonight&rdquo;</span>{" "}
          at the door.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        <Reveal delay={0.15}>
          <div className="space-y-5 text-sm leading-relaxed text-bone/60 sm:text-base">
            <p>
              {EVENT.policyLong} The bar pours mocktails, the kitchen doesn&apos;t
              stop, and the only thing getting spiked is the bass.
            </p>
            <p>
              Doors at noon, lights up at five. You get the full club — the rig,
              the lasers, the fog, the DJ who has been waiting all week for this
              — while the sun is still up. You&apos;ll be home for dinner and
              nobody has to explain anything to anybody.
            </p>
            <p className="text-bone/80">
              Bring people you actually like. That&apos;s the whole guest policy.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.25}>
          <dl className="grid grid-cols-3 gap-4 border-t border-white/10 pt-8 lg:grid-cols-1 lg:gap-7 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            {NUMBERS.map((item) => (
              <div key={item.label}>
                <dt className="font-display text-4xl leading-none font-light text-electric-300 sm:text-5xl">
                  {item.value}
                </dt>
                <dd className="mt-2 font-mono text-[9px] tracking-[0.24em] text-bone/40 uppercase">
                  {item.label}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

/** Who is throwing it — anchored by the teaser's AVION title frame. */
export function AvionBand() {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-white/10">
            <Image
              src="/media/avion-title.jpg"
              alt="AVION Productions"
              width={1600}
              height={900}
              sizes="(max-width: 1024px) 92vw, 560px"
              className="h-auto w-full opacity-95"
            />
            <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-soft-light" />
          </div>
        </Reveal>

        <div>
          <Reveal>
            <SectionLabel>[ 02 ] WHO&apos;S THROWING IT</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display mt-7 text-3xl leading-[1.14] font-light text-bone sm:text-4xl">
              AVION Productions
            </h2>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-bone/60 sm:text-base">
              We put on rooms, not events. Sound first, lights second, everything
              else third. UTOPIA is our September chapter — the one we&apos;ve been
              teasing on the grid all month.
            </p>
          </Reveal>
          <Reveal delay={0.26}>
            <p className="mt-5 font-display text-xl leading-snug font-light text-bone/80 italic sm:text-2xl">
              &ldquo;Something different. Something big.&rdquo;
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
