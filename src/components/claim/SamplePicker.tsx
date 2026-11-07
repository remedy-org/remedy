import clsx from "clsx";
import Link from "next/link";
import { Button, StatusPill, statusLabel } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import type { Refusal } from "@/lib/limits";
import type { Decision } from "@/lib/types";
import { StepTitle } from "./Exhibit";
import { FocusTitle } from "./FocusTitle";
import { LockIcon } from "./icons";
import { LimitNotice, RetryLabel } from "./LimitNotice";
import { latestRuns, RunResult, scoreLine, type RoundRun } from "./Scoreboard";

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
  /** The sample it ran, for the scoreboard. */
  sample?: string;
  /** Held because the model gave no answer (noModelAnswer). */
  unanswered?: boolean;
}

// What each sample proves, in one line under its title (here and on the try page's preview).
export const SAMPLE_TESTS: Record<string, string> = {
  genuine: "the happy path",
  "wrong-code": "the model reading the code",
  "ai-no-session": "the live-camera rule",
  reposted: "the duplicate-photo rule",
};

/** This round's runs that reached the photos step, as the scoreboard counts them. */
export const roundRuns = (runs: DemoRun[]): RoundRun[] => runs.flatMap((r) => (r.sample ? [{ sample: r.sample, decision: r.decision, unanswered: r.unanswered }] : []));

/**
 * Demo mode's stand-in for the camera: four case files in a 2x2 grid, the photo the hero of each, with what it tests,
 * what should happen and what its latest run this round got. The next unrun sample is selected. A plain form, no script
 * needed; on a phone "Run this sample" waits in a bar at the bottom of the screen while the cards scroll. Once the round
 * is done the cards are its record, and the one button starts a new round.
 */
export function SamplePicker({
  slug,
  options,
  selected,
  runs,
  roundDone,
  refusal,
}: {
  slug: string;
  options: SampleOption[];
  selected: string;
  /** This round's demo claims. */
  runs: DemoRun[];
  /** Every sample has run in this round. */
  roundDone: boolean;
  refusal?: Refusal | null;
}) {
  const scored = roundRuns(runs);
  // Refused by a limit: the cards stay as a record, and nothing can be run until it resets.
  const off = Boolean(refusal);
  const latest = latestRuns(scored);
  return (
    <section aria-labelledby="picker-title" className="mx-auto flex w-full max-w-[40rem] flex-col gap-6">
      {/* A limit's notice, rendered later, takes focus from the title. */}
      <FocusTitle id="picker-title" />
      <div className="flex flex-col gap-3">
        <StepTitle id="picker-title">Pick a sample claim</StepTitle>
        <p className="text-body text-muted">Each one runs the real checks and the real rule. Only the genuine claim should be paid, and only once per round.</p>
        {scored.length > 0 && <p className="font-mono text-micro text-muted">{scoreLine(scored).text}</p>}
      </div>

      {refusal && <LimitNotice refusal={refusal} demo />}

      {/* Once every sample has run, the form starts a new round instead: running one sample again in a finished round
          would only meet its own earlier claim. */}
      <form action={roundDone ? "/api/claims/round" : "/api/claims"} method="post" className="flex flex-col gap-6">
        <input type="hidden" name="recall" value={slug} />
        <fieldset disabled={off} className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <legend className="sr-only">Sample claims</legend>
          {options.map(({ sample, locked }, i) => {
            const letter = String.fromCharCode(65 + i);
            const run = latest.get(sample.id);
            return (
              <label
                key={sample.id}
                aria-disabled={locked || off ? true : undefined}
                className={clsx(
                  "group relative flex gap-4 rounded-card border border-line bg-surface p-2 sm:gap-3.5 transition-[border-color,box-shadow,background-color] duration-160 sm:p-3",
                  // Selected: a neutral ring in the text colour. The screen's one amber is "Run this sample".
                  "has-checked:border-text/70 has-checked:shadow-[0_0_0_2px_var(--bg),0_0_0_3px_var(--text)] has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-accent",
                  !roundDone && !off && "cursor-pointer hover:bg-surface-2",
                  locked && "cursor-not-allowed hover:bg-surface",
                )}
              >
                {!roundDone && <input type="radio" name="sample" value={sample.id} defaultChecked={sample.id === selected} disabled={Boolean(locked)} className="peer sr-only" />}
                {/* 96px on a phone, 112px beside the text from 640px, so all four cards and the button fit one laptop screen. */}
                <span className="relative block aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-control bg-surface-2 sm:w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sample.photos[0]} alt="" className={clsx("absolute inset-0 size-full object-cover object-[50%_65%]", locked && "opacity-50 grayscale")} />
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 left-1.5 flex size-7 items-center justify-center rounded-control bg-paper font-mono text-ui font-medium text-ink shadow-paper"
                  >
                    {letter}
                  </span>
                  {locked && (
                    <span className="absolute inset-x-1.5 top-1/2 flex -translate-y-1/2 items-center justify-center gap-1.5 rounded-control bg-[oklch(0.12_0.004_75/0.85)] px-2 py-1.5 text-ui text-[oklch(0.96_0.006_85)]">
                      <LockIcon className="shrink-0" />
                      After A
                    </span>
                  )}
                  {/* The honest label, on every sample photo at every size. */}
                  <span className="absolute inset-x-0 bottom-0 bg-[oklch(0.12_0.004_75/0.8)] py-0.5 text-center font-mono text-[10px] leading-4 tracking-[0.06em] text-[oklch(0.96_0.006_85)] uppercase">
                    AI-made
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-1.5 py-1 sm:py-0.5">
                  <span className="text-ui font-medium text-text">
                    <span className="sr-only">Sample {letter}: </span>
                    {sample.title}
                  </span>
                  <span className="font-mono text-micro text-faint">Tests: {SAMPLE_TESTS[sample.id] ?? sample.decidedBy}</span>
                  <StatusPill status={sample.expect} label={`Should be ${statusLabel(sample.expect).toLowerCase()}`} className="mt-1 self-start" />
                  {run && <RunResult sample={sample} run={run} prefix={<span className="text-ui text-faint">Got</span>} className="flex-wrap gap-y-1" />}
                  {locked && <span className="sr-only">{locked}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
        <p className="text-ui text-faint">All four photos are AI-made samples, not from a camera.</p>
        {roundDone && <p className="text-ui text-muted">All four samples have run. A new round checks them only against each other, so they reach the same four outcomes.</p>}
        <div data-action-bar="" className="z-10 max-sm:sticky max-sm:bottom-0 max-sm:mx-[calc(var(--gutter)*-1)] max-sm:border-t max-sm:border-line max-sm:bg-bg/92 max-sm:px-(--gutter) max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:backdrop-blur-md">
          <Button type="submit" size="lg" block disabled={off}>
            {refusal ? <RetryLabel refusal={refusal} /> : roundDone ? "Run the samples again" : "Run this sample"}
          </Button>
        </div>
      </form>

      {runs.length > 0 && (
        <div className="flex flex-col gap-2 pt-2">
          <h3 className="micro text-faint">Your demo claims this round</h3>
          <ul className="flex flex-col">
            {runs.map((r) => (
              <li key={r.id} className="border-b border-line last:border-b-0">
                {/* The outcome is on the sample's card above: this list is the way back to each claim. */}
                <Link href={r.href} className="flex min-h-11 items-center gap-3 text-ui hover:text-text">
                  <span className="font-mono text-faint">{r.id}</span>
                  <span className="truncate text-muted">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
          {!roundDone && (
            <form action="/api/claims/round" method="post" className="flex flex-col gap-3 pt-2">
              <input type="hidden" name="recall" value={slug} />
              <Button type="submit" variant="secondary" block>
                Start a new round
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
