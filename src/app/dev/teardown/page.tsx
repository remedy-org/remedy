import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { DevExhibit } from "./DevExhibit";
import styles from "./lamplight.module.css";

// /dev/teardown: the Opened Exhibit on its own, for screenshots and review (dev only: a 404 in production, like
// /dev/ui). ?capture=1 shows one fixed frame that window.__exhibit.at(p) poses (scripts/teardown-capture.ts); without
// it, the exhibit pins and scrolls as it will on the homepage. The wrapper previews wave 3's Lamplight palette and type.

export const metadata = { title: "Opened Exhibit", robots: { index: false } };

const sans = Schibsted_Grotesk({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});
const mono = JetBrains_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  display: "swap",
});

export default async function DevTeardownPage({ searchParams }: PageProps<"/dev/teardown">) {
  if (process.env.NODE_ENV === "production") notFound();
  const capture = (await searchParams).capture === "1";
  return (
    <div className={`${styles.lamplight} ${sans.variable} ${mono.variable} font-sans`}>
      <DevExhibit capture={capture} fillerClass={styles.filler} />
    </div>
  );
}
