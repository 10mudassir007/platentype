import { connection } from "next/server";

import TypeFight from "@/components/TypeFight";
import { makeSeed } from "@/lib/text";

const BASE_URL = process.env.PLATEN_BASE_URL ?? "https://platentype.vercel.app/";

const PAGE_DESCRIPTION =
  "A modern typing arena inspired by monkey type. Time, words, quote, zen and custom drills with punctuation and number options. Every finished word throws a different strike.";

export default async function Home() {
  // A fresh seed is chosen on the server for every request, so the first drill
  // is random without a client/server hydration mismatch.
  await connection();
  return (
    <>
      {/* Skip-to-content link for keyboard users — visually hidden, no UI change. */}
      <a href="#game" className="screen-reader-only" rel="nofollow">
        Skip to content
      </a>
      {/* Visually-hidden heading for search engines and screen readers — no UI change. */}
      <h1 className="screen-reader-only">Platen — typing arena</h1>
      <section
        id="game"
        aria-label="Typing game"
        className="screen-reader-only"
        tabIndex={-1}
      >
        <h2 className="screen-reader-only">Game controls and settings</h2>
        <h2 className="screen-reader-only">Run statistics</h2>
        <h2 className="screen-reader-only">Typing arena</h2>
      </section>
      <link rel="canonical" href={BASE_URL} key="canonical" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Platen",
            alternateName: "Platen — typing arena",
            applicationCategory: "Game",
            operatingSystem: "Browser",
            description: PAGE_DESCRIPTION,
            url: BASE_URL,
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
          }),
        }}
      />
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--muted, #7d869a)",
          margin: "0.5rem 0 1rem 0",
          textAlign: "center",
        }}
      >
        A modern typing arena — a lightweight, browser-first replica inspired
        by monkey type.
      </p>
      <TypeFight initialSeed={makeSeed()} />
    </>
  );
}
