import clsx from "clsx";
import type { Decision } from "@/lib/types";
import styles from "./flow.module.css";

export const REAL_STEPS = ["PayPal", "Code", "Photo", "Refund"] as const;
export const DEMO_STEPS = ["PayPal", "Claim", "Photo", "Refund"] as const;

/** How the last step ended: held for a person (waiting), or refused (stopped). Paid is simply every step done. */
export type StepOutcome = "waiting" | "stopped";

export interface StepMeterProps {
  /** 1-based; past the last step means everything is done. */
  current: number;
  steps?: readonly string[];
  /** The current step didn't finish as a step does: its bar shows in the held or refused colour. */
  outcome?: StepOutcome;
  /** The current step is next but hasn't opened yet (logged in on the recall screen): shown as next. */
  upcoming?: boolean;
  /** Phones on the camera step: hidden (still read out), so the camera gets the whole screen. Short screens always hide it. */
  compact?: boolean;
}

// What a screen reader hears for an ended step; the bar's colour is its only mark on screen, and the headline says it.
const OUTCOME = { waiting: { sr: "Waiting for a person: ", bar: "bg-hold" }, stopped: { sr: "Stopped: ", bar: "bg-stop" } };

/** The meter for a claim's result: every step done when paid; held waits on the refund, refused stops there. */
export function resultMeter(decision: Decision, steps: readonly string[]): Pick<StepMeterProps, "current" | "outcome"> {
  if (decision === "paid") return { current: steps.length + 1 };
  return { current: steps.length, outcome: decision === "held" ? "waiting" : "stopped" };
}

/**
 * The steps of a claim as hairline segments with their names under them: done in muted, the current one filled in
 * text colour, the rest faint. It fills its frame, so its edges sit on the content's.
 */
export function StepMeter({ current, steps = REAL_STEPS, outcome, upcoming, compact }: StepMeterProps) {
  const at = Math.min(current, steps.length);
  const end = outcome ? OUTCOME[outcome] : null;
  return (
    <ol
      aria-label={`Step ${at} of ${steps.length}`}
      // A short screen (a laptop at 200% zoom) gives the step its height: the meter is read out, not shown.
      className={clsx("grid w-full gap-2 [@media(max-height:600px)]:sr-only", compact && "max-sm:sr-only")}
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
  );
}
