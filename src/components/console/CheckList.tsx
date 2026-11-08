import clsx from "clsx";
import type { ReactNode } from "react";
import { BlockIcon, CheckIcon, CrossIcon, HoldIcon, type CheckState, type CheckStep } from "@/components/ui";

// The console's check rows: the icon says the result, and a word appears only where a check didn't pass.
const word: Partial<Record<CheckState, string>> = {
  waiting: "Waiting",
  running: "Checking",
  hold: "Held",
  reject: "Failed",
  blocked: "Blocked",
  skipped: "Not run",
};

function Marker({ state, quiet }: { state: CheckState; quiet?: boolean }) {
  const ring = "flex size-6 shrink-0 items-center justify-center rounded-full";
  // A step that didn't finish (an import's draft), not a check that failed: a neutral cross, no colour.
  if (quiet && (state === "reject" || state === "hold")) {
    return (
      <span className={clsx(ring, "bg-surface-2 text-muted")}>
        <CrossIcon size={14} />
      </span>
    );
  }
  switch (state) {
    case "pass":
      return (
        <span className={clsx(ring, "bg-pay-soft text-pay")}>
          <CheckIcon size={14} />
        </span>
      );
    case "hold":
      return (
        <span className={clsx(ring, "bg-hold-soft text-hold")}>
          <HoldIcon size={14} />
        </span>
      );
    case "reject":
      return (
        <span className={clsx(ring, "bg-stop-soft text-stop")}>
          <CrossIcon size={14} />
        </span>
      );
    case "blocked":
      return (
        <span className={clsx(ring, "bg-stop-soft text-stop")}>
          <BlockIcon size={14} />
        </span>
      );
    case "skipped":
      return (
        <span className={clsx(ring, "border border-dashed border-line-strong")}>
          <span className="h-px w-2 bg-muted" />
        </span>
      );
    default:
      return <span className={clsx(ring, "border border-line-strong")} />;
  }
}

/** One row per check: its icon, its name, a word only for an exception, and what it found when there is something to
 * say. The result is also in each row's accessible name, so the icon never carries it alone. */
export function CheckList({
  steps,
  label,
  words,
  quiet,
  className,
}: {
  steps: CheckStep[];
  label: string;
  words?: Partial<Record<CheckState, string>>;
  // Step ids drawn without colour when they didn't finish (quiet markers).
  quiet?: string[];
  className?: string;
}) {
  return (
    <ol aria-label={label} className={clsx("flex flex-col", className)}>
      {steps.map((s) => (
        <li key={s.id} className="flex gap-3 border-b border-line py-3 last:border-b-0">
          <Marker state={s.state} quiet={quiet?.includes(s.id)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className={clsx("text-ui font-medium", s.state === "waiting" ? "text-faint" : "text-text")}>{s.label}</span>
              {(words?.[s.state] ?? word[s.state]) ? <span className="shrink-0 text-micro text-muted">{words?.[s.state] ?? word[s.state]}</span> : <span className="sr-only">Passed</span>}
            </div>
            {s.detail && <Detail>{s.detail}</Detail>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Detail({ children }: { children: ReactNode }) {
  return <div className="mt-1 text-ui text-muted">{children}</div>;
}
