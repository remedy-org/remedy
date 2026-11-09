"use client";

import clsx from "clsx";
import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { InsightsData } from "@/app/console/insights/facts";
import { FilterBar } from "./FilterBar";
import { funnel } from "./funnel";
import { InsightsLedger } from "./InsightsLedger";
import { PaidLines } from "./PaidLines";
import { chartsPaidByDay, filterClaims, paidDays, PAID_BY_DAY, rowsOf, type FilterPick } from "./report";
import { refusalItems } from "./still";
import { CheckFunnelView } from "./widgets/CheckFunnelView";
import { decisionItems, DecisionMixView } from "./widgets/DecisionMixView";
import { moveBetweenItems } from "./widgets/listKeys";
import { RecallProgressView } from "./widgets/RecallProgressView";
import { GATE_LABEL, RefusalReasonsView } from "./widgets/RefusalReasonsView";

// Insights in Remedy's own React, for a build without a valid AG Studio key (lib/agStudioLicence.ts): the console's
// page panel for panel and word for word, drawn by the views its Studio widgets render (RecallProgressView,
// DecisionMixView, CheckFunnelView, RefusalReasonsView), in the same two thirds and one third, so it reads as the same
// page. A pick (a decision, a funnel drop, a refusal reason) filters the page as Studio's cross-filter does: the
// ledger, the progress, the day figures and the other panels follow it, and the panel holding the pick keeps every
// item, the picked ones ringed and the rest dimmed. No AG Studio module loads on this path, and there is no analyst.

type Claim = InsightsData["claims"][number];

const DECISION = "claims.decision";
const STAGE = "claims.stage";
const REASON = "claims.refusalReason";

/** A pick toggles its value; a plain click replaces the panel's pick, Cmd or Ctrl adds to it (Studio's model). */
export function togglePick(picks: FilterPick[], field: string, value: string, add: boolean): FilterPick[] {
  const own = picks.find((p) => p.field === field)?.values ?? [];
  const values = own.includes(value) ? own.filter((v) => v !== value) : add ? [...own, value] : [value];
  const rest = picks.filter((p) => p.field !== field);
  return values.length ? [...rest, { field, values }] : rest;
}

/** The claims a panel draws: the page's picks on every other field, so a panel's own pick never empties it. */
export const claimsFor = (claims: Claim[], picks: FilterPick[], field: string) => filterClaims(claims, picks.filter((p) => p.field !== field)) ?? claims;

/** A section under a hairline (none where it sits on the filter bar), the right column 40px in from the left one's
 * bars. Side by side, a row is as tall as the taller of its two panels, so the funnel and the refusals end on one line;
 * each panel is as tall as what it lists, so no card leaves a band of empty space over the next. */
function Panel({ title, minHeight, first, right, children }: { title: string; minHeight?: number; first?: boolean; right?: boolean; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      style={{ minHeight }}
      className={clsx(
        "flex flex-col gap-2.5 border-t border-line pt-4 pb-6",
        // Stacked, only Recall progress sits on the filter bar; side by side, Decisions does too.
        first && (right ? "lg:border-t-0" : "border-t-0"),
        right && "lg:pl-10",
      )}
    >
      <h2 className="text-ui font-medium">{title}</h2>
      <div className="flex flex-1 flex-col [&>*]:flex-1">{children}</div>
    </section>
  );
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const plural = (n: number, one: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : `${one}s`}`;

/** What PayPal paid each day, as columns 72px wide, each day's dollars on its column and the day under it. Under a pick
 * each day's whole column dims and what the pick keeps is drawn solid over it, its figure stepping aside. */
function PaidColumns({ all, kept }: { all: ReturnType<typeof paidDays>; kept: ReturnType<typeof paidDays> | null }) {
  const max = Math.max(...all.map((d) => d.dollars), 0.01);
  return (
    <section aria-labelledby="paid-columns" className="page">
      <div className="flex flex-col gap-4 border-t border-line pt-4 pb-2">
        <h2 id="paid-columns" className="text-ui font-medium">
          {PAID_BY_DAY}
        </h2>
        <ul className="flex h-[176px] items-end">
          {all.map((d) => {
            const k = kept ? (kept.find((x) => x.day === d.day) ?? { dollars: 0, payouts: 0 }) : d;
            const tall = (dollars: number) => (dollars > 0 ? Math.max(2, Math.round((dollars / max) * 148)) : 0);
            // The day's dollars on its column, or over it where the column is too short to hold them.
            const inside = tall(d.dollars) >= 28;
            return (
              <li key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-2" title={`${d.day}: ${usd.format(k.dollars)} paid through PayPal · ${plural(k.payouts, "payout")}`}>
                <span aria-hidden="true" className="relative flex h-[148px] w-full max-w-[72px] flex-col justify-end">
                  {!kept && !inside && <span className="pb-1 text-center text-micro text-text tabular-nums">{usd.format(d.dollars)}</span>}
                  <span className={clsx("relative rounded-t-[3px] bg-pay-fill", kept && "opacity-30")} style={{ height: tall(d.dollars) }}>
                    {!kept && inside && <span className="block truncate px-1 pt-1.5 text-center text-micro text-pay-fill-text tabular-nums">{usd.format(d.dollars)}</span>}
                  </span>
                  {kept && <span className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-pay-fill" style={{ height: tall(k.dollars) }} />}
                </span>
                <span className="text-micro whitespace-nowrap text-muted">{d.day}</span>
              </li>
            );
          })}
        </ul>
        <p className="sr-only">
          {(kept ?? all).map((d) => `${d.day}: ${usd.format(d.dollars)}, ${plural(d.payouts, "payout")}`).join("; ")}
        </p>
      </div>
    </section>
  );
}

export function InsightsReport({ data }: { data: InsightsData }) {
  const [picks, setPicks] = useState<FilterPick[]>([]);
  const bar = useRef<HTMLDivElement>(null);
  const claims = data.claims;
  const shown = useMemo(() => filterClaims(claims, picks) ?? claims, [claims, picks]);
  // Recall progress keeps Studio's row height (report.ts rowsOf): its ruler spreads over it.
  const progressHeight = rowsOf(data, false).progress * 16;
  const filtered = picks.length > 0;

  const view = useMemo(() => {
    const tally = new Map<string, number>();
    for (const c of claimsFor(claims, picks, DECISION)) tally.set(c.decision, (tally.get(c.decision) ?? 0) + 1);
    return {
      decisions: decisionItems(tally),
      steps: funnel(claimsFor(claims, picks, STAGE)),
      refusals: refusalItems(claimsFor(claims, picks, REASON)),
    };
  }, [claims, picks]);

  const selected = (field: string) => new Set(picks.find((p) => p.field === field)?.values ?? []);
  const toggle = (field: string) => (value: string) => (e: MouseEvent) => {
    e.stopPropagation();
    setPicks((prev) => togglePick(prev, field, value, e.metaKey || e.ctrlKey));
  };
  const reset = (field: string) => () => setPicks((prev) => prev.filter((p) => p.field !== field));
  const clear = () => {
    setPicks([]);
    bar.current?.focus();
  };

  const remedied = shown.reduce((n, c) => n + c.remedied, 0);
  const allDays = paidDays(claims);

  return (
    <div className="flex w-full flex-col">
      <div className="page">
        <InsightsLedger claims={shown} unitsSold={data.recall.unitsSold} />
      </div>
      <FilterBar ref={bar} picks={picks} shown={shown.length} total={claims.length} onClear={clear} />
      <div className="page grid grid-cols-1 lg:grid-cols-[2fr_1fr]">
        <Panel title="Recall progress" minHeight={progressHeight} first>
          <RecallProgressView done={remedied} total={data.recall.unitsSold} dayCount={data.recall.daysIn} dated />
        </Panel>
        <Panel title="Decisions" first right>
          <DecisionMixView items={view.decisions} selected={selected(DECISION)} onToggle={toggle(DECISION)} onReset={reset(DECISION)} onKeyDown={moveBetweenItems} />
        </Panel>
        <Panel title="Where claims stop">
          <CheckFunnelView steps={view.steps} selected={selected(STAGE)} onToggle={toggle(STAGE)} onReset={reset(STAGE)} onKeyDown={moveBetweenItems} />
        </Panel>
        <Panel title="Why claims were refused" right>
          <RefusalReasonsView
            items={view.refusals}
            selected={selected(REASON)}
            onToggle={toggle(REASON)}
            onReset={reset(REASON)}
            onKeyDown={moveBetweenItems}
            caughtBy={GATE_LABEL}
          />
        </Panel>
      </div>
      {chartsPaidByDay(data) ? <PaidColumns all={allDays} kept={filtered ? paidDays(shown) : null} /> : <PaidLines days={paidDays(shown)} />}
    </div>
  );
}
