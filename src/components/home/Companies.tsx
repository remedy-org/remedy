import clsx from "clsx";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import { CompaniesPreview } from "./CompaniesPreview";
import { Section } from "./Section";

/**
 * An exhibit label pinned to the console frame: mono amber text and a hairline leader that runs into the frame to a
 * dot on what it names. Laptops only; the positions follow the replica's fixed column widths.
 */
function FrameTag({ children, side, style, reach }: { children: string; side: "top" | "bottom"; style: CSSProperties; reach: number }) {
  return (
    <span aria-hidden="true" className={clsx("pointer-events-none absolute z-10 hidden flex-col items-center lg:flex", side === "top" ? "bottom-full" : "top-full flex-col-reverse")} style={style}>
      <span className="micro whitespace-nowrap text-accent-text">{children}</span>
      <span className={clsx("relative w-px bg-accent-text/60", side === "top" ? "mt-2" : "mb-2")} style={{ height: 32 + reach, marginBottom: side === "top" ? -reach : undefined, marginTop: side === "bottom" ? -reach : undefined }}>
        <span className={clsx("absolute left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-accent", side === "top" ? "-bottom-0.5" : "-top-0.5")} />
      </span>
    </span>
  );
}

export function Companies() {
  return (
    <Section
      id="companies"
      exhibit="D · For companies"
      head="statement"
      title="Every claim, with its evidence."
      muted="Paid, held or refused by the rule, in one queue."
      className="bg-[image:var(--table-glow)] bg-[length:140%_100%] bg-top bg-no-repeat"
    >
      <figure className="relative m-0 lg:mt-8">
        <FrameTag side="top" reach={10} style={{ left: 193, transform: "translateX(-50%)" }}>
          CPSC report draft
        </FrameTag>
        <FrameTag side="top" reach={144} style={{ right: 300, transform: "translateX(50%)" }}>
          Evidence panel
        </FrameTag>
        <FrameTag side="bottom" reach={100} style={{ right: 624, transform: "translateX(50%)" }}>
          PayPal Payouts batch
        </FrameTag>
        <CompaniesPreview />
        <figcaption className="sr-only">
          Remedy&rsquo;s console on the Kikea demo recall. Sample claims from the eval: AI-made test photos, never paid.
        </figcaption>
      </figure>

      <div className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="font-mono text-title-lg font-medium tracking-[-0.03em] tabular-nums">
            26 <span className="text-faint">of</span> 19,596
          </p>
          <div
            role="meter"
            aria-label="Units remedied of units sold"
            aria-valuemin={0}
            aria-valuemax={19596}
            aria-valuenow={26}
            className="mt-4 h-1 max-w-[40rem] overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full w-[3px] rounded-full bg-accent" />
          </div>
          <p className="mt-3 font-mono text-micro text-faint">remedied so far · sample data · 0.13%</p>
        </div>
        <div className="flex max-w-[44ch] flex-col items-start">
          <p className="text-body text-pretty text-muted">
            Log in with PayPal; there is no separate sign-up. Your workspace starts with the Kikea demo recall and 40 sample claims, so you can see
            claims arrive before you import your own.
          </p>
          <Button href="/signin" size="lg" className="mt-6">
            Log in with PayPal
          </Button>
          <p className="mt-3 text-ui text-faint">Refunds run in PayPal&rsquo;s sandbox until launch.</p>
        </div>
      </div>
    </Section>
  );
}
