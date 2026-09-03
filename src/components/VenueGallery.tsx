"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";

import { EVENT } from "@/lib/event";

const EASE = [0.16, 1, 0.3, 1] as const;

const PHOTOS = [
  {
    src: "/media/room-last.jpg",
    alt: "Packed dance floor — haze, lasers, the room full",
    label: "The floor",
  },
  {
    src: "/media/haze.jpg",
    alt: "Haze and lights over the room",
    label: "Haze",
  },
  {
    src: "/media/crowd-pink.jpg",
    alt: "Crowd under pink light",
    label: "Pink hour",
  },
  {
    src: "/media/crowd-blue.jpg",
    alt: "Crowd under blue light",
    label: "Blue hour",
  },
  {
    src: "/media/utopia-red.jpg",
    alt: "UTOPIA in red",
    label: "UTOPIA",
  },
] as const;

export function VenueGallery() {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const close = useCallback(() => setActive(null), []);

  const step = useCallback((delta: number) => {
    setActive((current) => {
      if (current === null) return current;
      return (current + delta + PHOTOS.length) % PHOTOS.length;
    });
  }, []);

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close, step]);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <p className="font-mono text-[9px] tracking-[0.28em] text-bone/40 uppercase">
          {PHOTOS.length} photos · tap to open
        </p>
        <a
          href={EVENT.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/4 px-3 py-1.5 font-mono text-[8px] tracking-[0.18em] text-bone/70 uppercase transition-colors hover:border-electric-300/50 hover:text-electric-200"
        >
          <MapPin className="size-3 text-electric-300" />
          Maps
        </a>
      </div>

      <div
        className="flex h-[240px] gap-2 sm:h-[320px] sm:gap-3"
        onMouseLeave={() => setHovered(null)}
      >
        {PHOTOS.map((photo, index) => {
          const expanded = hovered === null ? index === 0 : hovered === index;
          return (
            <motion.button
              key={photo.src}
              type="button"
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onClick={() => setActive(index)}
              animate={{ flex: expanded ? 2.2 : 0.55 }}
              transition={{ duration: reduced ? 0 : 0.55, ease: EASE }}
              className="relative min-w-0 overflow-hidden rounded-[22px] border border-white/10"
              aria-label={`${photo.label}. Open photo`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 768px) 70vw, 420px"
                className="object-cover"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <motion.span
                animate={{ opacity: expanded ? 1 : 0, y: expanded ? 0 : 8 }}
                className="absolute inset-x-0 bottom-0 p-3 text-left font-mono text-[8px] tracking-[0.22em] text-bone/85 uppercase sm:p-4 sm:text-[9px]"
              >
                {photo.label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {active !== null && (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-[#01010a]/88 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close photo"
              className="absolute inset-0"
              onClick={close}
            />
            <motion.div
              key={PHOTOS[active].src}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="relative z-10 aspect-[16/10] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/12"
            >
              <Image
                src={PHOTOS[active].src}
                alt={PHOTOS[active].alt}
                fill
                sizes="90vw"
                className="object-cover"
                priority
              />
            </motion.div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-5 right-5 z-10 flex size-10 items-center justify-center rounded-full border border-white/15 text-bone/80"
            >
              <X className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className="absolute top-1/2 left-4 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 text-bone/80"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className="absolute top-1/2 right-4 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 text-bone/80"
            >
              <ChevronRight className="size-5" />
            </button>
            <p className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 font-mono text-[9px] tracking-[0.22em] text-bone/70 uppercase">
              {PHOTOS[active].label} · {active + 1} / {PHOTOS.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
