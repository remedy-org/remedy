import clsx from "clsx";
import type { CSSProperties } from "react";
import { CheckProgress, type CheckStep } from "@/components/ui";
import { EvidenceText } from "./EvidenceText";
import styles from "./flow.module.css";
import type { CheckRow } from "./model";

const GROUPS: Record<CheckRow["group"], string> = {
  pre: "Before the photo check · no AI",
  model: "The photo check · the model reads",
  pay: "The refund",
};

/**
 * The claim's checks in groups, each with its result and, for the model's answers, its own words in mono. `times` puts
 * each group's time since the photos arrived in its header (the checking screen's timeline); `quoteClassName` lets that
 * screen hide the inline quotes where it shows them under the photo instead.
 */
export function CheckList({
  rows,
  label = "Checks",
  code,
  times,
  quoteClassName,
}: {
  rows: CheckRow[];
  label?: string;
  code?: string;
  times?: Partial<Record<CheckRow["group"], string>>;
  quoteClassName?: string;
}) {
  const groups = (Object.keys(GROUPS) as CheckRow["group"][]).map((g) => ({ g, rows: rows.filter((r) => r.group === g) })).filter((x) => x.rows.length);
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ g, rows }) => (
        <section key={g} aria-label={`${label}: ${GROUPS[g]}`}>
          <h3 className="micro flex items-baseline justify-between gap-3 border-b border-line pb-2 text-faint">
            <span>{GROUPS[g]}</span>
            {times?.[g] && <span className="shrink-0 normal-case">{times[g]}</span>}
          </h3>
          <CheckProgress label={GROUPS[g]} steps={rows.map((r) => toStep(r, code, quoteClassName))} />
        </section>
      ))}
    </div>
  );
}

/** The code's characters in cells that turn to the paid colour, one after another, once the model has read them. */
export function CodeCells({ code, passed }: { code: string; passed: boolean }) {
  return (
    <span className="flex gap-1.5" aria-hidden="true">
      {code.split("").map((c, i) => (
        <span
          key={i}
          style={{ "--flip-delay": `${i * 60}ms` } as CSSProperties}
          className={clsx(
            "flex h-10 w-8 items-center justify-center rounded-control border font-mono text-body font-medium",
            styles.flip,
            passed ? "border-pay/60 bg-pay-soft text-pay" : "border-line-strong text-muted",
          )}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

function toStep(r: CheckRow, code?: string, quoteClassName?: string): CheckStep {
  const cells = code && r.id === "code" && (r.state === "pass" || r.state === "running" || r.state === "waiting");
  const detail =
    r.detail || r.quote || cells ? (
      <>
        {cells && (
          <span className="my-1.5 block">
            <CodeCells code={code} passed={r.state === "pass"} />
          </span>
        )}
        {r.detail && <EvidenceText>{r.detail}</EvidenceText>}
        {r.quote && <span className={clsx("mt-1.5 block border-l border-line-strong pl-3 text-ui leading-[1.55] text-muted", styles.rise, quoteClassName)}>&ldquo;{r.quote}&rdquo;</span>}
      </>
    ) : undefined;
  return { id: r.id, label: r.label, state: r.state, detail };
}
