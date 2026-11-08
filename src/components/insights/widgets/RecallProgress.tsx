"use client";

import clsx from "clsx";
import type { AgWidgetParams } from "ag-studio";
import type { RecallProgressDef } from "./defs";
import { TYPICAL_RETURN } from "./defs";
import { num, useRows } from "./useRows";

// Custom widget 1: units remedied against units sold, on a ruler with the share recalls usually reach. Remedy's own
// number is a sliver next to the 6-10% band on purpose: the scale is honest, and the gap is the point.

const SCALE = 0.12;
const TICKS = [0, 0.01, 0.05, 0.1];

const pct = (share: number) => {
  const p = share * 100;
  if (p > 0 && p < 0.01) return "<0.01%";
  return `${p.toLocaleString("en-US", { maximumFractionDigits: p < 10 ? 2 : 1 })}%`;
};
const at = (share: number) => `${(Math.min(share, SCALE) / SCALE) * 100}%`;

export function RecallProgress(params: AgWidgetParams<RecallProgressDef>) {
  const { dataMapping, widgetApi } = params;
  const remedied = dataMapping.remedied?.[0];
  const sold = dataMapping.sold?.[0];
  const rows = useRows(widgetApi, () => (remedied && sold ? [{ fields: [remedied] }, { fields: [sold] }] : null), [params]);
  if (!rows || !remedied || !sold) return null;

  const done = num(rows[0][0]?.[remedied.key]);
  const total = num(rows[1][0]?.[sold.key]);
  const share = total > 0 ? done / total : 0;

  return (
    <div className="flex h-full min-h-0 flex-col justify-between gap-4 pb-1">
      <p className="sr-only">
        {done.toLocaleString("en-US")} of {total.toLocaleString("en-US")} units remedied, {pct(share)}. Recalls typically reach {TYPICAL_RETURN.from * 100} to {TYPICAL_RETURN.to * 100}%.
      </p>
      {/* The units themselves are the ledger's first figure, right above: the panel gives the share they make. */}
      <p aria-hidden="true" className="flex items-baseline gap-2">
        <span className="text-head-sm leading-none font-medium">{pct(share)}</span>
        <span className="text-ui text-muted">of units sold remedied so far</span>
      </p>

      <div aria-hidden="true" className="relative pt-5 pb-6">
        <div className="relative h-2 rounded-full bg-surface-2">
          <div
            className="absolute inset-y-0 rounded-[2px]"
            style={{
              left: at(TYPICAL_RETURN.from),
              width: `calc(${at(TYPICAL_RETURN.to)} - ${at(TYPICAL_RETURN.from)})`,
              background: "repeating-linear-gradient(135deg, var(--faint) 0 1.5px, transparent 1.5px 6px)",
              boxShadow: "inset 0 0 0 1px var(--line-2)",
            }}
          />
          <div className="absolute inset-y-0 left-0 rounded-full bg-pay" style={{ width: `max(3px, ${at(share)})` }} />
        </div>
        <div className="absolute top-0 bottom-6 w-px bg-pay" style={{ left: `max(1px, ${at(share)})` }}>
          <span className="absolute -top-1 left-2 text-micro whitespace-nowrap text-pay">Remedy so far</span>
        </div>
        <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `calc((${at(TYPICAL_RETURN.from)} + ${at(TYPICAL_RETURN.to)}) / 2)` }}>
          <span className="text-micro whitespace-nowrap text-muted">Typical recall</span>
        </div>
        {TICKS.map((t) => (
          <div key={t} className={clsx("absolute bottom-0 flex flex-col gap-1", t === 0 ? "items-start" : "-translate-x-1/2 items-center")} style={{ left: at(t) }}>
            <span className="h-1.5 w-px bg-line-strong" />
            <span className="font-mono text-micro text-faint tabular-nums">{t === 0 ? "0" : pct(t)}</span>
          </div>
        ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-2 text-micro text-muted">
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-4 rounded-[2px]"
          style={{ background: "repeating-linear-gradient(135deg, var(--faint) 0 1.5px, transparent 1.5px 6px)" }}
        />
        <span>
          {TYPICAL_RETURN.from * 100}–{TYPICAL_RETURN.to * 100}% of recalled products are ever returned or destroyed.
        </span>
        <a href={TYPICAL_RETURN.href} target="_blank" rel="noreferrer" className="text-faint underline decoration-line-strong underline-offset-2 hover:text-text">
          {TYPICAL_RETURN.source}
        </a>
      </p>
    </div>
  );
}
