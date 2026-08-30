"use client";

import { Asterisk } from "lucide-react";

type MarqueeProps = {
  items: string[];
  reverse?: boolean;
  className?: string;
};

export function Marquee({ items, reverse, className }: MarqueeProps) {
  const track = [...items, ...items];

  return (
    <div
      className={`relative flex overflow-hidden border-y border-white/8 bg-white/2 py-4 backdrop-blur-sm ${className ?? ""}`}
      style={{
        maskImage:
          "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <div
        className={`flex w-max shrink-0 items-center ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        }`}
      >
        {track.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="font-display flex items-center gap-9 pr-9 text-lg font-light tracking-[0.08em] text-bone/40 uppercase sm:text-2xl"
          >
            {item}
            <Asterisk className="size-3.5 text-electric-400/60" />
          </span>
        ))}
      </div>
    </div>
  );
}
