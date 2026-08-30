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
            className="font-display flex items-center gap-9 pr-9 text-lg tracking-[0.14em] text-bone/35 uppercase sm:text-2xl"
          >
            {item}
            <Asterisk className="size-4 text-electric-400/70" />
          </span>
        ))}
      </div>
    </div>
  );
}
