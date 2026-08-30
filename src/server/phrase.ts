import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { BIP39_ENGLISH } from "./bip39-english";

/**
 * 12-word unlock phrases for the CMS and the door scanner. Same shape as a
 * crypto wallet seed — 12 BIP39 English words — but they are *not* keys and
 * they do not control money. We hash them with AUTH_SECRET and only ever
 * compare hashes.
 */

export type PhraseRole = "cms" | "door";

const WORD_SET = new Set<string>(BIP39_ENGLISH);
const DEV_FILE = join(process.cwd(), ".data", "dev-phrases.json");

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

export function generatePhrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    // 2048 is 2^11, so 2 bytes is plenty of uniform index space.
    const index = randomBytes(2).readUInt16BE(0) % BIP39_ENGLISH.length;
    words.push(BIP39_ENGLISH[index]);
  }
  return words.join(" ");
}

function secret(): string {
  return process.env.AUTH_SECRET ?? "utopia-dev-secret-change-me";
}

export function hashPhrase(phrase: string): string {
  return createHmac("sha256", secret()).update(`phrase:${normalizePhrase(phrase)}`).digest("hex");
}

function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && bufA.length > 0 && timingSafeEqual(bufA, bufB);
}

type DevPhrases = { cms?: string; door?: string };

function loadDevPhrases(): DevPhrases {
  try {
    if (existsSync(DEV_FILE)) {
      return JSON.parse(readFileSync(DEV_FILE, "utf8")) as DevPhrases;
    }
  } catch {
    // Ignore corrupt file; we'll regenerate.
  }
  return {};
}

function saveDevPhrases(phrases: DevPhrases): void {
  try {
    mkdirSync(dirname(DEV_FILE), { recursive: true });
    writeFileSync(DEV_FILE, JSON.stringify(phrases, null, 2), "utf8");
  } catch (error) {
    console.warn("[utopia] Could not persist generated phrases to .data/", error);
  }
}

type HashSet = { cmsHash: string; doorHash: string };

let cache: HashSet | null = null;
let announced = false;

/**
 * Resolve the stored hashes. Production only accepts env vars (plaintext
 * phrase or precomputed hash). Development will mint a pair of phrases, write
 * them to gitignored `.data/dev-phrases.json`, and print them to the console.
 */
export function getPhraseHashes(): HashSet {
  if (cache) return cache;

  let cmsHash =
    process.env.CMS_PHRASE_HASH?.trim() ||
    (process.env.CMS_PHRASE ? hashPhrase(process.env.CMS_PHRASE) : "");
  let doorHash =
    process.env.DOOR_PHRASE_HASH?.trim() ||
    (process.env.DOOR_PHRASE ? hashPhrase(process.env.DOOR_PHRASE) : "");

  if (process.env.NODE_ENV === "production") {
    cache = { cmsHash, doorHash };
    if (!announced && (!cmsHash || !doorHash)) {
      announced = true;
      console.error(
        "[utopia] Set CMS_PHRASE and DOOR_PHRASE (or *_PHRASE_HASH) in the environment. CMS and door login stay locked until you do.",
      );
    }
    return cache;
  }

  const stored = loadDevPhrases();
  let dirty = false;

  if (!cmsHash) {
    if (!stored.cms || parsePhraseWords(stored.cms) === null) {
      stored.cms = generatePhrase();
      dirty = true;
    }
    cmsHash = hashPhrase(stored.cms);
  }
  if (!doorHash) {
    if (!stored.door || parsePhraseWords(stored.door) === null) {
      stored.door = generatePhrase();
      dirty = true;
    }
    doorHash = hashPhrase(stored.door);
  }

  if (dirty) saveDevPhrases(stored);

  if (!announced) {
    announced = true;
    if (stored.cms && !process.env.CMS_PHRASE && !process.env.CMS_PHRASE_HASH) {
      console.info(`\n[utopia] CMS 12-word phrase (dev only, not in git):\n  ${stored.cms}\n`);
    }
    if (stored.door && !process.env.DOOR_PHRASE && !process.env.DOOR_PHRASE_HASH) {
      console.info(`\n[utopia] DOOR 12-word phrase (dev only, not in git):\n  ${stored.door}\n`);
    }
  }

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
