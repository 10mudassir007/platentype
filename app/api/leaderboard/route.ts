import { NextResponse, type NextRequest } from "next/server";

import {
  cleanName,
  createGuest,
  createSession,
  getUserBySession,
  listLeaderboard,
  publicUser,
  submitScore,
} from "../../../server/store.mjs";
import {
  readSessionToken,
  sessionCookie,
} from "@/lib/server/session";

const DIFFICULTIES = ["easy", "medium", "hard"];
const MODES = ["time", "words", "quote", "zen", "custom"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const difficulty = DIFFICULTIES.includes(params.get("difficulty") ?? "")
    ? params.get("difficulty")!
    : "all";
  const mode = MODES.includes(params.get("mode") ?? "")
    ? params.get("mode")!
    : "all";
  const limit = Math.max(1, Math.min(100, Number(params.get("limit") ?? 25) || 25));

  const token = await readSessionToken();
  const user = await getUserBySession(token);
  const rows = await listLeaderboard({ difficulty, mode, limit });
  const you = user
    ? rows.find((entry: { userId: string }) => entry.userId === user.id) ?? null
    : null;

  return NextResponse.json({
    entries: rows,
    you,
    filters: { difficulty, mode },
    user: publicUser(user),
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const difficulty = DIFFICULTIES.includes(String(body.difficulty))
    ? String(body.difficulty)
    : "easy";
  const mode = MODES.includes(String(body.mode)) ? String(body.mode) : "time";

  const token = await readSessionToken();
  let user = await getUserBySession(token);
  let nextToken: string | null = null;

  if (!user) {
    user = await createGuest(cleanName(body.name, "fighter"));
    nextToken = await createSession(user.id);
  }

  const result = await submitScore(user, {
    ...body,
    difficulty,
    mode,
  });

  const response = NextResponse.json({
    ...result,
    user: publicUser(user),
  });
  if (nextToken) {
    response.cookies.set({ ...sessionCookie, value: nextToken });
  }
  return response;
}
