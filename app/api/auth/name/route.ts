import { NextResponse, type NextRequest } from "next/server";

import {
  cleanName,
  createGuest,
  createSession,
  getUserBySession,
  publicUser,
  renameUser,
} from "../../../../server/store.mjs";
import {
  readSessionToken,
  sessionCookie,
} from "@/lib/server/session";

export async function POST(request: NextRequest) {
  let body: { name?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const name = cleanName(body.name, "");
  if (name.length < 2) {
    return NextResponse.json(
      { error: "a name needs at least two characters" },
      { status: 400 },
    );
  }

  const token = await readSessionToken();
  const existing = await getUserBySession(token);
  let user = existing;
  let nextToken = token;

  if (existing) {
    user = await renameUser(existing.id, name);
  } else {
    user = await createGuest(name);
    nextToken = await createSession(user.id);
  }

  const response = NextResponse.json({ user: publicUser(user) });
  if (nextToken && !existing) {
    response.cookies.set({ ...sessionCookie, value: nextToken });
  }
  return response;
}
