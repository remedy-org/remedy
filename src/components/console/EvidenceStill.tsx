import clsx from "clsx";
import type { ReactNode } from "react";
import { CheckIcon, CrossIcon } from "@/components/ui";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import { EvidencePhoto } from "./EvidencePhoto";
import { VerdictMark, verdictOf } from "./VerdictMark";

/** What the still draws of a claim: the console panel's DrawerClaim, cut to its photos, checks and verdict (the
 * homepage sends one for every claim in its queue). */
export type StillClaim = Pick<DrawerClaim, "id" | "decision" | "code" | "payer" | "photos" | "sentence" | "amount" | "review" | "summary"> & {
  payout: { status: string } | null;
  /** The five checks by their own names; `doubt` names the answers in doubt under one that partly passed. */
  checks: (DrawerClaim["checks"][number] & { doubt?: string })[];
};

export interface EvidenceStillProps {
  claim: StillClaim;
  /** What goes under the rule's sentence: the review's foot (the tour's Pay and Reject, or what happened); by default,
   * on a held claim, a line saying what a person does here. */
  note?: ReactNode;
  /** Fill the parent's width and grow with the content (phones), instead of the docked 380px panel. */
  fluid?: boolean;
  className?: string;
}

// A held answer is marked with a filled dot: two bars beside the verdict's own pause would read as a media player.
const HeldDot = ({ size = 12 }: { size?: number }) => <span className="rounded-full bg-hold" style={{ width: size / 2, height: size / 2 }} />;

const MARK = {
  pass: { icon: CheckIcon, tone: "bg-pay-soft text-pay", word: "Passed" },
  hold: { icon: HeldDot, tone: "bg-hold-soft text-hold", word: "Held" },
  reject: { icon: CrossIcon, tone: "bg-stop-soft text-stop", word: "Failed" },
} as const;

/** The sentence of the model's answer that carries its decision: the first that turns on "but", a "cannot" or an
 * "unclear", else the first. */
export function decidingSentence(text: string) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((t) => t.trim()) ?? [text];
  return sentences.find((t) => /\b(but|cannot|can[’']t|couldn[’']t|unclear|unable|not sure)\b/i.test(t)) ?? sentences[0];
}

/**
 * The model's quoted answer. Docked in the tour's frame, where a short laptop screen leaves it a few lines, it falls back
 * to the one sentence that decides the claim, whole (home/tour.module.css .dock), rather than a cut one; on its own (a phone)
 * it is always whole.
 */
function Quote({ text, docked }: { text: string; docked: boolean }) {
  const key = docked ? decidingSentence(text) : text;
  return (
    <q data-quote className="mt-0.5 block text-ui leading-[1.5] text-muted">
      {key === text ? (
        text
      ) : (
        <>
          <span data-quote-full>{text}</span>
          <span data-quote-key>{key}</span>
        </>
      )}
    </q>
  );
}

/**
 * The open claim's evidence as a still, as the console's panel leads with it: the photos, the model's quoted answer for
 * what held or failed the claim, the checks that passed in one line, the rule's sentence. A caption, not buttons: the still has no
 * actions to press. The homepage's console tour lays it over the grid; its phone story shows it on its own.
 */
export function EvidenceStill({ claim, note, fluid, className }: EvidenceStillProps) {
  // What stopped the claim, in the model's words; then everything that passed, named in one line.
  const open = claim.checks.filter((c) => c.outcome !== "pass");
  const passed = claim.checks.filter((c) => c.outcome === "pass");
  return (
    <aside
      aria-label={`Evidence for ${claim.id}`}
      className={clsx("flex flex-col overflow-hidden rounded-card bg-surface shadow-float", fluid ? "w-full" : "h-full w-[380px] shrink-0", className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="flex items-center gap-3">
          <span className="font-mono text-ui font-medium whitespace-nowrap">{claim.id}</span>
          <VerdictMark
            verdict={verdictOf({ decision: claim.decision, payoutStatus: claim.payout?.status ?? null })}
            className={claim.decision === "paid" || claim.decision === "pending" ? undefined : "text-text"}
          />
        </span>
        <span className="text-ui whitespace-nowrap text-muted">
          Code <span className="font-mono text-text">{claim.code}</span>
        </span>
      </div>
      <div className={clsx("relative min-h-0 flex-1", !fluid && "overflow-hidden")}>
        <div className="flex flex-col gap-3 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {claim.photos.map((src, i) => (
              <EvidencePhoto key={src} src={src} n={i + 1} of={claim.photos.length} sized plain captionClassName="text-micro text-faint max-md:sr-only" />
            ))}
          </div>
          <ol aria-label={`Model answers for ${claim.id}`} className="flex flex-col gap-2.5">
            {open.map((c) => {
              const mark = MARK[c.outcome];
              const Icon = mark.icon;
              return (
                <li key={c.id} className="flex gap-3">
                  <span className={clsx("mt-px flex size-5 shrink-0 items-center justify-center rounded-full", mark.tone)}>
                    <Icon size={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ui font-medium">
                      {c.label}
                      <span className="sr-only">: {mark.word}</span>
                    </p>
                    {c.doubt && <p className="mt-0.5 text-ui text-text">{c.doubt}</p>}
                    {c.evidence ? <Quote text={c.evidence} docked={!fluid} /> : <p className="mt-0.5 text-ui text-muted">{c.rule}</p>}
                  </div>
                </li>
              );
            })}
            {passed.length > 0 && (
              <li data-passed className="flex gap-3 border-t border-line pt-2.5">
                <span className={clsx("mt-px flex size-5 shrink-0 items-center justify-center rounded-full", MARK.pass.tone)}>
                  <CheckIcon size={12} />
                </span>
                <p className="min-w-0 flex-1 text-ui text-muted">
                  <span className="font-medium text-text">Passed:</span> {passed.map((c) => c.label.charAt(0).toLowerCase() + c.label.slice(1)).join(", ")}
                </p>
              </li>
            )}
          </ol>
        </div>
      </div>
      <div className="border-t border-line px-4 py-3">
        {/* A phone has the held answer just above, and the payout path says what a person does: the rule's sentence would
            say it a third time. */}
        <p data-rule className={clsx("text-ui", fluid && note && "max-md:hidden")}>{claim.sentence}</p>
        {note ? (
          <div className={clsx("mt-3", fluid && "max-md:mt-0")}>{note}</div>
        ) : (
          claim.review && <p className="mt-2 text-ui text-muted">A person approves or rejects it here. Approving sends {claim.amount} through PayPal.</p>
        )}
      </div>
    </aside>
  );
}
