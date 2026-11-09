import { NextResponse } from "next/server";

import { publicUser, getUserBySession } from "../../../../server/store.mjs";
import { oauthStatus } from "../../../../server/oauth.mjs";
import { readSessionToken } from "@/lib/server/session";

export async function GET() {
  const token = await readSessionToken();
  const user = await getUserBySession(token);
  return NextResponse.json({
    user: publicUser(user),
    providers: oauthStatus(),
  });
}
