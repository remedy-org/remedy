import type { ReactNode } from "react";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import { EvidenceStill } from "@/components/console/EvidenceStill";
import { BarcodeLegend, ReplicaCards, type PreviewRow as ReplicaRow } from "./ConsoleReplica";
import styles from "./home.module.css";
import { PayoutsNote } from "./PayoutsNote";
import { TOUR } from "./tour-copy";

/*
 * The console tour below 1024px, and without JS at any width: the same four steps as a story, top to bottom, each with
 * its still at full width and real text (h3s, the photos' alt text and AI-made labels, the evidence and the report).
 * No AG Grid, no Studio. Server-rendered; Companies.tsx shows it or the tour by breakpoint, so nothing swaps on load.
 */

const OUTCOMES = ["paid", "held", "rejected", "blocked"] as const;

export function ConsoleStory({
  replica,
  sentences,
  evidence,
  insights,
  report,
}: {
  replica: ReplicaRow[];
  sentences: string[];
  evidence: DrawerClaim | null;
  insights: ReactNode;
  report: ReactNode;
}) {
  const cards = OUTCOMES.flatMap((d) => replica.find((r) => r.status === d) ?? []);
  const stills: ReactNode[] = [
    <div key="claims" className="overflow-hidden rounded-frame bg-bg shadow-float">
      <p className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="micro whitespace-nowrap text-faint">{TOUR.recall.id}</span>
        <span className="micro inline-flex h-5 items-center rounded-control border border-line-2 px-1.5 whitespace-nowrap text-muted">{TOUR.recall.badge}</span>
      </p>
      <ReplicaCards rows={cards} />
      <BarcodeLegend className="border-t border-line px-4 py-3" />
    </div>,
    evidence ? <EvidenceStill key="evidence" claim={evidence} note={<PayoutsNote amount={evidence.amount} id={evidence.id} />} fluid /> : null,
    <div key="insights">{insights}</div>,
    // The draft's head, fading out; "Read the whole draft" opens the rest in place (no JS: a <details> lifts the cap).
    <div key="report" className={styles.peek}>
      <div className={styles.peekClip}>{report}</div>
      <details className="mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control text-ui font-medium text-text underline decoration-line-2 underline-offset-4 hover:decoration-current">
          <span className={styles.peekMore}>Read the whole draft</span>
          <span className={styles.peekLess}>Show less of the draft</span>
        </summary>
      </details>
    </div>,
  ];
  return (
    <ol className="flex flex-col gap-10">
      {TOUR.steps.map((s, i) => (
        <li key={s.n} className="flex min-w-0 flex-col">
          <span className="font-mono text-micro text-faint">{s.n}</span>
          <h3 className="mt-1 text-head-sm font-medium">{s.name}</h3>
          <p className="mt-2 max-w-[60ch] text-body text-pretty text-text-2">{sentences[i]}</p>
          <div className="mt-5 min-w-0">{stills[i]}</div>
        </li>
      ))}
    </ol>
  );
}
