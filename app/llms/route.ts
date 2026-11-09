import { NextResponse } from "next/server";

const BASE_URL = "https://platentype.vercel.app/";

export async function GET() {
  const llmsTxt = `# Platen — typing arena

A free browser-based typing game. Play time, words, quote, zen and custom drills with optional punctuation and numbers. Every finished word throws a different strike.

## Site

- Homepage: ${BASE_URL}
- Sitemap: ${BASE_URL}sitemap.xml
- Robots: ${BASE_URL}robots.txt

## How to play

1. Open ${BASE_URL} in a modern browser.
2. Choose a mode: time, words, quote, zen, or custom.
3. Set length (15s, 30s, 60s, 90s) and difficulty (easy, medium, hard).
4. Toggle punctuation and numbers as desired.
5. Start typing the words that appear. Every finished word throws a strike.
6. When the timer ends, review your score, WPM, accuracy, and burst.

## Controls

- Tab: restart test
- Esc: open command line
- Ctrl+Shift+P: command line
- Enter: replay / finish zen

## Tech

Built with Next.js 16, React 19, and TypeScript. Server-side rendered for fast first paint and full crawlability by search engines and AI crawlers.

`;

  return new NextResponse(llmsTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
