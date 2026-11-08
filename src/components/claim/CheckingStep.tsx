"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CheckSpec } from "@/lib/types";
import { CheckList, outcomeWord, sixRows, type SixRow } from "./CheckList";
import { ClaimPhotos } from "./ClaimPhotos";
import { CHECK_GRID, OutcomeHead, WIDE_ONLY } from "./Exhibit";
import styles from "./flow.module.css";
import { cutInHalf, handWrittenLabel, isDecided, nounOf, type ClaimView } from "./model";
import { PAID_TITLE } from "./ReceiptLive";

// Each row resolves on its own beat, one after another, in reduced motion too: there it is a plain swap. The camera's
// pre-checks are quick; the photo check's answers, and the refund after them, get a beat each to be read.
const PRE_MS = 420;
const STEP_MS = 650;
// Only a wait this long earns "you can close this page".
const SAVED_S = 10;
// The finished list stays up this long before the result replaces it.
const HOLD_MS = 1500;
// Each poll reads the claim from the store, and those reads are capped per month.
const POLL_MS = 2000;
// Past this, the screen says it's taking longer than usual.
const SLOW_S = 40;

const firstWaiting = (rows: SixRow[]) => {
  const i = rows.findIndex((r) => r.state === "waiting");
  return i < 0 ? rows.length : i;
};

/** "0:04": mono, so the digits never jump. */
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export interface CheckingStepProps {
  claimId: string;
  view: ClaimView;
  spec: CheckSpec;
  /** "$29.99", for the refund row. */
  amount: string;
  /** The server clock at render (ms). */
  startNow: number;
  /** The photos sent, in order (local copies, or the sample's); else the owner's photo route for each. */
  photoUrls?: string[];
  /** The photos are still on their way up: nothing has resolved yet. */
  sending?: boolean;
  /** Dev previews: no polling, no refresh, every known row shown, and a fixed elapsed time. */
  preview?: { elapsed?: number; offline?: boolean };
  /** "Kikea Store", for a held claim's headline. */
  company?: string;
  /** Every row has resolved: the step meter moves on to the refund. */
  onSettled?(): void;
}

/**
 * The moment the claim is proved: the photo, and the five checks and the refund resolving one by one where the eye
 * already is. On a phone (or a short screen) the photo is a 72px thumbnail beside the title, so every row is on the
 * first screen; from 1024px it sits whole beside the list. Once decided, the rows land in order, the finished list
 * holds for a moment, and the page re-renders as the result.
 */
export function CheckingStep({ claimId, view: initial, spec, amount, startNow, photoUrls, sending, preview, company = "The company", onSettled }: CheckingStepProps) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [offline, setOffline] = useState(preview?.offline ?? false);
  // The server clock at render first, so server and client paint the same seconds.
  const [now, setNow] = useState(startNow);

  // A new answer from the parent (the upload's response) replaces the local one.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setView(initial);
  }

  const decided = isDecided(view.decision);
  const all = sixRows(view.rows, { code: view.code, noun: nounOf(spec), cut: cutInHalf(spec), decided, held: view.decision === "held", demo: view.demo, photos: Math.max(view.photos, photoUrls?.length ?? 0), written: handWrittenLabel(spec) });
  const known = sending ? 0 : firstWaiting(all);
  const [shown, setShown] = useState(preview ? known : 0);
  const done = decided && shown >= all.length;
  // Once a check has failed, nothing after it is pending: every later row (and the refund, not sent) lands with it.
  const failAt = decided ? all.findIndex((r) => r.state === "reject" || r.state === "blocked") : -1;

  useEffect(() => {
    if (shown >= known) return;
    const t = setTimeout(() => setShown((s) => (failAt >= 0 && s >= failAt ? all.length : s + 1)), shown < 3 ? PRE_MS : STEP_MS);
    return () => clearTimeout(t);
  }, [shown, known, failAt, all.length]);

  useEffect(() => {
    if (done) onSettled?.();
  }, [done, onSettled]);

  // The row being checked stays on screen: a phone scrolls it up when it would fall below the fold.
  useEffect(() => {
    if (preview) return;
    const el = document.querySelector<HTMLElement>(`[data-row="${all[Math.min(shown, all.length - 1)]?.key}"]`);
    if (!el) return;
    const { top, bottom } = el.getBoundingClientRect();
    if (top < 0 || bottom > window.innerHeight) el.scrollIntoView({ block: "nearest" });
    // Only when the active row changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, preview]);

  // The elapsed clock, 4 times a second, until the checks are done.
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
    const t = setTimeout(() => router.refresh(), HOLD_MS);
    return () => clearTimeout(t);
  }, [done, preview, router]);

  const rows: SixRow[] = all.map((r, i) =>
    i < shown ? r : i === shown && !done && !sending ? { key: r.key, name: r.name, label: r.label, state: "running" } : { key: r.key, name: r.name, label: r.label, state: "waiting" },
  );
  // Seconds since the photos arrived, from the claim's own event, so a reload keeps counting. Until that is known (the
  // photos are still on their way from another device) there is no count, rather than one from when this page opened.
  const received = view.timeline.find((e) => e.type === "photos_received")?.at;
  const elapsed = preview?.elapsed ?? (received ? Math.max(0, (now - Date.parse(received)) / 1000) : null);
  const srcs = photoUrls?.length ? photoUrls : Array.from({ length: view.photos }, (_, i) => `/api/claims/${claimId}/photos/${i + 1}`);
  const count = Math.max(view.photos, srcs.length);

  // Once every row has landed the headline is the outcome, in the result's own words, so the result arrives under it.
  const title = sending
    ? `Sending your ${count > 1 ? "photos" : "photo"}`
    : done
      ? view.decision === "paid"
        ? PAID_TITLE.sent
        : view.decision === "held"
          ? `A person at ${company.replace(/ /g, "\u00a0")} will check this claim`
          : "We couldn't pay this claim"
      : `Checking your ${count > 1 ? "photos" : "photo"}`;
  // Said only when the wait is long enough that someone might want to leave; never once the claim is decided.
  const lead =
    decided || elapsed === null || elapsed <= SAVED_S
      ? ""
      : elapsed > SLOW_S
        ? "Taking longer than usual. Your claim is saved, and a person checks it if the photo check doesn't answer."
        : "Your claim is saved. You can close this page.";

  // One line for a screen reader, rewritten as each row lands: the list itself stays quiet. Checks are named, never
  // numbered: nothing on screen numbers them.
  const last = shown > 0 ? all[Math.min(shown, all.length) - 1] : null;
  const checks = all.filter((r) => r.key !== "refund").length;
  const spoken = done
    ? view.decision === "paid"
      ? `All ${checks} checks passed. ${amount} refund sent to your PayPal.`
      : view.decision === "held"
        ? "Claim for review."
        : "Not paid."
    : last && last.key !== "refund"
      ? `${last.name[0].toUpperCase()}${last.name.slice(1)}: ${outcomeWord(last).toLowerCase() || "done"}.`
      : "";

  // Tall laptops (lg and over 600px high): the photo whole, beside the list. Phones and short screens: a thumbnail beside
  // the headline. The result keeps this layout, so nothing moves when the outcome lands.
  return (
    <section aria-labelledby="checking-title" className={CHECK_GRID}>
      <div className={clsx(WIDE_ONLY, "sticky top-8 min-w-0 flex-col gap-4")}>
        <ClaimPhotos urls={srcs} claimId={view.id} />
      </div>

      <div className="flex min-w-0 flex-col gap-5 [@media(max-height:600px)]:gap-3">
        <OutcomeHead
          id="checking-title"
          thumb={srcs[0]}
          small
          title={
            <span key={title} className={clsx("block", styles.swap)}>
              {title}
            </span>
          }
          lead={lead || undefined}
          aside={
            elapsed !== null &&
            !done && (
              <span className="self-start pt-2 font-mono text-ui text-faint" aria-hidden="true">
                {clock(elapsed)}
              </span>
            )
          }
        />

        {offline && (
          <p role="status" className="rounded-control border border-line bg-surface-2 px-3 py-2.5 text-ui text-muted">
            Lost the connection for a moment. Your claim is still being checked; this page catches up when you&apos;re back online.
          </p>
        )}

        <CheckList rows={rows} label={`Checks for claim ${view.id}`} amount={amount} live />
        <p role="status" className="sr-only">
          {spoken}
        </p>
      </div>
    </section>
  );
}
