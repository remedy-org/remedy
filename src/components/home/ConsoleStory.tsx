import type { ReactNode } from "react";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import { EvidenceStill } from "@/components/console/EvidenceStill";
import { ReplicaCards, type PreviewRow as ReplicaRow } from "./ConsoleReplica";
import { payoutsLine, TOUR } from "./tour-copy";

/*
 * The console tour below 1024px, and without JS at any width: the same four steps as a story, top to bottom, each with
 * its still at full width and real text (h3s, the photos' alt text and AI-made labels, the evidence and the report).
 * No AG Grid, no Studio. Server-rendered; Companies.tsx shows it or the tour by breakpoint, so nothing swaps on load.
 */

const OUTCOMES = ["paid", "held", "rejected", "blocked"] as const;

export function ConsoleStory({ replica, evidence, insights, report }: { replica: ReplicaRow[]; evidence: DrawerClaim | null; insights: ReactNode; report: ReactNode }) {
  const cards = OUTCOMES.flatMap((d) => replica.find((r) => r.status === d) ?? []);
  const stills: ReactNode[] = [
    <div key="claims" className="overflow-hidden rounded-frame bg-bg shadow-float">
      <p className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="micro whitespace-nowrap text-faint">{TOUR.recall.id}</span>
        <span className="micro inline-flex h-5 items-center rounded-control border border-line-2 px-1.5 whitespace-nowrap text-muted">{TOUR.recall.badge}</span>
      </p>
      <ReplicaCards rows={cards} />
    </div>,
    evidence ? <EvidenceStill key="evidence" claim={evidence} note={payoutsLine(evidence.amount, evidence.id)} fluid /> : null,
    <div key="insights">{insights}</div>,
    <div key="report" className="h-[360px] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_calc(100%-64px),transparent)]">
      {report}
    </div>,
  ];
  return (
    <ol className="flex flex-col gap-10">
      {TOUR.steps.map((s, i) => (
        <li key={s.n} className="flex min-w-0 flex-col">
          <span className="font-mono text-micro text-faint">{s.n}</span>
          <h3 className="mt-1 text-head-sm font-medium">{s.name}</h3>
          <p className="mt-2 max-w-[60ch] text-body text-pretty text-text-2">{s.sentence}</p>
          <div className="mt-5 min-w-0">{stills[i]}</div>
        </li>
      ))}
    </ol>
  );
}
