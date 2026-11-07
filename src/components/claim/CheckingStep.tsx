"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui";
import { CheckList } from "./CheckList";
import { ModelQuote } from "./EvidenceText";
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
  /** The photos sent, in order (local copies, or the sample's); else the owner's photo route for each. */
  photoUrls?: string[];
  /** A judges' sample: the photo carries its AI-made label. */
  sample?: boolean;
  /** The photos are still on their way up: nothing has resolved yet. */
  sending?: boolean;
  /** Dev previews: no polling, no refresh, every known row shown, and a fixed elapsed time. */
  preview?: { elapsed?: number; offline?: boolean };
}

/**
 * The trust screen: photo 1 beside the checks, held in view while they run, with the model's quotes numbered under it.
 * While the model reads the photo an amber line scans it; an honest time line shows the elapsed seconds against the
 * usual 15 to 40 (never a percentage); each check group's header carries its time from the claim's own events. Once
 * decided, the checks reveal in order and the page re-renders as the result.
 */
export function CheckingStep({ claimId, view: initial, startNow, photoUrls, sample, sending, preview }: CheckingStepProps) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [shown, setShown] = useState(preview ? firstWaiting(initial.rows) : 0);
  const [offline, setOffline] = useState(preview?.offline ?? false);
  // The server clock at render first, so server and client paint the same seconds.
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

  // Photos sent from another device but not read yet (the arrival's read failed): ask at once rather than in 2 s.
  const unseen = initial.photos === 0;
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
    t = setTimeout(tick, unseen ? 0 : delay);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [claimId, decided, preview, sending, unseen]);

  useEffect(() => {
    if (!done || preview) return;
    const t = setTimeout(() => router.refresh(), reduced ? 300 : 1200);
    return () => clearTimeout(t);
  }, [done, preview, reduced, router]);

  const rows: CheckRow[] = view.rows.map((r, i) =>
    i < shown ? r : i === shown && !done ? { ...r, state: "running", detail: undefined, quote: undefined } : { ...r, state: "waiting", detail: undefined, quote: undefined },
  );
  const reading = !sending && !decided && view.photos > 0 && rows.some((r) => r.group === "model" && (r.state === "running" || r.state === "waiting"));
  // Seconds since the photos arrived, from the claim's own event, so a reload keeps counting. Until that is known (the
  // photos are still on their way from another device) there is no count, rather than one from when this page opened.
  const received = view.timeline.find((e) => e.type === "photos_received")?.at;
  const elapsed = preview?.elapsed ?? (received ? Math.max(0, (now - Date.parse(received)) / 1000) : null);
  const blocked = view.decision === "blocked";
  const srcs = photoUrls?.length ? photoUrls : Array.from({ length: view.photos }, (_, i) => `/api/claims/${claimId}/photos/${i + 1}`);
  const src = srcs[0];
  const count = Math.max(view.photos, srcs.length);
  // The model's quotes for the annotations under photo 1: only the answers already revealed.
  const notes = rows.filter((r) => r.group === "model" && r.quote && r.state !== "running" && r.state !== "waiting");
  // A sample (or a preview's stand-in from /demo, which only holds AI-made samples) carries its label on the photo.
  const aiMade = Boolean(sample) || Boolean(src?.startsWith("/demo/"));

  const title = sending ? "Sending your photos" : done ? "Checks finished" : `Checking your ${count > 1 ? "photos" : "photo"}`;
  const lead = sending
    ? "Uploading over a secure connection."
    : done
      ? "Opening your result."
      : elapsed !== null && elapsed > USUAL[1] && !decided
        ? "Taking longer than usual. Nothing is lost: your claim is saved, and a person looks at it if the check doesn't answer."
        : "Usually 15 to 40 seconds. Your claim is saved, so you can close this page.";

  return (
    <section aria-labelledby="checking-title" aria-busy={!done} className="mx-auto grid w-full max-w-[60rem] gap-8 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-start lg:gap-14">
      <div className="flex flex-col gap-3 lg:sticky lg:top-24">
        {src ? (
          // Whole: the photo being checked shows all of it, so a tag near a tall photo's edge stays in view.
          <ExhibitPhoto src={src} alt={`Photo 1: the ${sample ? "sample" : "first"} photo of claim ${view.id}`} sample={aiMade} fit="contain" frame="h-60 lg:h-[21rem]">
            {reading && !reduced && (
              <span aria-hidden="true" className={clsx("absolute inset-0", styles.scan)}>
                <span className={styles.scanLine} />
              </span>
            )}
            {reading && (
              <GlassChip className="absolute top-2 right-2">
                {reduced && elapsed !== null ? (
                  <>
                    Reading the photo… <span className="normal-case">{Math.floor(elapsed)}s</span>
                  </>
                ) : (
                  "Reading the photo"
                )}
              </GlassChip>
            )}
          </ExhibitPhoto>
        ) : (
          <div className="flex h-60 items-center justify-center rounded-control border border-dashed border-line-strong text-ui text-faint lg:aspect-[3/4] lg:h-auto">Your photos are on their way</div>
        )}
        {/* Every photo sent, numbered as the camera numbered them, so each one is seen to have arrived. */}
        {srcs.length > 1 && (
          <ul aria-label={`${srcs.length} photos received`} className="flex gap-2.5">
            {srcs.map((s, i) => (
              <li key={`${s}-${i}`} className="relative size-14 shrink-0 rounded-control bg-paper p-[2px] shadow-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s} alt={`Photo ${i + 1}`} className="size-full rounded-[3px] bg-surface-2 object-contain" />
                <span aria-hidden="true" className="absolute bottom-[3px] left-[3px] flex size-4 items-center justify-center rounded-[3px] bg-paper font-mono text-[10px] leading-none font-medium text-ink">
                  {i + 1}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="font-mono text-micro text-faint">
          {count > 1 ? `${count} photos` : "Photo 1"} · claim {view.id} · code {view.code}
        </p>
        {/* Laptops: what the model quoted from the photo, numbered under it as each answer arrives. Phones keep the quotes
            in the checklist, under the photo already. */}
        {notes.length > 0 && (
          <ol aria-label="What the model read in photo 1" className="hidden flex-col gap-2.5 border-t border-line pt-3 lg:flex">
            {notes.map((r, i) => (
              <li key={r.id} className={clsx("grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-1 text-ui", styles.rise)}>
                <span aria-hidden="true" className="mt-0.5 flex size-5 items-center justify-center rounded-full border border-line-strong font-mono text-[10px] leading-none text-muted">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-text">{r.label}</span>
                  <q className="line-clamp-2 text-ui leading-[1.55] text-muted">
                    <ModelQuote>{r.quote ?? ""}</ModelQuote>
                  </q>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <StepTitle id="checking-title">{title}</StepTitle>
            {elapsed !== null && (
              <span className="font-mono text-ui text-faint tabular-nums" aria-hidden="true">
                {Math.floor(elapsed)}s
              </span>
            )}
          </div>
          <p className="text-body text-muted" aria-live="polite">
            {lead}
          </p>
        </div>

        {!sending && !blocked && elapsed !== null && <TimeLine elapsed={elapsed} done={decided} />}

        {offline && (
          <p role="status" className="rounded-control border border-line bg-surface-2 px-3 py-2.5 text-ui text-muted">
            Lost the connection for a moment. Your claim is still being checked; this page catches up when you&apos;re back online.
          </p>
        )}

        <Card padding="md">
          <CheckList rows={rows} label={`Checks for claim ${view.id}`} code={view.code} times={sending ? undefined : groupTimes(view.timeline, rows)} quoteClassName="lg:hidden" />
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

/**
 * Each check group's time since the photos arrived, from the claim's own events, for the group headers ("+0.4s"); "now"
 * for the group being run. The pipeline saves "decided" after the payout it allowed, so the refund's time is the payout's.
 */
function groupTimes(timeline: TimelineEvent[], rows: CheckRow[]): Partial<Record<CheckRow["group"], string>> {
  const t0 = timeline.find((e) => e.type === "photos_received")?.at;
  const at = (types: string[]) => timeline.filter((e) => types.includes(e.type)).map((e) => e.at).sort()[0];
  const rel = (a: string | undefined) => (a && t0 ? `+${Math.max(0, (Date.parse(a) - Date.parse(t0)) / 1000).toFixed(1)}s` : undefined);
  const now = (g: CheckRow["group"]) => (rows.some((r) => r.group === g && r.state === "running") ? "now" : undefined);
  return {
    pre: rel(at(["prechecked", "blocked"])) ?? now("pre"),
    model: rel(at(["checked"])) ?? now("model"),
    pay: rel(at(["payout_sent"])) ?? now("pay"),
  };
}
