import { createHmac, timingSafeEqual } from "node:crypto";

import { BIP39_ENGLISH } from "./bip39-english";

/**
 * 12-word unlock phrases for the CMS and the door scanner. Same shape as a
 * crypto wallet seed — 12 BIP39 English words — but they are *not* keys and
 * they do not control money. We store hashes only.
 *
 * Env overrides (CMS_PHRASE / DOOR_PHRASE or *_HASH) win. If those are empty,
 * we fall back to the first-deploy hashes below so /admin and /door work on
 * Vercel without a dashboard trip. Rotate by setting the env vars.
 */

export type PhraseRole = "cms" | "door";

const WORD_SET = new Set<string>(BIP39_ENGLISH);

/** HMAC key for phrase hashes — independent of AUTH_SECRET so a later secret rotation does not lock staff out. */
const PHRASE_PEPPER = "utopia-phrase-unlock-v1";

/**
 * First-deploy hashes (plaintext is not in git). Override with CMS_PHRASE /
 * DOOR_PHRASE when you rotate.
 */
const BUILTIN_HASHES = {
  cmsHash: "4d531d7e3fb30416c834395b770cb93abdd298a400b26d0dce8a887d51f52508",
  doorHash: "d7e58951544db15011fbd62ef895a19329d2074f1d1887bc8b1bf00875ddeb54",
} as const;

export function normalizePhrase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .join(" ");
}

export function parsePhraseWords(input: string): string[] | null {
  const words = normalizePhrase(input).split(" ").filter(Boolean);
  if (words.length !== 12) return null;
  if (!words.every((word) => WORD_SET.has(word))) return null;
  return words;
}

export function hashPhrase(phrase: string): string {
  return createHmac("sha256", PHRASE_PEPPER).update(`phrase:${normalizePhrase(phrase)}`).digest("hex");
}

function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && bufA.length > 0 && timingSafeEqual(bufA, bufB);
}

type HashSet = { cmsHash: string; doorHash: string };

let cache: HashSet | null = null;

export function getPhraseHashes(): HashSet {
  if (cache) return cache;

  const cmsHash =
    process.env.CMS_PHRASE_HASH?.trim() ||
    (process.env.CMS_PHRASE ? hashPhrase(process.env.CMS_PHRASE) : "") ||
    (process.env.NODE_ENV === "production" ? "" : BUILTIN_HASHES.cmsHash);
  const doorHash =
    process.env.DOOR_PHRASE_HASH?.trim() ||
    (process.env.DOOR_PHRASE ? hashPhrase(process.env.DOOR_PHRASE) : "") ||
    (process.env.NODE_ENV === "production" ? "" : BUILTIN_HASHES.doorHash);

  cache = { cmsHash, doorHash };
  return cache;
}

export function phrasesConfigured(role: PhraseRole): boolean {
  const hashes = getPhraseHashes();
  return role === "cms" ? Boolean(hashes.cmsHash) : Boolean(hashes.doorHash);
}

export function checkPhrase(role: PhraseRole, phrase: string): boolean {
  const words = parsePhraseWords(phrase);
  if (!words) return false;
  const hashes = getPhraseHashes();
  const expected = role === "cms" ? hashes.cmsHash : hashes.doorHash;
  if (!expected) return false;
  return hashesEqual(hashPhrase(words.join(" ")), expected);
}
