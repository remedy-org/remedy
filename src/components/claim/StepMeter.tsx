import clsx from "clsx";

export const REAL_STEPS = ["PayPal", "Code", "Photos", "Refund"] as const;
export const DEMO_STEPS = ["PayPal", "Sample", "Code", "Refund"] as const;

export interface StepMeterProps {
  /** 1-based; past the last step means everything is done. */
  current: number;
  steps?: readonly string[];
  className?: string;
}

/** The four steps of a claim as hairline segments: done and current in text colour, the rest faint. */
export function StepMeter({ current, steps = REAL_STEPS, className }: StepMeterProps) {
  return (
    <ol aria-label={`Step ${Math.min(current, steps.length)} of ${steps.length}`} className={clsx("grid gap-2", className)} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "next";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 flex-col gap-2">
            <span className={clsx("h-0.5 rounded-full", state === "next" ? "bg-line" : state === "done" ? "bg-muted" : "bg-text")} />
            <span className={clsx("micro truncate", state === "current" ? "text-text" : state === "done" ? "text-muted" : "text-faint")}>
              <span className="sr-only">{state === "done" ? "Done: " : state === "current" ? "Current: " : "Next: "}</span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
