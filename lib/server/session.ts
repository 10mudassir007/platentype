import { cookies } from "next/headers";

import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  SESSION_DAYS,
} from "../../server/store.mjs";

export { OAUTH_COOKIE, SESSION_COOKIE };

export const sessionCookie = {
  name: SESSION_COOKIE,
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
  secure: process.env.NODE_ENV === "production",
};

export const oauthCookie = {
  name: OAUTH_COOKIE,
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
  secure: process.env.NODE_ENV === "production",
};

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function readOauthState(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(OAUTH_COOKIE)?.value ?? null;
}
