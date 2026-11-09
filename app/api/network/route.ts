import os from "node:os";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const urls: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }
  const configured = process.env.PLATEN_BASE_URL ?? process.env.APP_URL ?? null;
  return NextResponse.json({
    port,
    urls,
    configured,
    online: Boolean(configured),
  });
}
