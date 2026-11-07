import clsx from "clsx";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import { CompaniesPreview } from "./CompaniesPreview";
import { Section } from "./Section";

/**
 * An exhibit label pinned to the console frame: mono amber text and a hairline leader that runs into the frame to a
 * dot on what it names. Laptops only; the positions follow the console preview's chrome and panel at 1440 (the
 * static replica that stands in while it loads has the same chrome).
 */
function FrameTag({ children, side, style, reach }: { children: string; side: "top" | "bottom"; style: CSSProperties; reach: number }) {
  return (
    <span aria-hidden="true" className={clsx("pointer-events-none absolute z-10 hidden flex-col items-center lg:flex", side === "top" ? "bottom-full" : "top-full flex-col-reverse")} style={style}>
      <span className="micro whitespace-nowrap text-accent-text">{children}</span>
      <span className={clsx("relative w-px bg-accent-text/60", side === "top" ? "mt-2" : "mb-2")} style={{ height: 20 + reach, marginBottom: side === "top" ? -reach : undefined, marginTop: side === "bottom" ? -reach : undefined }}>
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
      muted="Paid, held or refused, in one queue."
      className="bg-[image:var(--table-glow)] bg-[length:140%_100%] bg-top bg-no-repeat"
    >
      <figure className="relative m-0 lg:mt-8">
        <FrameTag side="top" reach={10} style={{ left: 265, transform: "translateX(-50%)" }}>
          CPSC report draft
        </FrameTag>
        <FrameTag side="top" reach={216} style={{ right: 300, transform: "translateX(50%)" }}>
          Evidence panel
        </FrameTag>
        <CompaniesPreview />
        <figcaption className="sr-only">
          Remedy&rsquo;s console on the Kikea demo recall. Sample claims from the eval: AI-made test photos, never paid.
        </figcaption>
      </figure>

      {/* The remedied count lives in the frame's ledger (26 of 19,596, sample data); the CTA sits in one row under it. */}
      <div className="mt-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <p className="max-w-[60ch] text-body text-pretty text-muted">
          Log in with PayPal; there is no separate sign-up. Your workspace starts with the Kikea demo recall and 40 sample claims, so you can see claims
          arrive before you import your own. Refunds run in PayPal&rsquo;s sandbox until launch.
        </p>
        <Button href="/signin" size="lg" className="shrink-0 self-start lg:self-auto">
          Log in with PayPal
        </Button>
      </div>
    </Section>
  );
}
