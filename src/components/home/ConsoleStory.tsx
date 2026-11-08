import type { ReactNode } from "react";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import type { ClaimRow } from "@/app/console/_lib/view";
import { EvidenceStill } from "@/components/console/EvidenceStill";
import { GridStill } from "@/components/console/GridStill";
import { PayoutsNote } from "./PayoutsNote";
import { ReportPeek } from "./ReportPeek";
import { TOUR } from "./tour-copy";

/*
 * The console tour below 1024px, and without JS at any width: the same four steps as a story, top to bottom, each with
 * its still at full width and real text (h3s, the photos' alt text, the evidence and the report). The queue is drawn as
 * the AG Grid draws it, its two narrow columns (GridStill), without the grid's JS. Server-rendered; Companies.tsx shows
 * it or the tour by breakpoint, so nothing swaps on load.
 */

const SHOWN = 6;

export function ConsoleStory({
  rows,
  sentences,
  evidence,
  insights,
  report,
}: {
  rows: ClaimRow[];
  sentences: string[];
  evidence: DrawerClaim | null;
  insights: ReactNode;
  report: ReactNode;
}) {
  const stills: ReactNode[] = [
    <div key="claims" className="overflow-hidden rounded-frame bg-bg shadow-float">
      <p className="flex items-baseline justify-between gap-3 px-4 py-3">
        <span className="min-w-0 text-ui text-pretty">
          <span className="font-medium">{TOUR.recall.product}</span> <span className="whitespace-nowrap text-muted">{TOUR.recall.id}</span>
        </span>
      </p>
      <div className="px-3 pb-3">
        <GridStill rows={rows.slice(0, SHOWN)} phone />
      </div>
      <p className="border-t border-line px-4 py-2.5 text-micro text-muted">
        {TOUR.credit[0]} · {SHOWN} of {rows.length} claims
      </p>
    </div>,
    evidence ? <EvidenceStill key="evidence" claim={evidence} note={<PayoutsNote amount={evidence.amount} id={evidence.id} />} fluid /> : null,
    <div key="insights">{insights}</div>,
    <ReportPeek key="report">{report}</ReportPeek>,
  ];
  return (
    <ol className="flex flex-col gap-14">
      {TOUR.steps.map((s, i) => (
        <li key={s.name} className="flex min-w-0 flex-col">
          <h3 className="text-head-sm font-medium">{s.name}</h3>
          <p className="mt-2 max-w-[60ch] text-body text-pretty text-text-2">{sentences[i]}</p>
          <div className="mt-5 min-w-0">{stills[i]}</div>
        </li>
      ))}
    </ol>
  );
}
