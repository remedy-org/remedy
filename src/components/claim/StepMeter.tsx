import clsx from "clsx";
import type { Decision } from "@/lib/types";
import styles from "./flow.module.css";

// One set of names for a real claim and a demo one: the code is the claim's, and a demo claim is chosen with its code.
export const REAL_STEPS = ["PayPal", "Claim", "Photo", "Refund"] as const;
export const DEMO_STEPS = REAL_STEPS;

/** How the last step ended: paid (done, in the paid colour), held for a person (waiting), or refused (stopped). */
export type StepOutcome = "paid" | "waiting" | "stopped";

export interface StepMeterProps {
  /** 1-based; past the last step means everything is done. */
  current: number;
  steps?: readonly string[];
  /** The current step didn't finish as a step does: its bar shows in the held or refused colour. */
  outcome?: StepOutcome;
  /** The current step is next but hasn't opened yet (logged in on the recall screen): shown as next. */
  upcoming?: boolean;
  /** Phones on the camera step: hidden (still read out), so the camera gets the whole screen. */
  compact?: boolean;
}

// What a screen reader hears for an ended step; the bar's colour is its only mark on screen, and the headline says it.
const OUTCOME = { paid: { sr: "Done: ", bar: "bg-pay" }, waiting: { sr: "Waiting for a person: ", bar: "bg-hold" }, stopped: { sr: "Stopped: ", bar: "bg-stop" } };

/** The meter for a claim's result: the refund ends paid, held (waiting on a person) or refused (stopped). */
export function resultMeter(decision: Decision, steps: readonly string[]): Pick<StepMeterProps, "current" | "outcome"> {
  return { current: steps.length, outcome: decision === "paid" ? "paid" : decision === "held" ? "waiting" : "stopped" };
}

/**
 * The steps of a claim as hairline segments with their names under them: done in muted, the current one filled in
 * text colour, the rest faint. It fills its frame, so its edges sit on the content's.
 */
export function StepMeter({ current, steps = REAL_STEPS, outcome, upcoming, compact }: StepMeterProps) {
  const at = Math.min(current, steps.length);
  const end = outcome ? OUTCOME[outcome] : null;
  return (
    <>
      {/* A short screen (a laptop at 200% zoom): one muted line in the meter's place, so the step is still on screen. */}
      <p className={clsx("hidden text-ui text-muted [@media(max-height:600px)]:block", compact && "max-sm:sr-only")}>
        Step {at} of {steps.length} · {steps[at - 1]}
      </p>
      <ol
        aria-label={`Step ${at} of ${steps.length}`}
        className={clsx("grid w-full gap-2 [@media(max-height:600px)]:hidden", compact && "max-sm:sr-only")}
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((s, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current && !upcoming ? "current" : "next";
          const ended = state === "current" ? end : null;
          return (
            <li key={s} aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 flex-col gap-2">
              <span className="relative h-0.5 overflow-hidden rounded-full bg-line">
                {state !== "next" && <span className={clsx("absolute inset-0 rounded-full", state === "done" ? "bg-muted" : ended ? ended.bar : clsx("bg-text", styles.fill))} />}
              </span>
              <span className={clsx("truncate text-ui font-medium", state === "current" ? "text-text" : state === "done" ? "text-muted" : "text-faint")}>
                <span className="sr-only">{ended ? ended.sr : state === "done" ? "Done: " : state === "current" ? "Current: " : "Next: "}</span>
                {s}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
