"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { BackgroundFX } from "@/components/BackgroundFX";
import { PhraseUnlock } from "@/components/PhraseUnlock";
import { EVENT } from "@/lib/event";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Unlisted staff gate. Guests never land here from the header LOGIN button. */
export function CmsUnlock() {
  const router = useRouter();

  return (
    <>
      <BackgroundFX />
      <main className="relative flex min-h-[100svh] flex-1 items-center justify-center px-5 py-16 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="glass-strong relative w-full max-w-lg overflow-hidden rounded-3xl p-7 sm:p-9"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric-300 to-transparent"
          />
          <PhraseUnlock
            eyebrow={`${EVENT.host} · CMS`}
            title="Twelve words"
            hint="Staff only. Twelve words."
            submitLabel="UNLOCK CMS"
            endpoint="/api/admin/login"
            onUnlocked={() => router.refresh()}
          />
        </motion.div>
      </main>
    </>
  );
}
