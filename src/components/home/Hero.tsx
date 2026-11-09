import clsx from "clsx";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import { CLAIM } from "./custody/claim";
import { HeroRunway } from "./custody/HeroRunway";
import styles from "./custody/custody.module.css";

const line = (n: number) => ({ "--line": n }) as CSSProperties;

/**
 * The hero at rest and the Chain of Custody that grows out of it (spec H1, H2): one section, `#how`, the scroll runway.
 * Confidence through restraint: a 56px headline in one colour, its second sentence the subhead, and one line of proof
 * from a real claim under the action; the product carries the attention. An owner with a real recall finds the way to
 * hers in the footer and the phone menu, not here. The copy is server-rendered and fades in with
 * CSS on first paint, so the h1 is the LCP and never waits for JS.
 */
export function Hero() {
  const copy = (
    <>
      {/* Set line by line on one column start, so the breaks are the same at every width (a narrow phone wraps the long
          lines on their own). */}
      {/* A big monitor gets a bigger headline: up to 72px from 1600px wide. */}
      <h1 id="hero-title" className={clsx("text-display font-medium min-[1600px]:text-[clamp(3.5rem,3.75vw,4.5rem)]", styles.focusIn)} style={line(0)}>
        Recall refunds, <br />
        paid in a minute.
      </h1>
      <p className={clsx("mt-4 text-head-sm font-medium text-balance text-text lg:mt-5", styles.focusIn)} style={line(1)}>
        Proof of destruction, on a live camera.
      </p>
      {/* No lead under the subhead: How it works, straight below, shows the claim the lead would describe. */}
      <div className={clsx("mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 lg:mt-10", styles.focusIn)} style={line(2)}>
        {/* The owner's path is the screen's one amber action; companies get a quieter link to their section, the nav's
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
          Run a recall on Remedy
        </Button>
      </div>
      <div className={clsx("mt-4", styles.focusIn)} style={line(3)}>
        {/* One proof, from a real claim, as the console's timeline has it: sent at CLAIM.seconds, confirmed at CLAIM.confirmed,
            both in one unit ("15 s", "55 s"). */}
        {/* The claim's ids on a line of their own, so the sentence wraps clear of the receipt (44ch at 1024). */}
        <p className="max-w-[44ch] text-ui text-pretty text-text-2 xl:max-w-none">
          Sent to the owner&rsquo;s PayPal {CLAIM.seconds}&nbsp;s after the photo, confirmed by PayPal at {CLAIM.confirmed}&nbsp;s
          <span className="block">
            Claim <span className="font-mono whitespace-nowrap">{CLAIM.id}</span> · CPSC{" "}
            <span className="font-mono whitespace-nowrap">{CLAIM.recall.replace(/^CPSC /, "")}</span>
          </span>
        </p>
      </div>
    </>
  );
  return <HeroRunway copy={copy} />;
}
