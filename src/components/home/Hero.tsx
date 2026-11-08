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
 * from a real claim under the action; the product carries the attention. The copy is server-rendered and fades in with
 * CSS on first paint, so the h1 is the LCP and never waits for JS.
 */
export function Hero() {
  const copy = (
    <>
      {/* Set line by line on one column start, so the breaks are the same at every width (a narrow phone wraps the long
          lines on their own). */}
      <h1 id="hero-title" className={clsx("text-display font-medium", styles.focusIn)} style={line(0)}>
        Recall refunds, <br />
        paid in a minute.
      </h1>
      <p className={clsx("mt-4 text-head-sm font-medium text-balance text-text lg:mt-5", styles.focusIn)} style={line(1)}>
        Proven destroyed on a live camera.
      </p>
      <p className={clsx("mt-5 max-w-[34ch] text-body lg:max-w-[42ch] text-pretty text-text-2 sm:text-lead lg:mt-6", styles.focusIn)} style={line(1)}>
        {/* Two blocks on phones, one paragraph from sm: each half stays smaller than the h1, so the h1 is the LCP. */}
        <span className="block sm:inline">Remedy turns any CPSC recall into a live refund program.</span>{" "}
        <span className="block sm:inline">
          The owner photographs the cut-up product with a one-time code, and the refund lands in their PayPal account.
        </span>
      </p>
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
      <div className={clsx("mt-4 flex flex-col gap-1.5", styles.focusIn)} style={line(3)}>
        {/* One proof, from a real claim: RM-0442's photo to payout (CLAIM.seconds). */}
        <p className="text-ui text-pretty text-text-2">
          Paid {CLAIM.seconds} seconds after the photo on claim <span className="font-mono whitespace-nowrap">{CLAIM.id}</span> · CPSC{" "}
          <span className="font-mono whitespace-nowrap">{CLAIM.recall.replace(/^CPSC /, "")}</span>
        </p>
        {/* An owner with a real recall: the demo above is not her claim, and this is where hers is. */}
        <p className="max-w-[36ch] text-ui text-pretty text-muted">Own a recalled product? Claim through the link on its recall notice.</p>
      </div>
    </>
  );
  return <HeroRunway copy={copy} />;
}
