import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { RouteFocus } from "@/components/ui/RouteFocus";
import { SkipLink } from "@/components/ui/SkipLink";
import { ThemeSync } from "@/components/ui/ThemeSync";
import { THEME_STORAGE_KEY } from "@/components/ui/theme";
import "./globals.css";

// One voice (DESIGN.md): Schibsted Grotesk for display, headings, body and UI. One variable file (this Next version's
// Google loader takes "variable" or single weights, not a range); only 400 to 600 are used. It carries the h1 (the
// LCP element) and the body, so it is the one file preloaded.
const sans = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  display: "swap",
});

// Evidence: codes, ids, grid amounts, timestamps, micro labels, stamps. One variable file; only 400 and 500 are used.
// Swaps in.
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const description =
  "Remedy turns any CPSC recall into a live refund program. Owners prove the product destroyed on a live camera, five checks stop the fakes, and PayPal pays the refund within a minute.";

// Absolute URLs for the link card: APP_URL, else Vercel's production domain, else the local dev server.
const siteUrl = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://127.0.0.1:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Remedy", template: "%s · Remedy" },
  description,
  applicationName: "Remedy",
  openGraph: { title: "Remedy", description, siteName: "Remedy", type: "website" },
  twitter: { card: "summary_large_image", title: "Remedy", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f6f2" },
    { color: "#0d0c0a" },
  ],
  colorScheme: "dark light",
};

// Runs before paint, so the page never flashes the wrong theme. A saved choice wins; with none, a visitor whose system
// asks for light gets light; everyone else gets dark, the default.
const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||(t!=="dark"&&matchMedia("(prefers-color-scheme: light)").matches))document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-text antialiased">
        {/* The first Tab stop on every page, after a client-side page change too (RouteFocus). Each frame's main content
            carries id="main" (homepage, sign-in, FlowShell, the console layout). */}
        <ThemeSync />
        <RouteFocus />
        <SkipLink href="#main">Skip to content</SkipLink>
        {children}
      </body>
    </html>
  );
}
