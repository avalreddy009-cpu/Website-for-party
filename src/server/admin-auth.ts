import { checkPhrase, phrasesConfigured, type PhraseRole } from "./phrase";

export const ADMIN_SESSION_COOKIE = "utopia_admin_session";
export const DOOR_SESSION_COOKIE = "utopia_door_session";

export function checkUnlockPhrase(role: PhraseRole, phrase: string): boolean {
  return checkPhrase(role, phrase);
}

export function unlockConfigured(role: PhraseRole): boolean {
  return phrasesConfigured(role);
}
