import { CheckProgress, type CheckStep } from "@/components/ui";
import { EvidenceText } from "./EvidenceText";
import type { CheckRow } from "./model";

const GROUPS: Record<CheckRow["group"], string> = {
  pre: "Before the photo check",
  model: "The photo check",
  pay: "The refund",
};

/** The claim's checks in groups, each with its result and, for the model's answers, its own words in mono. */
export function CheckList({ rows, label = "Checks" }: { rows: CheckRow[]; label?: string }) {
  const groups = (Object.keys(GROUPS) as CheckRow["group"][]).map((g) => ({ g, rows: rows.filter((r) => r.group === g) })).filter((x) => x.rows.length);
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ g, rows }) => (
        <section key={g} aria-label={`${label}: ${GROUPS[g]}`}>
          <h3 className="micro border-b border-line pb-2 text-faint">{GROUPS[g]}</h3>
          <CheckProgress label={GROUPS[g]} steps={rows.map(toStep)} />
        </section>
      ))}
    </div>
  );
}

function toStep(r: CheckRow): CheckStep {
  return {
    id: r.id,
    label: r.label,
    state: r.state,
    detail:
      r.detail || r.quote ? (
        <>
          {r.detail && <EvidenceText>{r.detail}</EvidenceText>}
          {r.quote && <span className="mt-1.5 block border-l border-line-strong pl-3 text-ui text-muted">Model: &ldquo;{r.quote}&rdquo;</span>}
        </>
      ) : undefined,
  };
}
