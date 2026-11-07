import clsx from "clsx";
import type { ReactNode } from "react";
import { BlockIcon, CheckIcon, CrossIcon, HoldIcon } from "./icons";

export type CheckState = "waiting" | "running" | "pass" | "hold" | "reject" | "blocked" | "skipped";

export interface CheckStep {
  /** Stable key, e.g. "session" or "code". */
  id: string;
  /** What is checked: "Live camera session". */
  label: ReactNode;
  state: CheckState;
  /** The result in a sentence, or the model's quoted evidence (shown in mono when `evidence` is true). */
  detail?: ReactNode;
  evidence?: boolean;
}

const word: Record<CheckState, string> = {
  waiting: "Waiting",
  running: "Checking",
  pass: "Passed",
  hold: "Held",
  reject: "Failed",
  blocked: "Blocked",
  skipped: "Not run",
};

function Marker({ state }: { state: CheckState }) {
  const ring = "flex size-6 shrink-0 items-center justify-center rounded-full";
  switch (state) {
    case "pass":
      return <span className={clsx(ring, "bg-pay-soft text-pay")}><CheckIcon size={14} /></span>;
    case "hold":
      return <span className={clsx(ring, "bg-hold-soft text-hold")}><HoldIcon size={14} /></span>;
    case "reject":
      return <span className={clsx(ring, "bg-stop-soft text-stop")}><CrossIcon size={14} /></span>;
    case "blocked":
      return <span className={clsx(ring, "bg-stop-soft text-stop")}><BlockIcon size={14} /></span>;
    case "running":
      return <span className={clsx(ring, "border border-line-strong")}><span className="size-1.5 rounded-full bg-text" /></span>;
    case "skipped":
      return <span className={clsx(ring, "border border-dashed border-line-strong")}><span className="h-px w-2 bg-muted" /></span>;
    default:
      return <span className={clsx(ring, "border border-line-strong")} />;
  }
}

export interface CheckProgressProps {
  steps: CheckStep[];
  /** Accessible name for the list, e.g. "Checks for claim RM-0412". */
  label?: string;
  className?: string;
}

/**
 * The checks as they resolve, one row each: no spinner. A running row shows a thin sliding bar under it.
 * Wrap updates in a polite live region (this list is one) so screen readers hear each result.
 */
export function CheckProgress({ steps, label = "Checks", className }: CheckProgressProps) {
  return (
    <ol aria-label={label} aria-live="polite" className={clsx("flex flex-col", className)}>
      {steps.map((s) => (
        <li key={s.id} className="relative flex gap-3 border-b border-line py-3 last:border-b-0">
          <Marker state={s.state} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className={clsx("text-ui font-medium", s.state === "waiting" ? "text-faint" : "text-text")}>{s.label}</span>
              {/* The check running now is the one amber label on the list (DESIGN.md: the active state). */}
              <span className={clsx("micro shrink-0", s.state === "running" ? "text-accent-text" : "text-faint")}>{word[s.state]}</span>
            </div>
            {s.detail && <p className={clsx("mt-1 text-ui text-muted", s.evidence && "leading-[1.55]")}>{s.detail}</p>}
          </div>
          {s.state === "running" && (
            <span className="absolute inset-x-0 bottom-0 h-px overflow-hidden" aria-hidden="true">
              <span className="block h-full w-2/5 bg-text/50 animate-[progress-slide_1.2s_var(--ease-snap)_infinite]" />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export interface MeterProps {
  value: number;
  max: number;
  /** Accessible name: "Units remedied of units sold". */
  label: string;
  /** Visible text beside the bar, e.g. "41 of 19,596". Defaults to none. */
  valueText?: string;
  tone?: "accent" | "pay";
  className?: string;
}

/** A determinate hairline meter (remedied against sold). Always shows at least a sliver once value > 0. */
export function Meter({ value, max, label, valueText, tone = "pay", className }: MeterProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2"
      >
        <div className={clsx("h-full rounded-full", tone === "pay" ? "bg-pay" : "bg-accent")} style={{ width: value > 0 ? `max(${pct}%, 2px)` : 0 }} />
      </div>
      {valueText && <span className="shrink-0 font-mono text-micro text-muted tabular-nums">{valueText}</span>}
    </div>
  );
}
