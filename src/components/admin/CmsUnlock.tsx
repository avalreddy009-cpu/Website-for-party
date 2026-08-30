"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

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
            hint="Staff only. This is not guest login — buyers use the LOGIN button on the site with their email."
            submitLabel="UNLOCK CMS"
            endpoint="/api/admin/login"
            onUnlocked={() => router.refresh()}
          />
          <div className="relative mt-7 flex items-start gap-2.5 border-t border-white/8 pt-5">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-bone/30" />
            <p className="text-[11px] leading-relaxed text-bone/35">
              Unlisted URL. The phrase is hashed on the server. Door staff use /door, not this page.
            </p>
          </div>
        </motion.div>
      </main>
    </>
  );
}
