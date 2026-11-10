import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Work_Sans } from "next/font/google";
import { RouteFocus } from "@/components/ui/RouteFocus";
import { SkipLink } from "@/components/ui/SkipLink";
import { ThemeScript } from "@/components/ui/ThemeScript";
import { ThemeSync } from "@/components/ui/ThemeSync";
import { THEME_STORAGE_KEY } from "@/components/ui/theme";
import "./globals.css";

// Open-font fallback for source checkouts. The user-supplied Diatype faces, when present at build time, take
// precedence through the shared CSS tokens. Their binaries are kept outside public Git history.
const sans = Work_Sans({
  variable: "--font-brand-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const display = Inter({
  variable: "--font-brand-display",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const mono = IBM_Plex_Mono({
  variable: "--font-brand-mono",
  weight: ["400", "500"],
  preload: false,
  subsets: ["latin"],
  display: "swap",
});

const description =
  "Turn recall-photo reviews into traceable PayPal refunds. Remedy checks evidence, routes uncertain claims for review, and pays eligible owners through PayPal.";

// Absolute URLs for the link card: APP_URL, else Vercel's production domain, else the local dev server.
const siteUrl = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://127.0.0.1:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Remedy", template: "%s · Remedy" },
  description,
  applicationName: "Remedy",
  // No title or description here: each page's link card takes its own <title> and description (Next fills them in).
  openGraph: { siteName: "Remedy", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark light",
};

// Marketing is always dark. App routes honor an explicit saved preference; a new visitor starts in dark.
const themeScript = `try{document.documentElement.dataset.theme=location.pathname!=="/"&&localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="light"?"light":"dark"}catch(e){}`;
const diatype = process.env.NEXT_PUBLIC_DIATYPE_ENABLED === "1";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-fonts={diatype ? "diatype" : undefined} className={`${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript code={themeScript} />
        {diatype && <>
          <link rel="preload" href="/fonts/diatype/regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
          <link rel="preload" href="/fonts/diatype/bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        </>}
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
