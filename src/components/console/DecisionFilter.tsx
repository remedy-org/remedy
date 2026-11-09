"use client";

import { useMemo, type ReactNode } from "react";
import type { DoesFilterPassParams, GridApi } from "ag-grid-community";
import type { CustomFilterDisplayProps } from "ag-grid-react";
import { refusalLabel } from "@/app/console/_lib/view";
import type { GridContext, GridRow } from "./cells";
import { formatDate, formatCount } from "./format";
import { verdictOf, verdictWord, type Verdict } from "./VerdictMark";

// The grid's two faceted filters, as filter handlers (ClaimsGrid sets enableFilterHandlers): the grid runs
// doesFilterPass from the first filter change, so a status tab filters on its first click, before anyone has opened
// the column's menu. The components below only draw the menus.

/** The Verdict column's filter: verdicts (Paid, Sent, settling and Approved apart) and the reasons behind them. The
 * status tabs set the same model, so the tabs and the column's filter are one filter. */
export interface DecisionModel {
  decisions: Verdict[];
  reasons: string[];
}

/** The Claim column's filter: the code on the tag, and the day the claim was filed (UTC). */
export interface ClaimModel {
  codes: string[];
  days: string[];
}

export const DECISION_WORDS: [Verdict, string][] = (["paid", "settling", "approved", "held", "rejected", "blocked", "pending"] as const).map((v) => [v, verdictWord(v)]);

/** The verdict's line, as the grid shows it. */
export const reasonKey = (r: Pick<GridRow, "note" | "reason">) => r.note ?? r.reason;

/**
 * The reason a claim is filtered and grouped by: a refused claim's category, in the words Insights and the CPSC report
 * use ("Wrong or missing code on the tag"), so "every code mismatch" is one choice; any other claim's line as it reads.
 * The cell keeps the specific sentence.
 */
export function reasonGroup(r: Pick<GridRow, "decision" | "note" | "reason" | "bars">): string {
  if (r.decision !== "rejected" && r.decision !== "blocked") return reasonKey(r);
  const failed = r.bars?.find((b) => b.state === "reject");
  return failed ? refusalLabel(failed.id) : r.decision === "rejected" ? refusalLabel("review") : reasonKey(r);
}

/** Whether a row passes: group rows always do (the grid hides a group with nothing left in it). */
export function passesDecision(model: DecisionModel | null | undefined, row: GridRow | undefined): boolean {
  if (!model || !row || row.group) return true;
  if (model.decisions.length && !model.decisions.includes(verdictOf(row))) return false;
  return !model.reasons.length || model.reasons.includes(reasonGroup(row));
}

export const dayOf = (r: Pick<GridRow, "createdAt">) => r.createdAt.slice(0, 10);

export function passesClaim(model: ClaimModel | null | undefined, row: GridRow | undefined): boolean {
  if (!model || !row || row.group) return true;
  if (model.codes.length && !model.codes.includes(row.code ?? "")) return false;
  return !model.days.length || model.days.includes(dayOf(row));
}

export const decisionFilterPass = (p: DoesFilterPassParams<GridRow, GridContext, DecisionModel>) => passesDecision(p.model, p.data);
export const claimFilterPass = (p: DoesFilterPassParams<GridRow, GridContext, ClaimModel>) => passesClaim(p.model, p.data);

/** How many claims give each value, most common first (ties A to Z, or newest day first). */
function tally(api: GridApi<GridRow>, key: (r: GridRow) => string, order: "count" | "desc" = "count"): [string, number][] {
  const n = new Map<string, number>();
  api.forEachNode((node) => {
    if (!node.data || node.data.group) return;
    const k = key(node.data);
    n.set(k, (n.get(k) ?? 0) + 1);
  });
  return [...n].sort((a, b) => (order === "desc" ? b[0].localeCompare(a[0]) : b[1] - a[1] || a[0].localeCompare(b[0])));
}

function toggled<M extends object>(current: M, key: keyof M, value: string): M {
  const list = current[key] as unknown as string[];
  return { ...current, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
}

const isEmpty = (m: object) => Object.values(m).every((v) => !(v as string[]).length);

export function DecisionFilter({ model, onModelChange, api }: CustomFilterDisplayProps<GridRow, GridContext, DecisionModel>) {
  const { reasons, verdicts } = useMemo(() => ({ reasons: tally(api, reasonGroup), verdicts: new Map(tally(api, (r) => verdictOf(r))) }), [api]);
  const current = model ?? { decisions: [], reasons: [] };
  const set = (key: keyof DecisionModel, v: string) => {
    const next = toggled(current, key, v);
    onModelChange(isEmpty(next) ? null : next);
  };
  return (
    <Menu onClear={model ? () => onModelChange(null) : undefined}>
      <Facet title="Verdict">
        {DECISION_WORDS.map(([d, word]) => (
          <Check key={d} checked={current.decisions.includes(d)} onChange={() => set("decisions", d)} label={word} count={verdicts.get(d) ?? 0} />
        ))}
      </Facet>
      <Facet title="Reason" scroll>
        {reasons.map(([r, n]) => (
          <Check key={r} checked={current.reasons.includes(r)} onChange={() => set("reasons", r)} label={r} count={n} />
        ))}
      </Facet>
    </Menu>
  );
}

export function ClaimFilter({ model, onModelChange, api }: CustomFilterDisplayProps<GridRow, GridContext, ClaimModel>) {
  // By the day it was filed. A one-time code belongs to one claim, so it is searched for, never faceted.
  const days = useMemo(() => tally(api, dayOf, "desc"), [api]);
  const current = model ?? { codes: [], days: [] };
  const set = (key: keyof ClaimModel, v: string) => {
    const next = toggled(current, key, v);
    onModelChange(isEmpty(next) ? null : next);
  };
  return (
    <Menu onClear={model ? () => onModelChange(null) : undefined} narrow>
      <Facet title="Filed (UTC)" scroll>
        {days.map(([d, n]) => (
          <Check key={d} checked={current.days.includes(d)} onChange={() => set("days", d)} label={formatDate(d)} count={n} />
        ))}
      </Facet>
    </Menu>
  );
}

function Menu({ children, onClear, narrow }: { children: ReactNode; onClear?: () => void; narrow?: boolean }) {
  return (
    <div className={`flex max-w-[calc(100vw-2rem)] flex-col py-2 text-ui text-text-2 ${narrow ? "w-[240px]" : "w-[360px]"}`}>
      {children}
      {onClear && (
        <div className="mt-2 flex justify-end border-t border-line px-3 pt-2">
          <button type="button" onClick={onClear} className="inline-flex min-h-8 items-center rounded-control px-2 text-muted hover:text-text">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function Facet({ title, children, scroll }: { title: string; children: ReactNode; scroll?: boolean }) {
  return (
    <fieldset className="border-line px-3 not-first:mt-2 not-first:border-t not-first:pt-2">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden="true" className="py-1 text-micro text-faint">
        {title}
      </p>
      {/* A long list is whole on a laptop's screen; only a short window scrolls it, its last row fading at the edge, so
          the list reads as one that goes on, never as one that ends. */}
      <div
        className={
          scroll
            ? "max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain pb-1 [@media(max-height:799px)]:max-h-52 [@media(max-height:799px)]:[mask-image:linear-gradient(to_bottom,#000_calc(100%-16px),transparent)]"
            : undefined
        }
      >
        {children}
      </div>
    </fieldset>
  );
}

function Check({ checked, onChange, label, count, mono }: { checked: boolean; onChange: () => void; label: string; count?: number; mono?: boolean }) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-control py-1 hover:text-text">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-3.5 shrink-0 accent-[var(--text)]" />
      <span className={`min-w-0 flex-1 leading-snug ${mono ? "font-mono" : ""}`}>{label}</span>
      {count !== undefined && <span className="shrink-0 font-mono text-micro text-faint tabular-nums">{formatCount(count)}</span>}
    </label>
  );
}
