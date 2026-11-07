import clsx from "clsx";
import type { Decision } from "@/lib/types";
import styles from "./flow.module.css";

export const REAL_STEPS = ["PayPal", "Code", "Photos", "Refund"] as const;
export const DEMO_STEPS = ["PayPal", "Sample", "Photo", "Refund"] as const;

/** How the last step ended: held for a person (waiting), or refused (stopped). Paid is simply every step done. */
export type StepOutcome = "waiting" | "stopped";

export interface StepMeterProps {
  /** 1-based; past the last step means everything is done. */
  current: number;
  steps?: readonly string[];
  /** The current step didn't finish as a step does: it shows in the held or refused colour, with its word. */
  outcome?: StepOutcome;
  /** Phones on the camera step: hidden (still read out), so the camera gets the whole screen; it shows its own chip. */
  compact?: boolean;
  /** The recall screen: the meter spans its two columns instead of the centred 640px frame. */
  span?: boolean;
  /** The step's content width, when it isn't 640px (the checks' 960px, a result's 480px): the meter shares its edges. */
  width?: string;
}

// The word the step takes in place of its name, so the outcome is never shown by colour alone.
const OUTCOME = { waiting: { word: "Held", sr: "Waiting: ", bar: "bg-hold", text: "text-hold" }, stopped: { word: "Not paid", sr: "Stopped: ", bar: "bg-stop", text: "text-stop" } };

/** The meter for a claim's result: every step done when paid; held waits on the refund, refused stops there. */
export function resultMeter(decision: Decision, steps: readonly string[]): Pick<StepMeterProps, "current" | "outcome"> {
  if (decision === "paid") return { current: steps.length + 1 };
  return { current: steps.length, outcome: decision === "held" ? "waiting" : "stopped" };
}

/**
 * The steps of a claim as hairline segments: done and current in text colour (the current one fills in), the rest
 * faint. From 640px a quiet mono counter, "2/4", leads them. Centred, on the step's own column (640px unless `width`
 * says otherwise), so its edges always sit on the content's; the recall screen's two columns it spans.
 */
export function StepMeter({ current, steps = REAL_STEPS, outcome, compact, span, width = "max-w-[40rem]" }: StepMeterProps) {
  const at = Math.min(current, steps.length);
  const label = `Step ${at} of ${steps.length}`;
  const end = outcome ? OUTCOME[outcome] : null;
  return (
    <div className={clsx("mx-auto flex w-full items-end gap-4", !span && width, compact && "max-sm:sr-only")}>
      <span aria-hidden="true" className="micro w-7 shrink-0 text-faint tabular-nums max-sm:hidden">
        <span className="text-text">{at}</span>/{steps.length}
      </span>
      <ol aria-label={label} className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "next";
          const ended = state === "current" ? end : null;
          return (
            <li key={s} aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 flex-col gap-2">
              <span className="relative h-0.5 overflow-hidden rounded-full bg-line">
                {state !== "next" && (
                  <span className={clsx("absolute inset-0 rounded-full", state === "done" ? "bg-muted" : ended ? ended.bar : clsx("bg-text", styles.fill))} />
                )}
              </span>
              <span className={clsx("micro truncate", ended ? ended.text : state === "current" ? "text-text" : state === "done" ? "text-muted" : "text-faint")}>
                <span className="sr-only">{ended ? ended.sr : state === "done" ? "Done: " : state === "current" ? "Current: " : "Next: "}</span>
                {ended ? (
                  <>
                    <span className="sr-only">{s}, </span>
                    {ended.word}
                  </>
                ) : (
                  s
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
