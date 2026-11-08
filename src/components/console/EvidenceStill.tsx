import clsx from "clsx";
import type { ReactNode } from "react";
import { CheckProgress, StatusPill } from "@/components/ui";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import { EvidencePhoto } from "./EvidencePhoto";

export interface EvidenceStillProps {
  claim: DrawerClaim;
  /** What goes under the rule's sentence on a held claim; by default, a line saying what a person does here. */
  note?: ReactNode;
  /** Fill the parent's width and grow with the content (phones), instead of the docked 380px panel. */
  fluid?: boolean;
  className?: string;
}

/**
 * The open claim's evidence as a still, as the console's panel leads with it: the photos,
 * the model's quoted answers (the unclear one first), the rule's sentence. A caption, not buttons: the still has no
 * actions to press. The homepage's console preview docks it beside the grid; its phone story shows it on its own.
 */
export function EvidenceStill({ claim, note, fluid, className }: EvidenceStillProps) {
  const checks = [...claim.checks].sort((a, b) => Number(a.outcome === "pass") - Number(b.outcome === "pass"));
  return (
    <aside
      aria-label={`Evidence for ${claim.id}`}
      className={clsx("flex flex-col overflow-hidden rounded-card bg-surface shadow-float", fluid ? "w-full" : "h-full w-[380px] shrink-0", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <span className="flex items-center gap-3">
          <span className="font-mono text-ui font-medium whitespace-nowrap">{claim.id}</span>
          <StatusPill status={claim.decision} />
        </span>
        <span className="font-mono text-micro whitespace-nowrap text-faint">
          {claim.payer} · Code {claim.code}
        </span>
      </div>
      <div className={clsx("relative min-h-0 flex-1", !fluid && "overflow-hidden")}>
        <div className="flex flex-col gap-4 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {claim.photos.map((src, i) => (
              <EvidencePhoto key={src} src={src} n={i + 1} of={claim.photos.length} sized />
            ))}
          </div>
          <CheckProgress
            label={`Model answers for ${claim.id}`}
            steps={checks.slice(0, fluid ? 1 : 3).map((c) => ({
              id: c.id,
              label: c.label,
              state: c.outcome === "reject" ? "reject" : c.outcome,
              detail: c.evidence ? (
                <q className="block text-ui leading-[1.55] text-muted">{c.evidence}</q>
              ) : (
                c.rule
              ),
            }))}
          />
        </div>
        {!fluid && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-surface to-transparent" />}
      </div>
      <div className="border-t border-line px-4 py-3">
        <p className="text-ui">{claim.sentence}</p>
        {claim.review &&
          (note ? (
            <div className="mt-3">{note}</div>
          ) : (
            <p className="mt-2 text-ui text-muted">A person approves or rejects it here. Approving sends {claim.amount} through PayPal.</p>
          ))}
      </div>
    </aside>
  );
}
