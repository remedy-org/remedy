"use client";

import { useCallback, useMemo } from "react";
import type { IDoesFilterPassParams } from "ag-grid-community";
import { useGridFilter, type CustomFilterProps } from "ag-grid-react";
import type { Decision } from "@/lib/types";
import type { GridContext, GridRow } from "./cells";

/** The Verdict column's filter: decisions and the reasons behind them. The status tabs set the same model, so the tabs
 * and the column's filter are one filter. */
export interface DecisionModel {
  decisions: Decision[];
  reasons: string[];
}

export const DECISION_WORDS: [Decision, string][] = [
  ["paid", "Approved"],
  ["held", "Held"],
  ["rejected", "Rejected"],
  ["blocked", "Blocked"],
  ["pending", "In progress"],
];

/** The reason a row is filtered by: the verdict's line, as the grid shows it. */
export const reasonKey = (r: Pick<GridRow, "note" | "reason">) => r.note ?? r.reason;

/** Whether a row passes: group rows always do (the grid hides a group with nothing left in it). */
export function passesDecision(model: DecisionModel | null | undefined, row: GridRow | undefined): boolean {
  if (!model || !row || row.group) return true;
  if (model.decisions.length && !model.decisions.includes(row.decision)) return false;
  return !model.reasons.length || model.reasons.includes(reasonKey(row));
}

const empty = (m: DecisionModel) => !m.decisions.length && !m.reasons.length;

export function DecisionFilter({ model, onModelChange, api }: CustomFilterProps<GridRow, GridContext, DecisionModel>) {
  const doesFilterPass = useCallback((p: IDoesFilterPassParams<GridRow>) => passesDecision(model, p.data), [model]);
  useGridFilter({ doesFilterPass });

  // Every reason on the recall, most common first, with how many claims give it.
  const reasons = useMemo(() => {
    const n = new Map<string, number>();
    api.forEachNode((node) => {
      if (!node.data || node.data.group) return;
      const k = reasonKey(node.data);
      n.set(k, (n.get(k) ?? 0) + 1);
    });
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [api]);

  const current = model ?? { decisions: [], reasons: [] };
  const toggle = (key: "decisions" | "reasons", value: string) => {
    const list = current[key] as string[];
    const next = { ...current, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } as DecisionModel;
    onModelChange(empty(next) ? null : next);
  };

  return (
    <div className="flex w-[300px] flex-col py-2 text-ui text-text-2">
      <fieldset className="px-3">
        <legend className="py-1 text-micro text-faint">Decision</legend>
        {DECISION_WORDS.map(([d, word]) => (
          <Check key={d} checked={current.decisions.includes(d)} onChange={() => toggle("decisions", d)} label={word} />
        ))}
      </fieldset>
      <fieldset className="mt-2 border-t border-line px-3 pt-2">
        <legend className="sr-only">Reason</legend>
        <p aria-hidden="true" className="py-1 text-micro text-faint">
          Reason
        </p>
        <div className="max-h-56 overflow-y-auto">
          {reasons.map(([r, n]) => (
            <Check key={r} checked={current.reasons.includes(r)} onChange={() => toggle("reasons", r)} label={r} count={n} />
          ))}
        </div>
      </fieldset>
      {model && (
        <div className="mt-2 flex justify-end border-t border-line px-3 pt-2">
          <button type="button" onClick={() => onModelChange(null)} className="inline-flex min-h-8 items-center rounded-control px-2 text-muted hover:text-text">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function Check({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-control hover:text-text">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-3.5 shrink-0 accent-[var(--text)]" />
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      {count !== undefined && <span className="shrink-0 font-mono text-micro text-faint tabular-nums">{count}</span>}
    </label>
  );
}
