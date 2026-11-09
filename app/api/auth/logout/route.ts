import { NextResponse } from "next/server";

import { deleteSession } from "../../../../server/store.mjs";
import { readSessionToken, sessionCookie } from "@/lib/server/session";

export async function POST() {
  const token = await readSessionToken();
  await deleteSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...sessionCookie, value: "", maxAge: 0 });
  return response;
}
