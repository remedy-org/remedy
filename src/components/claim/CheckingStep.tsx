"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui";
import { CheckList } from "./CheckList";
import { isDecided, type CheckRow, type ClaimView } from "./model";

// Each check appears as it resolves, one after another, rather than all at once.
const STEP_MS = 420;
// Each poll reads the claim from the store, and those reads are capped per month.
const POLL_MS = 2000;

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
  /** The photos are still on their way up: nothing has resolved yet. */
  sending?: boolean;
  /** Dev previews: no polling, no refresh, every known row shown, and a fixed elapsed time. */
  preview?: { elapsed?: number; offline?: boolean };
}

/** Polls the claim and reveals each check in order; once decided, the page re-renders as the result. */
export function CheckingStep({ claimId, view: initial, sending, preview }: CheckingStepProps) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [shown, setShown] = useState(preview ? firstWaiting(initial.rows) : 0);
  const [offline, setOffline] = useState(preview?.offline ?? false);
  const [elapsed, setElapsed] = useState(preview?.elapsed ?? 0);
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

  useEffect(() => {
    if (preview) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [preview]);

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
  const modelRunning = !sending && rows.some((r) => r.group === "model" && r.state === "running") && known <= shown;

  return (
    <Card padding="lg" as="section" aria-labelledby="checking-title" aria-busy={!done} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="checking-title" className="text-h2 font-semibold">
            {sending ? "Sending your photos" : done ? "Checks finished" : "Checking your photos"}
          </h2>
          <span className="font-mono text-ui text-faint tabular-nums" aria-hidden="true">
            {elapsed}s
          </span>
        </div>
        <p className="text-body text-muted" aria-live="polite">
          {sending
            ? "Uploading over a secure connection."
            : done
              ? "Opening your result."
              : modelRunning
                ? "The photo check reads the label, the cut and your code. Usually 15 to 40 seconds."
                : "Your claim is saved. You can close this page and come back to it."}
        </p>
      </div>

      {offline && (
        <p role="status" className="rounded-control border border-line bg-surface-2 px-3 py-2.5 text-ui text-muted">
          Lost the connection for a moment. Your claim is still being checked; this page catches up when you&apos;re back online.
        </p>
      )}

      <CheckList rows={rows} label={`Checks for claim ${view.id}`} />

      {view.decision === "blocked" && shown >= view.rows.length && (
        <p className="text-ui text-muted">The photos never reached the photo check: a claim that fails these first checks stops here.</p>
      )}
    </Card>
  );
}
