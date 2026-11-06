import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
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

const description =
  "Recall refunds in a minute for people who really destroyed the product, and never for a faked photo. Paid through PayPal.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://127.0.0.1:3000"),
  title: { default: "Remedy", template: "%s · Remedy" },
  description,
  applicationName: "Remedy",
  openGraph: { title: "Remedy", description, siteName: "Remedy", type: "website" },
  twitter: { card: "summary", title: "Remedy", description },
};

export const viewport: Viewport = {
  themeColor: "#15181d",
  colorScheme: "dark light",
};

// Runs before paint so a saved light theme never flashes dark. Dark is the default; only "light" is stored.
const themeScript = `try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
