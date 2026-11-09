import { NextResponse, type NextRequest } from "next/server";

import {
  exchangeCode,
  fetchProfile,
  isProvider,
} from "../../../../../server/oauth.mjs";
import { createSession, upsertOAuthUser } from "../../../../../server/store.mjs";
import {
  oauthCookie,
  readOauthState,
  sessionCookie,
} from "@/lib/server/session";

function back(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await context.params;
    if (!isProvider(provider)) {
      return back(request, { auth: "error" });
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const expected = await readOauthState();
    if (!code || !state || expected !== `${provider}:${state}`) {
      return back(request, { auth: "state" });
    }

    let token: string | null = null;
    try {
      token = await exchangeCode(request, provider, code);
    } catch {
      token = null;
    }
    if (!token) return back(request, { auth: "token" });

    let profile = null;
    try {
      profile = await fetchProfile(provider, token);
    } catch {
      profile = null;
    }
    if (!profile) return back(request, { auth: "profile" });

    const user = await upsertOAuthUser(provider, profile);
    const session = await createSession(user.id);

    const response = back(request, { auth: "ok" });
    response.cookies.set({ ...sessionCookie, value: session });
    response.cookies.set({ ...oauthCookie, value: "", maxAge: 0 });
    return response;
  } catch {
    return back(request, { auth: "error" });
  }
}
