"use client";

import clsx from "clsx";
import { useMemo, useState, useSyncExternalStore } from "react";
import { CheckProgress, ExhibitLabel, StatusPill } from "@/components/ui";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import { ledgerOf, type ClaimRow, type Ledger as LedgerData } from "@/app/console/_lib/view";
import { ClaimsGrid } from "./ClaimsGrid";
import { EvidencePhoto } from "./EvidencePhoto";
import { Ledger } from "./Ledger";
import { StatusTabs, TABS, type Tab } from "./StatusTabs";

/** A preview row: a grid row, and for the open claim its evidence (built on the server, so nothing is fetched). */
export type PreviewRow = ClaimRow & { evidence?: DrawerClaim };

export interface ClaimsGridPreviewProps {
  rows: PreviewRow[];
  /** The claim whose evidence panel is open (laptops). */
  openId?: string;
  /** The frame's grid area height, in px. */
  height: number;
  /** Totals over every sample claim, when rows are only the first few. */
  ledger?: LedgerData;
  counts?: Record<Tab, number>;
}

/**
 * The real claims grid, read only, for the homepage: the same AG Grid, cells and theme as /console, on the seeded
 * sample claims (components/console/preview.ts builds the props on the server). No network, no polling, no actions:
 * the tabs filter, the rows don't open anything, and the evidence panel is a still of the open claim. Load it with
 * next/dynamic (ClaimsGridPreviewLazy does, one viewport ahead), so the homepage's first load carries no grid JS.
 */
// Laptops show the grid with the panel open; phones show four cards, one of each outcome, and no panel.
const WIDE = "(min-width: 1024px)";
const subscribe = (on: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", on);
  return () => m.removeEventListener("change", on);
};
const PHONE_SET: ClaimRow["decision"][] = ["paid", "held", "rejected", "blocked"];

export function ClaimsGridPreview({ rows, openId, height, ledger, counts }: ClaimsGridPreviewProps) {
  const [tab, setTab] = useState<Tab>("all");
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => true);
  const tally = useMemo(() => {
    if (counts) return counts;
    const c = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<Tab, number>;
    c.all = rows.length;
    for (const r of rows) c[r.decision]++;
    return c;
  }, [counts, rows]);
  const tabbed = tab === "all" ? rows : rows.filter((r) => r.decision === tab);
  const shown = wide || tab !== "all" ? tabbed : PHONE_SET.flatMap((d) => rows.find((r) => r.decision === d) ?? []);
  const open = wide ? (rows.find((r) => r.id === openId)?.evidence ?? null) : null;

  return (
    <div className="overflow-hidden rounded-frame bg-bg text-text shadow-float">
      {/* App chrome */}
      <div className="flex h-12 items-center gap-6 border-b border-line px-4 sm:px-5" aria-hidden="true">
        <span className="font-semibold">Remedy</span>
        <span className="hidden gap-5 text-ui font-medium sm:flex">
          <span className="relative text-text after:absolute after:inset-x-0 after:-bottom-[15px] after:h-px after:bg-text">Claims</span>
          <span className="text-muted">Insights</span>
          <span className="text-muted">Report</span>
        </span>
        <span className="ml-auto text-ui text-muted">Kikea Store</span>
      </div>

      <div className="px-4 pt-4 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <span className="text-ui font-medium">
            Kikea <span className="whitespace-nowrap">X-VESOLJE</span> nursing pillows
          </span>
          <span className="flex items-center gap-3">
            <span className="micro text-faint">CPSC 27-071</span>
            <span className="micro inline-flex h-5 items-center rounded-control border border-line-strong px-1.5 text-muted">Sample data</span>
          </span>
        </div>
        <Ledger ledger={ledger ?? ledgerOf(rows, { unitsSold: 19_596 })} className="mt-3" />
        <div className="mt-1 border-b border-line">
          <StatusTabs value={tab} counts={tally} onChange={setTab} controls="preview-claims" />
        </div>
      </div>

      <div className="flex gap-3 p-3 sm:px-5" style={wide ? { height } : undefined}>
        <div id="preview-claims" className="min-w-0 flex-1">
          {shown.length ? (
            <ClaimsGrid rows={shown} openId={open ? (openId ?? null) : null} onOpen={() => {}} fill={wide} still />
          ) : (
            <p className="px-2 py-8 text-center text-ui text-muted">None of the sample claims shown here is {TABS.find((t) => t.id === tab)?.label.toLowerCase()}.</p>
          )}
        </div>
        {open && (
          <EvidenceStill claim={open} />
        )}
      </div>
      <p className="border-t border-line px-4 py-2 font-mono text-micro text-faint sm:px-5">
        {tally.all} sample claims from the eval set · AI-made test photos · no money moved
      </p>
    </div>
  );
}

/** The open claim's evidence as a still: the photos, the model's quoted answers (the unclear one first), the rule. */
function EvidenceStill({ claim }: { claim: DrawerClaim }) {
  const checks = [...claim.checks].sort((a, b) => Number(a.outcome === "pass") - Number(b.outcome === "pass"));
  return (
    <aside aria-label={`Evidence for ${claim.id}`} className="flex h-full w-[380px] shrink-0 flex-col overflow-hidden rounded-card bg-surface shadow-float">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="flex items-center gap-3">
          <span className="font-mono text-ui font-medium">{claim.id}</span>
          <StatusPill status={claim.decision} />
        </span>
        <span className="font-mono text-micro text-faint">
          {claim.payer} · Code {claim.code}
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-col gap-4 px-4 py-3">
          <ExhibitLabel leader="right" leaderLength={20}>
            Exhibit A · {claim.photos.length} sample {claim.photos.length === 1 ? "photo" : "photos"}
          </ExhibitLabel>
          <div className="grid grid-cols-2 gap-2">
            {claim.photos.map((src, i) => (
              <EvidencePhoto key={src} src={src} n={i + 1} of={claim.photos.length} sample sized />
            ))}
          </div>
          <CheckProgress
            label={`Model answers for ${claim.id}`}
            steps={checks.slice(0, 3).map((c) => ({
              id: c.id,
              label: c.label,
              state: c.outcome === "reject" ? "reject" : c.outcome,
              detail: c.evidence ? <q className="block font-mono text-micro leading-relaxed text-muted">{c.evidence}</q> : c.rule,
            }))}
          />
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-surface to-transparent" />
      </div>
      <div className="border-t border-line px-4 py-3">
        <p className="text-ui">{claim.sentence}</p>
        <div className="mt-3 flex items-center gap-2" aria-hidden="true">
          <span className={clsx("inline-flex h-9 items-center rounded-control bg-accent px-3 text-ui font-medium text-accent-ink")}>Approve</span>
          <span className="inline-flex h-9 items-center rounded-control border border-line-strong px-3 text-ui font-medium">Reject</span>
          <span className="ml-auto font-mono text-micro text-faint">A / R</span>
        </div>
      </div>
    </aside>
  );
}
