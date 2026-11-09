"use client";

import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { BlockIcon, CheckIcon, CrossIcon, HoldIcon, type CheckState, type CheckStep } from "@/components/ui";
import { VerdictGlyph, type Verdict } from "./VerdictMark";

// The console's check rows: the icon says the result, and a word appears only where a check didn't pass.
const word: Partial<Record<CheckState, string>> = {
  waiting: "Waiting",
  running: "Checking",
  hold: "Held",
  reject: "Failed",
  blocked: "Blocked",
  skipped: "Not run",
};

// A check's result as the grid's verdict glyph (VerdictMark), 14px on the first line's height: passed is the ring and
// check, held the pause, failed the cross, blocked the strike, not run or waiting the dashed ring.
const GLYPH: Partial<Record<CheckState, Verdict>> = { pass: "approved", hold: "held", reject: "rejected", blocked: "blocked", skipped: "pending", waiting: "pending" };

function Marker({ state, quiet, glyph }: { state: CheckState; quiet?: boolean; glyph?: boolean }) {
  const ring = "flex size-6 shrink-0 items-center justify-center rounded-full";
  if (glyph && GLYPH[state]) {
    return (
      <span className="flex h-5 shrink-0 items-center">
        <VerdictGlyph verdict={GLYPH[state]!} />
      </span>
    );
  }
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
    case "running":
      // The step happening now: a ring whose brass arc turns once every 1.2 s (still under reduced motion), so a wait
      // of seconds never reads as a frozen screen.
      return <span aria-hidden="true" className={clsx(ring, "border-2 border-line border-t-accent motion-safe:animate-spin motion-safe:[animation-duration:1.2s]")} />;
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
  glyphs,
  className,
}: {
  steps: CheckStep[];
  label: string;
  words?: Partial<Record<CheckState, string>>;
  // Step ids drawn without colour when they didn't finish (quiet markers).
  quiet?: string[];
  // The verdict glyphs (14px, VerdictMark) in place of the tinted badges: the claim panel's checks, as the grid marks them.
  glyphs?: boolean;
  className?: string;
}) {
  return (
    <ol aria-label={label} className={clsx("flex flex-col", className)}>
      {steps.map((s) => (
        <li key={s.id} className={clsx("flex border-b border-line py-3 last:border-b-0", glyphs ? "gap-2.5" : "gap-3")}>
          <Marker state={s.state} quiet={quiet?.includes(s.id)} glyph={glyphs} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className={clsx("text-ui font-medium", s.state === "waiting" ? "text-faint" : "text-text")}>{s.label}</span>
              {(words?.[s.state] ?? word[s.state]) ? (
                <span className="shrink-0 text-micro text-muted">
                  {words?.[s.state] ?? word[s.state]}
                  {s.state === "running" && <Elapsed key={s.id} />}
                </span>
              ) : (
                <span className="sr-only">Passed</span>
              )}
            </div>
            {s.detail && <Detail>{s.detail}</Detail>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The seconds a running step has taken, from 1 s: "· 8 s", the figure in mono and the unit in the sans, as the console
 * prints a span. Out of the accessibility tree: a clock read out every second is noise. */
function Elapsed() {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSec((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!sec) return null;
  return (
    <span aria-hidden="true">
      {" · "}
      <span className="font-mono tabular-nums">{sec}</span>
      <span className="text-faint">{"\u202f"}s</span>
    </span>
  );
}

function Detail({ children }: { children: ReactNode }) {
  return <div className="mt-1 text-ui text-muted">{children}</div>;
}
