import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeUrl,
  isProvider,
  oauthStatus,
} from "../../../../server/oauth.mjs";
import { oauthCookie } from "@/lib/server/session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!isProvider(provider)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }
  if (!oauthStatus()[provider as keyof typeof oauthStatus]) {
    return NextResponse.redirect(
      new URL(`/?auth=unconfigured&provider=${provider}`, request.url),
    );
  }

  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(authorizeUrl(request, provider, state));
  response.cookies.set({
    ...oauthCookie,
    value: `${provider}:${state}`,
  });
  return response;
}
