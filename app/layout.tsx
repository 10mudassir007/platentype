import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { DEFAULT_THEME_BG, THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

const BASE_URL = process.env.PLATEN_BASE_URL ?? "https://platentype.vercel.app/";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const PAGE_DESCRIPTION =
  "A modern typing arena inspired by monkey type. Time, words, quote, zen and custom drills with punctuation and number options. Every finished word throws a different strike.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Platen — typing arena",
  description: PAGE_DESCRIPTION,
  applicationName: "Platen",
  authors: [{ name: "Platen", url: BASE_URL }],
  robots: { index: true, follow: true },
  openGraph: {
    title: "Platen — typing arena",
    description: PAGE_DESCRIPTION,
    url: "/",
    siteName: "Platen",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "Platen typing arena logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Platen — typing arena",
    description: PAGE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: DEFAULT_THEME_BG,
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${mono.variable} ${sans.variable}`}
      data-theme="dark"
      data-scheme="slate"
      suppressHydrationWarning
    >
      <body>
        <script
          // Applies the saved theme before first paint (no colour flash).
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        {children}
      </body>
    </html>
  );
}
