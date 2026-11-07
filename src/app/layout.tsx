import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";
import { THEME_STORAGE_KEY } from "@/components/ui/theme";
import "./globals.css";

const sans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Monumental numbers and the hero's second line, homepage only (DESIGN.md). Not preloaded: a browser fetches the file
// only for a page that sets text in it, so the claim flow and the console never download it.
const serif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
  preload: false,
});

const description =
  "Recall refunds in a minute for people who really destroyed the product, and never for a faked photo. Paid through PayPal.";

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
  themeColor: "#15181d",
  colorScheme: "dark light",
};

// Runs before paint so a saved light theme never flashes dark. Dark is the default; only "light" is stored.
const themeScript = `try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
