import clsx from "clsx";
import type { ReactNode } from "react";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import { EvidencePhoto } from "./EvidencePhoto";
import { ClaimVerdict, Deciding, deciding, FiveChecks, HeaderMeta, MoneyLine } from "./EvidenceParts";

/** What the still draws of a claim: the console panel's own DrawerClaim (`drawer`), with the photos as the homepage
 * serves them, and its verdict, payout and review as the tour leaves them once a visitor decides it (ConsoleTour.tsx). */
export type StillClaim = Pick<DrawerClaim, "id" | "decision" | "code" | "payer" | "photos" | "sentence" | "amount" | "review" | "summary"> & {
  payout: { status: string } | null;
  /** The five checks by their own names; `doubt` names the answers in doubt under one that partly passed. */
  checks: (DrawerClaim["checks"][number] & { doubt?: string })[];
  /** The panel's claim as the console builds it (drawer.ts toDrawerClaim): the still says it with the panel's own parts. */
  drawer: DrawerClaim;
};

export interface EvidenceStillProps {
  claim: StillClaim;
  /** The panel's foot: the review's buttons (the tour's Approve and Reject, or what happened), as the console's footer. */
  note?: ReactNode;
  /** Fill the parent's width and grow with the content (phones), instead of the docked 380px panel. */
  fluid?: boolean;
  className?: string;
}

/**
 * The open claim's evidence as the console's panel draws it, word for word: its header (id, verdict, money; filing time,
 * PayPal id, code), what held or refused it with the model's own words and the five in one line, the photos, and the
 * five checks with what each recorded, from the panel's own parts (EvidenceParts.tsx), so the two never drift. The
 * homepage's console tour lays it over the grid; its phone story shows it on its own.
 */
export function EvidenceStill({ claim, note, fluid, className }: EvidenceStillProps) {
  // Docked in the tour's window, which is a laptop screen's height less the steps, a held or refused claim's photos stand
  // beside what decided it, whole, so the check that held it is in the first view under them; on a phone, and for a
  // claim with nothing to explain, they come after it as in the console's panel.
  const beside = !fluid && deciding({ ...claim.drawer, decision: claim.decision, review: claim.review }) !== null;
  // The visitor's decision in the tour changes the verdict and the review; everything else is the panel's as loaded.
  const d: DrawerClaim = { ...claim.drawer, decision: claim.decision, review: claim.review };
  const photos = (
    <section data-beside={beside || undefined} className={clsx("flex flex-col gap-3", beside && "w-24 shrink-0")} aria-label={`Photos for ${claim.id}`}>
      {!beside && <h3 className="text-ui font-medium text-text">Photos</h3>}
      <div className={clsx("grid gap-2", beside ? "grid-cols-1" : "grid-cols-2")}>
        {claim.photos.map((src, i) => (
          <EvidencePhoto key={src} src={src} n={i + 1} of={claim.photos.length} sized plain tall={beside} captionClassName="text-micro text-faint max-md:sr-only" />
        ))}
      </div>
    </section>
  );
  return (
    <aside
      aria-label={`Evidence for ${claim.id}`}
      className={clsx("flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-float", fluid ? "w-full" : "h-full w-[380px] shrink-0", className)}
    >
      <header className="border-b border-line bg-surface-2 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="font-mono text-body font-medium">{claim.id}</p>
          <span className="inline-flex w-[6.5rem]">
            <ClaimVerdict claim={claim} />
          </span>
          <MoneyLine claim={d} />
        </div>
        <HeaderMeta claim={d} />
      </header>
      {/* Docked, it scrolls under a fading edge as the panel does; on a phone it grows with its content. */}
      <div
        data-scroller
        className={clsx("relative min-h-0 flex-1", !fluid && "overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,#000_calc(100%-20px),transparent)]")}
      >
        <div className="flex flex-col gap-5 px-5 py-4 [&_p]:text-pretty [&_q]:text-pretty">
          {beside ? (
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <Deciding claim={d} />
              </div>
              {photos}
            </div>
          ) : (
            <>
              <Deciding claim={d} />
              {photos}
            </>
          )}
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-ui font-medium text-text">Checks</h3>
              <span className="text-ui text-muted">{d.five}</span>
            </div>
            <FiveChecks claim={d} />
          </section>
        </div>
      </div>
      {note && <div className="border-t border-line px-5 py-3">{note}</div>}
    </aside>
  );
}
