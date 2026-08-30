import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, DOOR_SESSION_COOKIE } from "./admin-auth";
import { verifyAdminSession, verifyDoorSession } from "./store";

/** Shared by the admin layout (redirect) and every /api/admin/* route (401). */
export async function getAdminSession(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminSession(token);
}

export async function getDoorSession(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DOOR_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyDoorSession(token);
}
