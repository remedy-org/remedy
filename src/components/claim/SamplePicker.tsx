import clsx from "clsx";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import { SAMPLE_COPY, sampleTitle } from "@/lib/demo/sampleCopy";
import type { Refusal } from "@/lib/limits";
import type { Decision } from "@/lib/types";
import { photoWidth, STEP_GRID, StepTitle } from "./Exhibit";
import { FocusTitle } from "./FocusTitle";
import { LimitNextStep, LimitNotice } from "./LimitNotice";
import { latestRuns, type RoundRun } from "./Scoreboard";

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

// A refusal here is the product working, not an error: muted. Only a payout is green. The title already says what the
// claim was, so the outcome is one word.
function outcomeOf(decision: Decision | undefined): { word: string; tone: string } | null {
  if (decision === "paid") return { word: "Paid", tone: "text-pay" };
  if (decision === "held") return { word: "With a person", tone: "text-hold" };
  if (decision === "rejected" || decision === "blocked") return { word: "Refused", tone: "text-muted" };
  return null;
}

// The selected claim's photo, large, beside the list: pure CSS, so the form still needs no script. Spelled out per
// claim so Tailwind finds the classes.
const SHOWN: Record<string, string> = {
  genuine: "group-has-[input[value=genuine]:checked]/picker:block",
  "wrong-code": "group-has-[input[value=wrong-code]:checked]/picker:block",
  "ai-no-session": "group-has-[input[value=ai-no-session]:checked]/picker:block",
  reposted: "group-has-[input[value=reposted]:checked]/picker:block",
};

/**
 * The demo's stand-in for the camera: four claims in a list, each a photo, what it is and what happens to it. The next
 * one not yet run is selected. A plain form, no script needed; on a phone the button waits at the foot of the screen.
 * Once all four have run, the list is the round's record and the button starts over.
 */
export function SamplePicker({
  slug,
  company,
  options,
  selected,
  runs,
  roundDone,
  refusal,
}: {
  slug: string;
  /** "Kikea Store": once all four have run, their claims can be seen as the company sees them. */
  company: string;
  options: SampleOption[];
  selected: string;
  /** This round's demo claims. */
  runs: DemoRun[];
  /** Every claim has run in this round. */
  roundDone: boolean;
  refusal?: Refusal | null;
}) {
  const scored = roundRuns(runs);
  // Refused by a limit: the list stays as a record, and nothing can run until it resets.
  const off = Boolean(refusal);
  const latest = latestRuns(scored);
  // Once all four have run, each row is the record of its claim and opens its result.
  const resultOf = (sample: string) => runs.find((r) => r.sample === sample);
  if (roundDone) return <RoundDone slug={slug} company={company} options={options} latest={latest} resultOf={resultOf} />;
  return (
    // The step grid: the chosen claim's photo on the left, where the camera and the checks will keep it; the list and
    // the button on the right.
    <section aria-labelledby="picker-title" className={clsx(STEP_GRID, "group/picker")}>
      <div aria-hidden="true" className="sticky top-8 max-lg:hidden">
        {options.map(({ sample }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={sample.id}
            src={sample.photos[0]}
            alt=""
            style={{ aspectRatio: 2 / 3, width: photoWidth(2 / 3) }}
            className={clsx("hidden h-auto rounded-card bg-surface-2 object-cover ring-1 ring-line", SHOWN[sample.id])}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
      {/* A limit's notice, rendered later, takes focus from the title. */}
      <FocusTitle id="picker-title" />
      <StepTitle id="picker-title">Choose a claim</StepTitle>

      {refusal && <LimitNotice refusal={refusal} demo />}

      <form action="/api/claims" method="post" className="flex flex-col gap-5">
        <input type="hidden" name="recall" value={slug} />
        <fieldset disabled={off} className="-mx-3 flex flex-col gap-1">
          <legend className="sr-only">Claims to run</legend>
          {options.map(({ sample, locked }) => {
            const run = latest.get(sample.id);
            const outcome = outcomeOf(run?.decision);
            const runId = resultOf(sample.id)?.id;
            const copy = SAMPLE_COPY[sample.id];
            const id = `sample-${sample.id}`;
            return (
              <label
                key={sample.id}
                aria-disabled={locked || off ? true : undefined}
                className={clsx(
                  "group relative flex items-center gap-4 rounded-control px-3 py-3 transition-colors duration-160",
                  // Selected: a 1px ink ring, never an outline, which is focus's alone. The screen's one amber is the button.
                  !off && "has-checked:ring-1 has-checked:ring-text",
                  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
                  !off && !locked && "cursor-pointer hover:bg-surface",
                  locked && "cursor-not-allowed",
                  off && "opacity-60",
                )}
              >
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.photos[0]}
                  alt=""
                  aria-hidden="true"
                  className={clsx("size-16 shrink-0 rounded-control bg-surface-2 object-cover object-[50%_65%] ring-1 ring-line", locked && "opacity-50")}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span id={`${id}-title`} className={clsx("text-body font-medium", locked ? "text-muted" : "text-text")}>
                    {copy?.title ?? sample.title}
                  </span>
                  <span id={`${id}-line`} className="text-ui text-muted">
                    {locked ? <span id={`${id}-locked`}>Send the genuine claim first: this one sends its photo again.</span> : (copy?.line ?? sample.decidedBy)}
                  </span>
                  {/* The outcome reads as the row's last line, so the title never squeezes beside it. */}
                  {outcome && (
                    <span className="text-ui">
                      <span className={clsx("font-medium", outcome.tone)}>{outcome.word}</span>
                      {runId && <span className="text-faint"> · <span className="font-mono">{runId}</span></span>}
                    </span>
                  )}
                </span>
                {!off && (
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
        <div
          data-action-bar=""
          className="z-10 max-sm:sticky max-sm:bottom-0 max-sm:mx-[calc(var(--gutter)*-1)] max-sm:border-t max-sm:border-line max-sm:bg-bg max-sm:px-(--gutter) max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {/* Refused by a limit, nothing can run until it resets: the console, where the claims are, takes the button. */}
          {off ? (
            <LimitNextStep demo />
          ) : (
            <Button type="submit" size="lg" block>
              Start this claim
            </Button>
          )}
        </div>
      </form>

      {scored.length > 0 && (
        <form action="/api/claims/round" method="post">
          <input type="hidden" name="recall" value={slug} />
          <Button type="submit" variant="tertiary" size="sm">
            Start over
          </Button>
        </form>
      )}
      </div>
    </section>
  );
}

/** The round's record once all four have run: the outcome said once, then each claim with its number, opening its result. */
function RoundDone({ slug, company, options, latest, resultOf }: { slug: string; company: string; options: SampleOption[]; latest: Map<string, RoundRun>; resultOf(sample: string): DemoRun | undefined }) {
  // The four claims' ids, so the company's console opens on them.
  const first = options.map(({ sample }) => resultOf(sample.id)).find(Boolean);
  const decided = (id: string) => latest.get(id)?.decision;
  const fakes = options.filter(({ sample }) => sample.id !== "genuine");
  // Said only when it is what happened: a genuine claim held for a person, say, keeps the plain title.
  const clean = decided("genuine") === "paid" && fakes.every(({ sample }) => decided(sample.id) === "rejected" || decided(sample.id) === "blocked");
  return (
    <section aria-labelledby="picker-title" className="flex w-full flex-col gap-8">
      <FocusTitle id="picker-title" />
      <div className="flex max-w-[34rem] flex-col gap-3">
        <StepTitle id="picker-title">{clean ? "Remedy paid the genuine claim and stopped all three fakes" : "All four claims ran"}</StepTitle>
        <p className="text-body text-pretty text-muted">Open any of them to see why. The company sees the same four, with their evidence, in its console.</p>
      </div>
      <ul className="flex flex-col border-t border-line">
        {options.map(({ sample }) => {
          const run = resultOf(sample.id);
          const outcome = outcomeOf(decided(sample.id));
          const row = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sample.photos[0]} alt="" className="size-12 shrink-0 rounded-control bg-surface-2 object-cover object-[50%_65%] ring-1 ring-line" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body text-text">{sampleTitle(sample.id, sample.title)}</span>
                {run && <span className="font-mono text-ui text-faint">{run.id}</span>}
              </span>
              {outcome && <span className={clsx("shrink-0 text-ui font-medium", outcome.tone)}>{outcome.word}</span>}
              {run && (
                <span aria-hidden="true" className="shrink-0 text-faint transition-transform duration-160 group-hover:translate-x-0.5">
                  →
                </span>
              )}
            </>
          );
          return (
            <li key={sample.id} className="border-b border-line">
              {run ? (
                <Link href={run.href} className="group -mx-3 flex items-center gap-4 rounded-control px-3 py-3 transition-colors duration-160 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus">
                  {row}
                </Link>
              ) : (
                <span className="flex items-center gap-4 py-3">{row}</span>
              )}
            </li>
          );
        })}
      </ul>
      {/* The next thing worth seeing is the company's side of the same four claims; starting over is the quiet way back. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
        <Button href={first ? `/console?claim=${first.id}` : "/console"} size="lg" prefetch={false} className="max-sm:w-full">
          See these claims as {company}
        </Button>
        <form action="/api/claims/round" method="post">
          <input type="hidden" name="recall" value={slug} />
          <Button type="submit" variant="tertiary" size="md">
            Start over
          </Button>
        </form>
      </div>
    </section>
  );
}
