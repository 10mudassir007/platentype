import { connection } from "next/server";

import TypeFight from "@/components/TypeFight";
import { makeSeed } from "@/lib/text";

const BASE_URL = process.env.PLATEN_BASE_URL ?? "http://localhost:3000";

const PAGE_DESCRIPTION =
  "A typing game with time, words, quote, zen and custom drills, with punctuation and number options. Every finished word throws a different strike.";

export default async function Home() {
  // A fresh seed is chosen on the server for every request, so the first drill
  // is random without a client/server hydration mismatch.
  await connection();
  return (
    <>
      {/* Visually-hidden heading for search engines and screen readers — no UI change. */}
      <h1 className="screen-reader-only">Platen typing arena</h1>
      <link rel="canonical" href={`${BASE_URL}/`} key="canonical" />
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
      <TypeFight initialSeed={makeSeed()} />
    </>
  );
}
