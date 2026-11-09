"use client";

import { useMemo, useRef, type ReactNode } from "react";
import type { DoesFilterPassParams, GridApi } from "ag-grid-community";
import { useGridFilterDisplay, type CustomFilterDisplayProps } from "ag-grid-react";
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
      <Facet title="Reason">
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
      <Facet title="Filed (UTC)">
        {days.map(([d, n]) => (
          <Check key={d} checked={current.days.includes(d)} onChange={() => set("days", d)} label={formatDate(d)} count={n} />
        ))}
      </Facet>
    </Menu>
  );
}

function Menu({ children, onClear, narrow }: { children: ReactNode; onClear?: () => void; narrow?: boolean }) {
  // Open, the menu takes focus at its first choice (Ctrl+↵ on a heading opens it from the keyboard): Space picks, Tab
  // stays in the menu (AG Grid keeps it there), and Esc closes it back to the heading (ClaimsGrid's closeFilter).
  const box = useRef<HTMLDivElement>(null);
  useGridFilterDisplay({
    afterGuiAttached: (p) => {
      const el = box.current;
      const list = el?.querySelector<HTMLElement>("[data-list]");
      if (!el || !list) return;
      // The choices take the room between the grid's header and the foot of the grid's box, so the menu opens whole under
      // its heading at any window height; past that they scroll under their section's heading, the foot fading while
      // there is more below.
      const host = el.closest<HTMLElement>(".claims-grid");
      const head = host?.querySelector(".ag-header")?.getBoundingClientRect().bottom;
      if (host && head !== undefined) {
        const bottom = Math.min(window.innerHeight, host.getBoundingClientRect().bottom) - 8;
        list.style.maxHeight = `${Math.max(128, Math.floor(bottom - head - 8 - (el.offsetHeight - list.offsetHeight)))}px`;
      }
      fade(list);
      if (p?.suppressFocus) return;
      // Opened from the keyboard (its heading had a visible focus ring), focus goes to the first choice; from a click,
      // to the menu itself, so no choice wears a ring nobody asked for and Tab and Esc still work from there.
      const keyed = document.activeElement?.matches(":focus-visible");
      (keyed ? el.querySelector<HTMLElement>("input, button") : el)?.focus({ preventScroll: true });
    },
  });
  return (
    <div ref={box} tabIndex={-1} className={`flex max-w-[calc(100vw-2rem)] flex-col text-ui text-text-2 outline-none ${narrow ? "w-[240px]" : "w-[360px]"}`}>
      <div
        data-list=""
        onScroll={(e) => fade(e.currentTarget)}
        className="max-h-[min(70vh,40rem)] scroll-pt-9 scroll-pb-6 overflow-y-auto overscroll-contain pb-2 data-more:[mask-image:linear-gradient(to_bottom,#000_calc(100%-24px),transparent)]"
      >
        {children}
      </div>
      {onClear && (
        <div className="flex justify-end border-t border-line px-3 py-2">
          <button type="button" onClick={onClear} className="inline-flex min-h-8 items-center rounded-control px-2 text-muted hover:text-text">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function Facet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-line px-3 not-first:mt-2 not-first:border-t">
      <legend className="sr-only">{title}</legend>
      {/* Its heading stays in view while its choices scroll under it (the scroller has no top padding, which would hold a
          sticky heading off its edge). */}
      <p aria-hidden="true" className="sticky top-0 z-1 -mx-3 bg-surface px-3 pt-3 pb-1 text-micro text-faint">
        {title}
      </p>
      {children}
    </fieldset>
  );
}

/** Marks a scrolling list that has more below its foot (data-more), for the fade. */
function fade(list: HTMLElement) {
  list.toggleAttribute("data-more", list.scrollTop + list.clientHeight < list.scrollHeight - 1);
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
