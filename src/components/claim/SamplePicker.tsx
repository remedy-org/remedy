import clsx from "clsx";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import { SAMPLE_COPY, sampleTitle } from "@/lib/demo/sampleCopy";
import type { Refusal } from "@/lib/limits";
import type { Decision } from "@/lib/types";
import { StepTitle } from "./Exhibit";
import { FocusTitle } from "./FocusTitle";
import { LimitNextStep, LimitNotice } from "./LimitNotice";
import { latestRuns, ranLine, type RoundRun } from "./Scoreboard";

export interface SampleOption {
  sample: DemoSample;
  /** Why it can't run yet, e.g. the repost needs the genuine claim first. */
  locked?: string;
}

export interface DemoRun {
  id: string;
  href: string;
  title: string;
  decision: Decision;
  /** The sample it ran. */
  sample?: string;
  /** Held because the photo check gave no answer (noModelAnswer). */
  unanswered?: boolean;
}

/** This round's runs that reached the photos step. */
export const roundRuns = (runs: DemoRun[]): RoundRun[] => runs.flatMap((r) => (r.sample ? [{ sample: r.sample, decision: r.decision, unanswered: r.unanswered }] : []));

const OUTCOME: Partial<Record<Decision, { word: string; tone: string }>> = {
  paid: { word: "Paid", tone: "text-pay" },
  rejected: { word: "Not paid", tone: "text-stop" },
  blocked: { word: "Not paid", tone: "text-stop" },
  held: { word: "For review", tone: "text-hold" },
};

/**
 * The demo's stand-in for the camera: four claims in a list, each a photo, what it is and what happens to it. The next
 * one not yet run is selected. A plain form, no script needed; on a phone the button waits at the foot of the screen.
 * Once all four have run, the list is the round's record and the button starts over.
 */
export function SamplePicker({
  slug,
  options,
  selected,
  runs,
  roundDone,
  refusal,
  elsewhere,
}: {
  slug: string;
  options: SampleOption[];
  selected: string;
  /** This round's demo claims. */
  runs: DemoRun[];
  /** Every claim has run in this round. */
  roundDone: boolean;
  refusal?: Refusal | null;
  /** This browser's round is new, and this PayPal login has demo claims from another device. */
  elsewhere?: boolean;
}) {
  const scored = roundRuns(runs);
  // Refused by a limit: the list stays as a record, and nothing can run until it resets.
  const off = Boolean(refusal);
  const latest = latestRuns(scored);
  return (
    <section aria-labelledby="picker-title" className="flex w-full max-w-[40rem] flex-col gap-6">
      {/* A limit's notice, rendered later, takes focus from the title. */}
      <FocusTitle id="picker-title" />
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <StepTitle id="picker-title">Choose a claim</StepTitle>
          {scored.length > 0 && <span className="shrink-0 text-ui text-muted">{ranLine(scored)}</span>}
        </div>
        <p className="text-body text-muted">Each one runs through the real checks.</p>
        {elsewhere && <p className="text-ui text-muted">This device starts fresh. Claims from your other devices are in the company console.</p>}
      </div>

      {refusal && <LimitNotice refusal={refusal} demo />}

      {/* Once all four have run, the form starts over instead: running one again would only meet its own earlier claim. */}
      <form action={roundDone ? "/api/claims/round" : "/api/claims"} method="post" className="flex flex-col gap-5">
        <input type="hidden" name="recall" value={slug} />
        <fieldset disabled={off} className="-mx-3 flex flex-col gap-1">
          <legend className="sr-only">Claims to run</legend>
          {options.map(({ sample, locked }) => {
            const run = latest.get(sample.id);
            const outcome = run && OUTCOME[run.decision];
            const copy = SAMPLE_COPY[sample.id];
            const id = `sample-${sample.id}`;
            return (
              <label
                key={sample.id}
                aria-disabled={locked || off ? true : undefined}
                className={clsx(
                  "group relative flex items-center gap-4 rounded-control px-3 py-3 transition-colors duration-160",
                  // Selected: a 1px ink ring, never an outline, which is focus's alone. The screen's one amber is the button.
                  !off && !roundDone && "has-checked:ring-1 has-checked:ring-text",
                  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
                  !roundDone && !off && !locked && "cursor-pointer hover:bg-surface",
                  locked && "cursor-not-allowed",
                  off && "opacity-60",
                )}
              >
                {!roundDone && (
                  <input
                    type="radio"
                    name="sample"
                    value={sample.id}
                    defaultChecked={sample.id === selected}
                    disabled={Boolean(locked)}
                    aria-labelledby={`${id}-title`}
                    aria-describedby={`${id}-line${locked ? ` ${id}-locked` : ""}`}
                    className="peer sr-only"
                  />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sample.photos[0]} alt="" aria-hidden="true" className={clsx("size-16 shrink-0 rounded-control bg-surface-2 object-cover object-[50%_65%] ring-1 ring-line", locked && "opacity-50")} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span id={`${id}-title`} className={clsx("text-body font-medium", locked ? "text-muted" : "text-text")}>
                    {copy?.title ?? sample.title}
                  </span>
                  <span id={`${id}-line`} className="text-ui text-muted">
                    {locked ? <span id={`${id}-locked`}>Run the first claim before this one.</span> : (copy?.line ?? sample.decidedBy)}
                  </span>
                </span>
                {outcome && <span className={clsx("shrink-0 text-ui font-medium", outcome.tone)}>{outcome.word}</span>}
                {!roundDone && !off && (
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong",
                      "peer-checked:border-text peer-checked:after:size-2.5 peer-checked:after:rounded-full peer-checked:after:bg-text",
                      locked && "border-dashed",
                    )}
                  />
                )}
              </label>
            );
          })}
        </fieldset>
        <p className="text-ui text-faint">Sample photos, staged for this demo.</p>
        {roundDone && <p className="text-ui text-muted">All four have run. Start over to run them again.</p>}
        <div data-action-bar="" className="z-10 max-sm:sticky max-sm:bottom-0 max-sm:mx-[calc(var(--gutter)*-1)] max-sm:border-t max-sm:border-line max-sm:bg-bg max-sm:px-(--gutter) max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Refused by a limit, nothing can run until it resets: the console, where the claims are, takes the button. */}
          {off ? (
            <LimitNextStep demo />
          ) : (
            <Button type="submit" size="lg" block>
              {roundDone ? "Start over" : "Run this claim"}
            </Button>
          )}
        </div>
      </form>

      {runs.length > 0 && (
        <div className="flex flex-col gap-2 pt-2">
          <h3 className="text-ui font-medium text-muted">Your claims</h3>
          <ul className="flex flex-col border-t border-line">
            {runs.map((r) => (
              <li key={r.id} className="border-b border-line">
                <Link href={r.href} className="flex min-h-11 items-center gap-3 text-ui text-muted hover:text-text">
                  <span className="font-mono text-micro text-faint">{r.id}</span>
                  <span className="truncate">{sampleTitle(r.sample ?? "", r.title)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {!roundDone && (
            <form action="/api/claims/round" method="post" className="pt-2">
              <input type="hidden" name="recall" value={slug} />
              <Button type="submit" variant="tertiary" size="sm">
                Start over
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
