"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { PhraseUnlock } from "@/components/PhraseUnlock";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Looks like a 404 to guests. Staff still type the twelve words. */
export function CmsUnlock() {
  const router = useRouter();

  return (
    <main className="relative flex min-h-[100svh] flex-1 items-center justify-center bg-void px-5 py-16">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="w-full max-w-lg"
      >
        <PhraseUnlock
          stealth
          eyebrow=""
          title="404"
          hint=""
          submitLabel="CONTINUE"
          endpoint="/api/admin/login"
          onUnlocked={() => router.refresh()}
        />
      </motion.div>
    </main>
  );
}
