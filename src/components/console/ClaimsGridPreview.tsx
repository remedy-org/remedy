"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import { ledgerOf, type ClaimRow, type Ledger as LedgerData } from "@/app/console/_lib/view";
import { ClaimsGrid, type ClaimsGridHandle } from "./ClaimsGrid";
import { EvidenceStill } from "./EvidenceStill";
import { Ledger } from "./Ledger";
import { StatusTabs, TABS, type Tab } from "./StatusTabs";

/** A preview row: a grid row, and for the open claim its evidence (built on the server, so nothing is fetched). */
export type PreviewRow = ClaimRow & { evidence?: DrawerClaim };

export interface ClaimsGridPreviewProps {
  rows: PreviewRow[];
  /** The claim whose evidence panel is open (laptops); bare: whose row is selected. */
  openId?: string | null;
  /** The frame's grid area height, in px. */
  height: number;
  /** Totals over every sample claim, when rows are only the first few. */
  ledger?: LedgerData;
  counts?: Record<Tab, number>;
  /** A class for the evidence panel's wrapper, so a page can animate it in. */
  panelClassName?: string;
  /** The grid has drawn its first rows. */
  onReady?: () => void;
  /**
   * The grid area alone (the homepage's console tour draws the frame, ledger and tabs around it), driven by the props
   * below through the grid's API, so a change never resets the rows. Without it, the whole frame as before.
   */
  bare?: boolean;
  /** bare: show only the held claims (AG Grid's own filter, so the rows animate). */
  filter?: "held" | null;
  /** bare: where the arriving claim is: "before" (not in the grid), "interim" (just in, being checked) or "final". */
  arrival?: { id: string; phase: "before" | "interim" | "final" };
  /** bare: the arrival is playing (claims-grid.css fills its barcode). */
  live?: boolean;
  /** bare: what sits beside the grid (the tour's evidence panel). */
  aside?: ReactNode;
}

// A claim still being checked, as the queue shows one the moment its photos arrive: in progress, its checks waiting,
// no answer, no amount and no payout yet.
function interimOf(row: ClaimRow): ClaimRow {
  return {
    ...row,
    decision: "pending",
    note: "Checking photos",
    payoutStatus: null,
    amount: null,
    cents: null,
    bars: row.bars?.map((b) => ({ ...b, state: "waiting" })) ?? null,
    timeline: null,
    modelSec: null,
  };
}

const HELD = (r: ClaimRow) => r.decision === "held";

/** The grid area of the homepage's console tour: the real grid, filtered, opened and arriving through its API. */
function BareGrid({ rows, openId, filter = null, arrival, live, aside, onReady }: ClaimsGridPreviewProps) {
  const grid = useRef<ClaimsGridHandle>(null);
  // The rows the grid starts with, once: the arriving claim held back while it is still to arrive.
  const [initial] = useState(() => (arrival?.phase === "before" ? rows.filter((r) => r.id !== arrival.id) : rows));
  const [ready, setReady] = useState(false);
  const final = arrival ? rows.find((r) => r.id === arrival.id) : undefined;
  const phase = useRef(arrival?.phase);
  const settle = useRef<() => void>(() => {});

  useEffect(() => {
    if (!ready || !arrival || !final) return;
    const from = phase.current;
    phase.current = arrival.phase;
    if (from === arrival.phase) return;
    const handle = grid.current;
    if (!handle) return;
    if (arrival.phase === "before") {
      settle.current = () => {};
      handle.remove(final.id);
    } else if (arrival.phase === "interim") {
      // The tour moves it to "final" itself; the long fallback only guards a lost update.
      settle.current = handle.arrive(interimOf(final), final, Math.max(0, rows.indexOf(final)), 60_000);
    } else if (from === "interim") settle.current();
    else handle.arrive(final, final, Math.max(0, rows.indexOf(final)), 0)();
  }, [ready, arrival, final, rows]);

  useEffect(() => {
    if (ready) grid.current?.setFilter(filter === "held" ? HELD : null);
  }, [ready, filter]);

  useEffect(() => {
    if (ready) grid.current?.open(openId ?? null);
  }, [ready, openId]);

  return (
    <div className="flex h-full gap-3" data-live={live ? "arrive" : undefined}>
      <div className="min-w-0 flex-1 overflow-hidden">
        <ClaimsGrid
          ref={grid}
          rows={initial}
          openId={null}
          onOpen={() => {}}
          onReady={() => {
            setReady(true);
            onReady?.();
          }}
          fill
          still
        />
      </div>
      {aside}
    </div>
  );
}

/**
 * The real claims grid, read only, for the homepage: the same AG Grid, cells and theme as /console, on the seeded
 * sample claims (components/console/preview.ts builds the props on the server). No network, no polling, no actions:
 * a product shot, so nothing in it responds (ClaimsGridPreviewLazy makes it inert: no clicks, no tab stops), and the
 * evidence panel is a still of the open claim. Load it with next/dynamic (ClaimsGridPreviewLazy does, one viewport
 * ahead), so the homepage's first load carries no grid JS. `onReady` fires once the grid has drawn its rows.
 */
// Laptops show the grid with the panel open; phones show four cards, one of each outcome, and no panel.
const WIDE = "(min-width: 1024px)";
const subscribe = (on: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", on);
  return () => m.removeEventListener("change", on);
};
const PHONE_SET: ClaimRow["decision"][] = ["paid", "held", "rejected", "blocked"];

export function ClaimsGridPreview(props: ClaimsGridPreviewProps) {
  return props.bare ? <BareGrid {...props} /> : <FramedPreview {...props} />;
}

function FramedPreview({ rows, openId, height, ledger, counts, panelClassName, onReady }: ClaimsGridPreviewProps) {
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => true);
  const tally = useMemo(() => {
    if (counts) return counts;
    const c = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<Tab, number>;
    c.all = rows.length;
    for (const r of rows) c[r.decision]++;
    return c;
  }, [counts, rows]);
  const shown = wide ? rows : PHONE_SET.flatMap((d) => rows.find((r) => r.decision === d) ?? []);
  const open = wide ? (rows.find((r) => r.id === openId)?.evidence ?? null) : null;

  return (
    <div className="overflow-hidden rounded-frame bg-bg text-text shadow-float">
      {/* App chrome. Insights and Report are the console's other pages: faint, since this still can't open them. The
          whole frame is a picture (the caller makes it inert), and says so. */}
      <div className="flex h-12 items-center gap-4 border-b border-line px-4 sm:gap-6 sm:px-5" aria-hidden="true">
        <span className="font-semibold">Remedy</span>
        <span className="hidden gap-5 text-ui font-medium sm:flex">
          <span className="relative text-text after:absolute after:inset-x-0 after:-bottom-[15px] after:h-px after:bg-text">Claims</span>
          <span className="text-faint">Insights</span>
          <span className="text-faint">Report</span>
        </span>
        <span className="micro ml-auto text-faint">Preview</span>
        <span className="text-ui whitespace-nowrap text-muted">Kikea Store</span>
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
          <StatusTabs value="all" counts={tally} onChange={() => {}} controls="preview-claims" />
        </div>
      </div>

      <div className="flex gap-3 p-3 sm:px-5" style={wide ? { height } : undefined}>
        <div id="preview-claims" className="min-w-0 flex-1 overflow-hidden">
          <ClaimsGrid rows={shown} openId={open ? (openId ?? null) : null} onOpen={() => {}} onReady={onReady} fill={wide} still />
        </div>
        {open && (
          <div className={clsx("h-full shrink-0", panelClassName)}>
            <EvidenceStill claim={open} />
          </div>
        )}
      </div>
      {/* The tab counts cover every sample claim; the frame holds only the first few, so it says how many it shows. */}
      <p className="border-t border-line px-4 py-2 font-mono text-micro text-faint sm:px-5">
        {shown.length < tally.all ? `${shown.length} of ` : ""}
        {tally.all} sample claims from the eval set · AI-made test photos · no money moved
      </p>
    </div>
  );
}
