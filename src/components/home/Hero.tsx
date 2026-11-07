import clsx from "clsx";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import { CLAIM, SANDBOX_ACCOUNTS_URL } from "./custody/claim";
import { HeroRunway } from "./custody/HeroRunway";
import styles from "./custody/custody.module.css";

const line = (n: number) => ({ "--line": n }) as CSSProperties;

// What Remedy is, in three checkable facts: the real demo claim's time, the checks, and the eval (docs/EVAL.md).
const FACTS = [
  { figure: `${CLAIM.seconds}\u00a0s`, text: `photo to PayPal payout, claim\u00a0${CLAIM.id}` },
  { figure: "5 checks", text: "the first three need no AI" },
  { figure: "36 claims", text: "tested, 4 models, 3 runs each" },
];

/**
 * The hero at rest and the Chain of Custody that grows out of it (spec H1, H2): one section, `#how`, the scroll runway.
 * Confidence through restraint: a 56px two-tone headline in one voice, and the product carries the attention. The
 * copy is server-rendered and focuses in with CSS on first paint, so the h1 is the LCP and never waits for JS.
 */
export function Hero() {
  const copy = (
    <>
      {/* The lines are display: contents, so all the headline's text belongs to the h1 itself and the h1 is the LCP
          element at every width. It focuses in as one. */}
      <h1 id="hero-title" className={clsx("text-display font-medium text-balance", styles.focusIn)} style={line(0)}>
        <span className="contents">Proof it&rsquo;s destroyed.</span> <span className="contents text-muted">Paid in a minute.</span>
      </h1>
      <p className={clsx("mt-6 max-w-[34ch] text-body text-pretty text-text-2 sm:text-lead lg:mt-8", styles.focusIn)} style={line(1)}>
        Owners cut the recalled product on a live camera, with a one-time code on it. Remedy checks the photo and pays the refund through PayPal.
      </p>
      <div className={clsx("mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 lg:mt-10", styles.focusIn)} style={line(2)}>
        <Button href="/signin" size="lg">
          Start a recall
        </Button>
        <Button href="/r/kikea-x-vesolje/try" variant="tertiary" size="lg">
          Try a claim with sample photos
        </Button>
      </div>
      <p className="mt-4 font-mono text-micro text-faint">
        Needs a PayPal sandbox personal account ·{" "}
        <a href={SANDBOX_ACCOUNTS_URL} className="underline decoration-line-2 underline-offset-4 transition-colors duration-160 hover:text-text">
          How to make one
        </a>
      </p>
    </>
  );
  const facts = (
    <dl className="grid gap-x-[var(--col-gap)] gap-y-3 sm:grid-cols-3">
      {FACTS.map((f) => (
        <div key={f.figure} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-x-3 sm:flex sm:flex-col sm:gap-1">
          <dt className="text-head-sm font-medium whitespace-nowrap">{f.figure}</dt>
          <dd className="text-ui text-pretty text-muted">{f.text}</dd>
        </div>
      ))}
    </dl>
  );
  return <HeroRunway copy={copy} facts={facts} />;
}
