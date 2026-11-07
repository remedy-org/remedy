import clsx from "clsx";
import styles from "./flow.module.css";

export const REAL_STEPS = ["PayPal", "Code", "Photos", "Refund"] as const;
export const DEMO_STEPS = ["PayPal", "Sample", "Code", "Refund"] as const;

export interface StepMeterProps {
  /** 1-based; past the last step means everything is done. */
  current: number;
  steps?: readonly string[];
  /** Phones on the camera step: one line, "3/4 · Photos", so the viewfinder gets the height. */
  compact?: boolean;
  className?: string;
}

/** The steps of a claim as hairline segments: done and current in text colour (the current one fills in), the rest faint. */
export function StepMeter({ current, steps = REAL_STEPS, compact, className }: StepMeterProps) {
  const at = Math.min(current, steps.length);
  const label = `Step ${at} of ${steps.length}`;
  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      {compact && (
        <p className="micro text-muted sm:hidden" aria-hidden="true">
          <span className="text-text tabular-nums">
            {at}/{steps.length}
          </span>{" "}
          · {steps[at - 1]}
        </p>
      )}
      <ol aria-label={label} className={clsx("grid gap-2", compact && "max-sm:sr-only")} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "next";
          return (
            <li key={s} aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 flex-col gap-2">
              <span className="relative h-0.5 overflow-hidden rounded-full bg-line">
                {state !== "next" && <span className={clsx("absolute inset-0 rounded-full", state === "done" ? "bg-muted" : clsx("bg-text", styles.fill))} />}
              </span>
              <span className={clsx("micro truncate", state === "current" ? "text-text" : state === "done" ? "text-muted" : "text-faint")}>
                <span className="sr-only">{state === "done" ? "Done: " : state === "current" ? "Current: " : "Next: "}</span>
                {s}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
