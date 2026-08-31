import { checkPhrase, phrasesConfigured, type PhraseRole } from "./phrase";

export const ADMIN_SESSION_COOKIE = "utopia_admin_session";
export const DOOR_SESSION_COOKIE = "utopia_door_session";
export const BUYER_SESSION_COOKIE = "utopia_buyer_session";
export const PASS_WALLET_COOKIE = "utopia_pass_wallet";

export function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export function checkUnlockPhrase(role: PhraseRole, phrase: string): boolean {
  return checkPhrase(role, phrase);
}

export function unlockConfigured(role: PhraseRole): boolean {
  return phrasesConfigured(role);
}
