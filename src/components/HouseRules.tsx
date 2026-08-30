"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Ban, IdCard, Martini, Wallet } from "lucide-react";

import { EVENT } from "@/lib/event";
import { Reveal, SectionLabel } from "./ui/Reveal";

const RULES = [
  {
    icon: Martini,
    title: "No alcohol. At all.",
    short: "Not a sip, not a sneaky one, not \u201cjust for the photo\u201d.",
    long: "The bar pours mocktails and only mocktails. If you turn up already smelling like a bar, you're not coming in — and yes, we can tell from three feet away.",
    tone: "signal" as const,
  },
  {
    icon: Ban,
    title: "We check bags. Properly.",
    short: "Bring a flask and it becomes our flask.",
    long: "Anything found gets confiscated and you go home, in front of everyone, at 2 in the afternoon. Sober people dance better anyway. Don't make it weird.",
    tone: "signal" as const,
  },
  {
    icon: IdCard,
    title: "Bring an ID anyway.",
    short: "Any ID. School, college, Aadhaar, library card energy.",
    long: "It's not an age gate — nobody's drinking. We just need the name on your pass to match a human at the door so nobody resells their way in.",
    tone: "calm" as const,
  },
  {
    icon: Wallet,
    title: "Money stuff, honestly.",
    short: "Passes aren't refundable. They are transferable.",
    long: "Can't make it? Email us and we'll move your pass to a friend, up to 48 hours before doors. After that the name is locked and we can't help.",
    tone: "calm" as const,
  },
];

export function HouseRules() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="rules"
      className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <Reveal>
            <SectionLabel>[ 05 ] HOUSE RULES</SectionLabel>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-display mt-8 text-4xl leading-[1.05] font-light text-bone sm:text-5xl">
              Four rules.
              <span className="block text-bone/45 italic">
                Two of them are the same rule.
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-bone/55">
              {EVENT.policyShort} Everything else is negotiable — the outfit, the
              dancing, whether you know the words. Tap a rule to read the fine
              print.
            </p>
          </Reveal>
        </div>

        <ul className="space-y-3">
          {RULES.map((rule, i) => {
            const isOpen = open === i;
            const Icon = rule.icon;
            const accent = rule.tone === "signal" ? "#ff3b3b" : "#7d8bff";

            return (
              <motion.li
                key={rule.title}
                initial={{ opacity: 0, y: reduced ? 0 : 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="glass group w-full overflow-hidden rounded-2xl px-5 py-5 text-left transition-colors duration-300 sm:px-6"
                  style={{ borderColor: isOpen ? `${accent}66` : undefined }}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border transition-all duration-500"
                      style={{
                        borderColor: `${accent}44`,
                        color: accent,
                        background: isOpen ? `${accent}14` : "transparent",
                        boxShadow: isOpen ? `0 0 22px -8px ${accent}` : "none",
                      }}
                    >
                      <Icon className="size-4" strokeWidth={1.8} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xl leading-tight text-bone sm:text-2xl">
                        {rule.title}
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-bone/45 sm:text-[13px]">
                        {rule.short}
                      </p>

                      <motion.div
                        initial={false}
                        animate={{
                          height: isOpen ? "auto" : 0,
                          opacity: isOpen ? 1 : 0,
                        }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="pt-3.5 text-[13px] leading-relaxed text-bone/70">
                          {rule.long}
                        </p>
                      </motion.div>
                    </div>

                    <span
                      className="mt-1 font-mono text-[10px] text-bone/30 transition-transform duration-300"
                      style={{ transform: isOpen ? "rotate(45deg)" : "none" }}
                    >
                      +
                    </span>
                  </div>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
