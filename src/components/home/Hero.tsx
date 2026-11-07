import clsx from "clsx";
import { Instrument_Serif } from "next/font/google";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import { SANDBOX_ACCOUNTS_URL } from "./custody/claim";
import { HeroRunway } from "./custody/HeroRunway";
import styles from "./custody/custody.module.css";

// The hero's second line is the one serif text above the fold, so the homepage preloads it (the root layout's instance
// isn't preloaded, so other routes never fetch it). Same file, so a page never downloads it twice.
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", display: "swap", preload: true });

const line = (n: number) => ({ "--line": n }) as CSSProperties;

/**
 * The hero at rest and the Chain of Custody that grows out of it (spec H1, H2): one section, `#how`, the scroll runway.
 * The copy is server-rendered and focuses in with CSS on first paint, so the h1 is the LCP and never waits for JS.
 */
export function Hero() {
  const copy = (
    <>
      {/* The lines are display: contents, so all the headline's text belongs to the h1 itself and the h1 is the LCP
          element at every width (as separate boxes, each line loses to the lead on a phone). It focuses in as one. */}
      <h1 id="hero-title" className={clsx("text-display font-semibold", styles.focusIn)} style={line(0)}>
        <span className="contents lg:whitespace-nowrap">Proof it&rsquo;s destroyed.</span>
        <br />
        <span className={clsx(serif.className, "contents font-normal tracking-[-0.02em] text-muted italic")}>Paid in a minute.</span>
      </h1>
      <div className="mt-8 flex flex-col lg:mt-12 lg:max-w-[36rem]">
        <p className={clsx("max-w-[34ch] text-body text-muted sm:text-lead lg:max-w-[25rem]", styles.focusIn)} style={line(1)}>
          Owners cut the recalled product on a live camera, with a one-time code on it. Remedy checks the photo and pays the refund through PayPal.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 lg:mt-10">
          <Button href="/signin" size="lg">
            Start a recall
          </Button>
          <Button href="/r/kikea-x-vesolje/try" variant="tertiary" size="lg">
            Try a claim with sample photos
          </Button>
        </div>
        <p className="mt-4 font-mono text-micro text-faint">
          Needs a PayPal sandbox personal account ·{" "}
          <a href={SANDBOX_ACCOUNTS_URL} className="underline decoration-line-strong underline-offset-4 transition-colors duration-160 hover:text-text">
            How to make one
          </a>
        </p>
      </div>
    </>
  );
  return <HeroRunway copy={copy} />;
}
