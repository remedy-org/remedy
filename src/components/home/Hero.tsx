import clsx from "clsx";
import type { CSSProperties } from "react";
import { previewProps } from "@/components/console/preview";
import { Button } from "@/components/ui";
import { CLAIM } from "./custody/claim";
import { HeroRunway } from "./custody/HeroRunway";
import styles from "./custody/custody.module.css";

const line = (n: number) => ({ "--line": n }) as CSSProperties;

/** The introduction and the device share a centered axis; the first scroll moves into the laptop glass.
 * Server-rendered copy remains the first paint, with the illustrative sandbox scope beside the actions. */
export function Hero() {
  const copy = (
    <>
      <h1 id="hero-title" className={clsx(styles.headline, styles.focusIn)} style={line(0)}>
        Recall refunds.
        <span className={styles.headlineAccent}>From proof to PayPal.</span>
      </h1>
      <p className={clsx(styles.lead, styles.focusIn)} style={line(1)}>
        Proof of destruction, five checks, and a refund through PayPal.
      </p>
      <div className={clsx(styles.actions, styles.focusIn)} style={line(2)}>
        {/* The owner's path is the screen's primary action; companies get a quieter link to their section, the nav's
            "For companies" (its sign-in is in the bar). */}
        {/* Full width inside the gutters on phones; at 320px it fits on one line with tighter padding, or wraps. */}
        <Button
          href="/r/kikea-x-vesolje/try"
          size="lg"
          data-try-cta=""
          className="max-sm:h-auto max-sm:min-h-12 max-sm:w-full max-sm:px-3 max-sm:py-2.5 max-sm:text-center max-sm:text-balance max-sm:whitespace-normal"
        >
          Try a claim
        </Button>
        <Button href="#companies" variant="tertiary" size="lg">
          Explore the company console
        </Button>
      </div>
      <p className={clsx(styles.sample, styles.focusIn)} style={line(3)}>
        Illustrative claim · PayPal sandbox · <span className="font-mono">{CLAIM.id}</span>
      </p>
    </>
  );
  // Chapter 06's queue: the recall's claims exactly as /console draws them (its words, its cells), newest first.
  const consoleRows = previewProps(560, { asConsole: true }).rows;
  return <HeroRunway copy={copy} consoleRows={consoleRows} />;
}
