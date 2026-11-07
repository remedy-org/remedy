import clsx from "clsx";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import { CompaniesPreview } from "./CompaniesPreview";
import { Section } from "./Section";

/**
 * An exhibit label pinned to the console frame: mono text in --faint and a hairline leader that runs into the frame to a
 * dot on what it names. Laptops only; the positions follow the console preview's chrome and panel at 1440 (the
 * static replica that stands in while it loads has the same chrome).
 */
function FrameTag({ children, side, style, reach }: { children: string; side: "top" | "bottom"; style: CSSProperties; reach: number }) {
  return (
    <span aria-hidden="true" className={clsx("pointer-events-none absolute z-10 hidden flex-col items-center lg:flex", side === "top" ? "bottom-full" : "top-full flex-col-reverse")} style={style}>
      <span className="micro whitespace-nowrap text-faint">{children}</span>
      <span className={clsx("relative w-px bg-line-2", side === "top" ? "mt-2" : "mb-2")} style={{ height: 20 + reach, marginBottom: side === "top" ? -reach : undefined, marginTop: side === "bottom" ? -reach : undefined }}>
        <span className={clsx("absolute left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-text-2", side === "top" ? "-bottom-0.5" : "-top-0.5")} />
      </span>
    </span>
  );
}

export function Companies() {
  return (
    <Section
      id="companies"
      exhibit="D · For companies"
      title="Every claim, with its evidence."
      muted="Paid, held or refused, in one queue."
    >
      <figure className="relative m-0 lg:mt-8">
        <FrameTag side="top" reach={10} style={{ left: 265, transform: "translateX(-50%)" }}>
          CPSC report draft · in your console
        </FrameTag>
        {/* Down past the empty end of the chrome and title rows, ending just above the ledger's "paid through PayPal"
            figure, never on its text. The ledger sizes to its text from the frame's left padding, so one place holds
            at every laptop width, and x 520 is over that figure in both the grid and the narrower static replica that
            stands in while it loads. */}
        <FrameTag side="top" reach={88} style={{ left: 520, transform: "translateX(-50%)" }}>
          PayPal Payouts batch
        </FrameTag>
        {/* This one hangs below the frame and points up into the grid area's foot: a short leader, nothing crossed. */}
        <FrameTag side="bottom" reach={46} style={{ right: 210, transform: "translateX(50%)" }}>
          Evidence panel
        </FrameTag>
        <CompaniesPreview />
        {/* The ledger's $0.00 beside the hero's paid RM-0442: say which claim was paid, and where, without a new figure. */}
        <figcaption className="mt-4 max-w-[68ch] text-ui text-pretty text-muted lg:mt-5">
          <span className="sr-only">Remedy&rsquo;s console on the Kikea demo recall. </span>A sample workspace: its 40 claims are from the eval, with AI-made
          test photos, and were decided but never paid, so it shows $0.00 paid. Claim RM-0442, above, was paid in PayPal sandbox.
        </figcaption>
      </figure>

      {/* The remedied count lives in the frame's ledger (26 of 19,596, sample data); the CTA sits in one row under it. */}
      <div className="mt-10 grid-12 gap-y-6 lg:mt-20 lg:items-center">
        <p className="col-span-12 max-w-[60ch] text-body text-pretty text-text-2 lg:col-span-7">
          Log in with PayPal; there is no separate sign-up. Your workspace starts with the Kikea demo recall and 40 sample claims, so you can see claims
          arrive before you import your own. Refunds run in PayPal&rsquo;s sandbox until launch.
        </p>
        <Button href="/signin" variant="secondary" size="lg" className="col-span-12 justify-self-start lg:col-span-5 lg:col-start-8">
          Log in with PayPal
        </Button>
      </div>
    </Section>
  );
}
