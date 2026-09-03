"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import { TERMS_SECTIONS } from "@/lib/terms";

const EASE = [0.16, 1, 0.3, 1] as const;

type TermsModalProps = {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
};

export function TermsModal({ open, onClose, onAccept }: TermsModalProps) {
  return (
    <AnimatePresence>
      {open && <TermsDialog onClose={onClose} onAccept={onAccept} />}
    </AnimatePresence>
  );
}

function TermsDialog({
  onClose,
  onAccept,
}: {
  onClose: () => void;
  onAccept: () => void;
}) {
  const reduced = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  useEffect(() => {
    const node = endRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setReachedEnd(true);
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <motion.button
        type="button"
        aria-label="Close terms"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#01010a]/80 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        initial={{ y: reduced ? 0 : 48, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: reduced ? 0 : 28, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="relative flex max-h-[90svh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0a0610] shadow-[0_0_80px_-24px_rgba(255,59,59,0.55)] sm:rounded-3xl"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/80 to-transparent"
        />

        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <h2
            id="terms-title"
            className="font-display text-2xl font-light text-bone sm:text-3xl"
          >
            Terms and Conditions
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/12 text-bone/55 transition-all duration-300 hover:rotate-90 hover:border-bone/40 hover:text-bone"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="terms-scroll min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
          {TERMS_SECTIONS.map((section, index) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: reduced ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.04, ease: EASE }}
            >
              <h3 className="text-[15px] font-semibold text-bone">
                {index + 1}. {section.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-bone/75">
                {section.body}
              </p>
            </motion.section>
          ))}
          <div ref={endRef} className="h-2" />
        </div>

        <div className="border-t border-white/8 bg-black/30 px-6 py-4">
          {!reachedEnd && (
            <p className="mb-3 text-center font-mono text-[8px] tracking-[0.22em] text-bone/40 uppercase">
              Scroll to the end to accept
            </p>
          )}
          <motion.button
            type="button"
            disabled={!reachedEnd}
            onClick={onAccept}
            whileTap={reachedEnd ? { scale: 0.98 } : undefined}
            className="w-full rounded-2xl bg-signal py-3.5 font-mono text-[12px] font-bold tracking-[0.18em] text-void uppercase transition-opacity disabled:opacity-35"
          >
            I Accept
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
