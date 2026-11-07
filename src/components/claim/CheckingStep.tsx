"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui";
import { CheckList } from "./CheckList";
import { ExhibitPhoto, StepTitle } from "./Exhibit";
import styles from "./flow.module.css";
import { GlassChip } from "./Viewfinder";
import { isDecided, type CheckRow, type ClaimView, type TimelineEvent } from "./model";

// Each check appears as it resolves, one after another, rather than all at once.
const STEP_MS = 420;
// Each poll reads the claim from the store, and those reads are capped per month.
const POLL_MS = 2000;
// The photo check's usual range, from the live runs: 15 to 40 seconds.
const USUAL = [15, 40] as const;

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

const firstWaiting = (rows: CheckRow[]) => {
  const i = rows.findIndex((r) => r.state === "waiting");
  return i < 0 ? rows.length : i;
};

export interface CheckingStepProps {
  claimId: string;
  view: ClaimView;
  /** The server clock at render (ms). */
  startNow: number;
  /** Exhibit A: the first photo sent (a local copy, or the sample's), else the owner's photo route. */
  photoUrl?: string;
  /** A judges' sample: the photo carries its AI-made label. */
  sample?: boolean;
  /** The photos are still on their way up: nothing has resolved yet. */
  sending?: boolean;
  /** Dev previews: no polling, no refresh, every known row shown, and a fixed elapsed time. */
  preview?: { elapsed?: number; offline?: boolean };
}

/**
 * The trust screen: Exhibit A beside the checks. While the model reads the photo an amber line scans it; an honest
 * time line shows the elapsed seconds against the usual 15 to 40 (never a percentage); the stage timeline uses the
 * claim's own event times. Once decided, the checks reveal in order and the page re-renders as the result.
 */
export function CheckingStep({ claimId, view: initial, startNow, photoUrl, sample, sending, preview }: CheckingStepProps) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [shown, setShown] = useState(preview ? firstWaiting(initial.rows) : 0);
  const [offline, setOffline] = useState(preview?.offline ?? false);
  // The server clock at render first, so server and client paint the same seconds.
  const [mounted] = useState(startNow);
  const [now, setNow] = useState(startNow);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);

  // A new answer from the parent (the upload's response) replaces the local one.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setView(initial);
  }

  const known = firstWaiting(view.rows);
  const decided = isDecided(view.decision);
  const done = decided && shown >= view.rows.length;

  useEffect(() => {
    if (shown >= known) return;
    const t = setTimeout(() => setShown((s) => s + 1), reduced ? 0 : STEP_MS);
    return () => clearTimeout(t);
  }, [shown, known, reduced]);

  // The clock for the time line, 4 times a second, until the checks are done.
  useEffect(() => {
    if (preview || done) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [preview, done]);

  useEffect(() => {
    if (preview || sending || decided) return;
    let delay = POLL_MS;
    let t: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      // A hidden tab waits; the result is fetched when it's looked at again.
      if (document.hidden) {
        t = setTimeout(tick, POLL_MS);
        return;
      }
      try {
        const res = await fetch(`/api/claims/${claimId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as ClaimView;
        if (stopped) return;
        setView(next);
        setOffline(false);
        delay = POLL_MS;
      } catch {
        if (stopped) return;
        setOffline(true);
        delay = Math.min(delay * 2, 10_000);
      }
      t = setTimeout(tick, delay);
    };
    t = setTimeout(tick, delay);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [claimId, decided, preview, sending]);

  useEffect(() => {
    if (!done || preview) return;
    const t = setTimeout(() => router.refresh(), reduced ? 300 : 1200);
    return () => clearTimeout(t);
  }, [done, preview, reduced, router]);

  const rows: CheckRow[] = view.rows.map((r, i) =>
    i < shown ? r : i === shown && !done ? { ...r, state: "running", detail: undefined, quote: undefined } : { ...r, state: "waiting", detail: undefined, quote: undefined },
  );
  const reading = !sending && !decided && view.photos > 0 && rows.some((r) => r.group === "model" && (r.state === "running" || r.state === "waiting"));
  // Seconds since the photos arrived: from the claim's own event when there is one, so a reload keeps counting.
  const received = view.timeline.find((e) => e.type === "photos_received")?.at;
  const elapsed = preview?.elapsed ?? Math.max(0, (now - (received ? Date.parse(received) : mounted)) / 1000);
  const blocked = view.decision === "blocked";
  const src = photoUrl ?? (view.photos > 0 ? `/api/claims/${claimId}/photos/1` : undefined);

  const title = sending ? "Sending your photos" : done ? "Checks finished" : `Checking your ${view.photos > 1 ? "photos" : "photo"}`;
  const lead = sending
    ? "Uploading over a secure connection."
    : done
      ? "Opening your result."
      : elapsed > USUAL[1] && !decided
        ? "Taking longer than usual. Nothing is lost: your claim is saved, and a person looks at it if the check doesn't answer."
        : "Usually 15 to 40 seconds. Your claim is saved, so you can close this page.";

  return (
    <section aria-labelledby="checking-title" aria-busy={!done} className="mx-auto grid w-full max-w-[60rem] gap-8 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-start lg:gap-14">
      <div className="flex flex-col gap-3 lg:sticky lg:top-8">
        {src ? (
          <ExhibitPhoto src={src} alt={`Exhibit A: the ${sample ? "sample" : "first"} photo of claim ${view.id}`} sample={sample} frame="h-60 lg:h-[27.5rem]">
            {reading && !reduced && (
              <span aria-hidden="true" className={clsx("absolute inset-0", styles.scan)}>
                <span className={styles.scanLine} />
              </span>
            )}
            {reading && (
              <GlassChip className="absolute top-2 right-2">
                {reduced ? <>Reading the photo… <span className="normal-case">{Math.floor(elapsed)}s</span></> : "Reading the photo"}
              </GlassChip>
            )}
          </ExhibitPhoto>
        ) : (
          <div className="flex h-60 items-center justify-center rounded-control border border-dashed border-line-strong text-ui text-faint lg:aspect-[3/4] lg:h-auto">Your photos are on their way</div>
        )}
        <p className="font-mono text-micro text-faint">
          Exhibit A · claim {view.id} · code {view.code}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <StepTitle id="checking-title">{title}</StepTitle>
            <span className="font-mono text-ui text-faint tabular-nums" aria-hidden="true">
              {Math.floor(elapsed)}s
            </span>
          </div>
          <p className="text-body text-muted" aria-live="polite">
            {lead}
          </p>
        </div>

        {!sending && !blocked && <TimeLine elapsed={elapsed} done={decided} />}
        {!sending && <Stages timeline={view.timeline} decision={view.decision} />}

        {offline && (
          <p role="status" className="rounded-control border border-line bg-surface-2 px-3 py-2.5 text-ui text-muted">
            Lost the connection for a moment. Your claim is still being checked; this page catches up when you&apos;re back online.
          </p>
        )}

        <Card padding="md">
          <CheckList rows={rows} label={`Checks for claim ${view.id}`} code={view.code} />
        </Card>

        {blocked && shown >= view.rows.length && <p className="text-ui text-muted">The photos never reached the photo check: a claim that fails these first checks stops here.</p>}
      </div>
    </section>
  );
}

/**
 * Elapsed time against the usual range, like Wise's arrival estimate: a 4px track over 60 seconds (120 past a minute),
 * the usual 15 to 40 seconds shaded, a tick for now. It never claims a percentage done.
 */
function TimeLine({ elapsed, done }: { elapsed: number; done: boolean }) {
  const scale = elapsed > 60 ? 120 : 60;
  const at = (s: number) => `${(Math.min(s, scale) / scale) * 100}%`;
  return (
    <div className="flex flex-col gap-1.5" role="img" aria-label={`${Math.floor(elapsed)} seconds so far. The photo check usually takes 15 to 40 seconds.`}>
      <div className="relative h-4">
        <span className="micro absolute bottom-0 -translate-x-1/2 text-faint" style={{ left: `calc(${at(USUAL[0])} + (${at(USUAL[1])} - ${at(USUAL[0])}) / 2)` }}>
          Usual
        </span>
      </div>
      <div className="relative h-1 rounded-full bg-line">
        <span className="absolute inset-y-0 rounded-full bg-surface-2 ring-1 ring-line-strong/60" style={{ left: at(USUAL[0]), width: `calc(${at(USUAL[1])} - ${at(USUAL[0])})` }} />
        <span className={clsx("absolute -top-1.5 h-4 w-0.5 -translate-x-1/2 rounded-full", done ? "bg-pay" : "bg-text", styles.tick)} style={{ left: at(elapsed) }} />
      </div>
      <div className="flex justify-between font-mono text-micro text-faint tabular-nums">
        <span>0s</span>
        <span>{scale}s</span>
      </div>
    </div>
  );
}

const STAGES: { id: string; label: string; at: string[] }[] = [
  { id: "received", label: "Photos received", at: ["photos_received"] },
  { id: "pre", label: "Three checks with no AI", at: ["prechecked", "blocked"] },
  { id: "model", label: "The photo check (GPT-6.1 Sol)", at: ["checked"] },
  { id: "rule", label: "The rule decides", at: ["decided", "blocked"] },
  { id: "paypal", label: "Sent through PayPal", at: ["payout_sent"] },
];

/** The claim's own stages with their times relative to the photos arriving (Wise's transfer tracker). */
function Stages({ timeline, decision }: { timeline: TimelineEvent[]; decision: ClaimView["decision"] }) {
  const t0 = timeline.find((e) => e.type === "photos_received")?.at;
  const time = (types: string[]) => timeline.find((e) => types.includes(e.type))?.at;
  const decided = decision !== "pending";
  const current = STAGES.findIndex((s) => !time(s.at));
  return (
    <ol aria-label="Where your claim is" className="relative flex flex-col gap-2.5 before:absolute before:top-2 before:bottom-2 before:left-[3.5px] before:w-px before:bg-line">
      {STAGES.map((s, i) => {
        const at = time(s.at);
        const stop = decision === "blocked" && s.id === "pre";
        const skipped = !at && decided;
        const live = !at && !decided && i === current;
        const rel = at && t0 ? `+${Math.max(0, (Date.parse(at) - Date.parse(t0)) / 1000).toFixed(1)}s` : null;
        return (
          <li key={s.id} className="relative grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center text-ui">
            <span
              aria-hidden="true"
              className={clsx(
                "relative size-2 rounded-full",
                at ? (stop ? "bg-stop" : "bg-pay") : live ? clsx("bg-text text-text", styles.pulse) : "border border-line-strong bg-bg",
              )}
            />
            <span className={clsx(at || live ? "text-text" : "text-faint")}>
              {s.label}
              <span className="sr-only">{at ? (stop ? ": stopped here" : ": done") : live ? ": now" : skipped ? ": not run" : ": next"}</span>
            </span>
            <span className="font-mono text-micro text-faint tabular-nums">{rel ?? (skipped ? "not run" : live ? "now" : "")}</span>
          </li>
        );
      })}
    </ol>
  );
}
