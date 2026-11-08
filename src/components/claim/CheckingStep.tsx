"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AlertIcon } from "@/components/ui";
import type { CheckSpec } from "@/lib/types";
import { CheckList, outcomeWord, sixRows, type SixRow } from "./CheckList";
import { ClaimPhotos } from "./ClaimPhotos";
import { ClaimLayout, OutcomeHead } from "./Exhibit";
import styles from "./flow.module.css";
import { cutInHalf, handWrittenLabel, isDecided, money, nounOf, type ClaimView } from "./model";
import { RefundRow } from "./Receipt";
import { PAID_TITLE } from "./ReceiptLive";
import { settleClaim } from "./settle";

// Each row resolves on its own beat, one after another, in reduced motion too: there it is a plain swap. The camera's
// pre-checks are quick; the photo check's answers, and the refund after them, get a beat each to be read. Short enough
// that the receipt prints within about a second of the payout it shows.
const PRE_MS = 300;
const STEP_MS = 400;
// Only a wait this long earns "you can close this page".
const SAVED_S = 10;
// If the result can't be had in place, the finished list stays up this long before the page reloads as the result.
const HOLD_MS = 1200;
// Each poll reads the claim from the store, and those reads are capped per month: every second while a photo check
// usually answers, then every 2 s.
const POLL_MS = 2000;
const FAST_POLL_MS = 1000;
const FAST_FOR_MS = 20_000;
// Past this, the screen says it's taking longer than usual.
const SLOW_S = 40;

const firstWaiting = (rows: SixRow[]) => {
  const i = rows.findIndex((r) => r.state === "waiting");
  return i < 0 ? rows.length : i;
};

/** "0:04": mono, so the digits never jump. */
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export interface CheckingStepProps {
  /** The recall's slug: the result is asked for by it. */
  slug: string;
  claimId: string;
  view: ClaimView;
  spec: CheckSpec;
  /** The refund, for the refund row. */
  refund: { value: string; currency: string };
  /** The server clock at render (ms). */
  startNow: number;
  /** The photos sent, in order (local copies, or the sample's); else the owner's photo route for each. */
  photoUrls?: string[];
  /** The photos are still on their way up: nothing has resolved yet. */
  sending?: boolean;
  /**
   * Dev previews: no polling, no refresh, every known row shown, and a fixed elapsed time. `animate` lands the known rows
   * one by one as a live claim does, then opens `next` (the result's preview) after the hold.
   */
  preview?: { elapsed?: number; offline?: boolean; animate?: boolean; next?: string };
  /** "Kikea Store", for a held claim's headline. */
  company?: string;
}

/**
 * The moment the claim is proved: the photo, and the five checks and the refund resolving one by one where the eye
 * already is. On a phone (or a short screen) the photo is a 72px thumbnail beside the title, so every row is on the
 * first screen; from 1024px it sits whole beside the list. Once decided, the rows land in order, the finished list
 * holds for a moment, and the page re-renders as the result.
 */
export function CheckingStep({ slug, claimId, view: initial, spec, refund, startNow, photoUrls, sending, preview, company = "The company" }: CheckingStepProps) {
  const router = useRouter();
  // The result, rendered by the server as its page renders it, asked for as soon as the decision is in: it replaces this
  // screen when the last check lands, in one change. "failed": it couldn't be had here, so the page reloads as it.
  const [settled, setSettled] = useState<ReactNode | "failed" | null>(null);
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
  const [shown, setShown] = useState(preview && !preview.animate ? known : 0);
  const done = decided && shown >= all.length;
  // Once a check has failed, nothing after it is pending: every later row (and the refund, not sent) lands with it.
  const failAt = decided ? all.findIndex((r) => r.state === "reject" || r.state === "blocked") : -1;

  useEffect(() => {
    if (shown >= known) return;
    const t = setTimeout(() => setShown((s) => (failAt >= 0 && s >= failAt ? all.length : s + 1)), shown < 3 ? PRE_MS : STEP_MS);
    return () => clearTimeout(t);
  }, [shown, known, failAt, all.length]);

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
    const start = Date.now();
    const pace = () => (Date.now() - start < FAST_FOR_MS ? FAST_POLL_MS : POLL_MS);
    let delay = pace();
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
        delay = pace();
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

  // The decision is in: the result is fetched while the last rows land.
  useEffect(() => {
    if (!decided || preview) return;
    let stopped = false;
    settleClaim(slug, claimId)
      .then((node) => !stopped && setSettled(node ?? "failed"))
      .catch(() => !stopped && setSettled("failed"));
    return () => {
      stopped = true;
    };
  }, [decided, preview, slug, claimId]);

  // Dev previews open the result's preview; a result that couldn't be had in place comes with a reload.
  useEffect(() => {
    if (!done || (preview ? !preview.next : settled !== "failed")) return;
    const next = preview?.next;
    const t = setTimeout(() => (next ? router.push(next) : router.refresh()), HOLD_MS);
    return () => clearTimeout(t);
  }, [done, preview, router, settled]);

  const rows: SixRow[] = all.map((r, i) =>
    i < shown ? r : i === shown && !done && !sending ? { key: r.key, name: r.name, label: r.label, state: "running" } : { key: r.key, name: r.name, label: r.label, state: "waiting" },
  );
  // Seconds since the photos arrived, from the claim's own event, so a reload keeps counting. Until that is known (the
  // photos are still on their way from another device) there is no count, rather than one from when this page opened.
  const received = view.timeline.find((e) => e.type === "photos_received")?.at;
  const elapsed = preview?.elapsed ?? (received ? Math.max(0, (now - Date.parse(received)) / 1000) : null);
  const srcs = photoUrls?.length ? photoUrls : Array.from({ length: view.photos }, (_, i) => `/api/claims/${claimId}/photos/${i + 1}`);
  const count = Math.max(view.photos, srcs.length);

  // Every row has landed and the result is here: it takes the screen in one change (the receipt prints, or the way on
  // comes in), and nothing redraws after it.
  if (done && settled && settled !== "failed") return <>{settled}</>;
  // Without the result in place (a preview, or it couldn't be had), the headline is the outcome, in the result's words.
  const outcome = done && (preview || settled === "failed");
  const title = sending
    ? `Sending your ${count > 1 ? "photos" : "photo"}`
    : outcome
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

  // One line for a screen reader, rewritten as each row lands (role="status", so it waits its turn): the check, its
  // outcome and its reason. The list itself stays quiet. Checks are named, never numbered: nothing on screen numbers them.
  const last = shown > 0 ? all[Math.min(shown, all.length) - 1] : null;
  const checks = all.filter((r) => r.key !== "refund").length;
  const amount = money(refund);
  const spoken = outcome
    ? view.decision === "paid"
      ? `All ${checks} checks passed. ${amount} refund sent to your PayPal.`
      : view.decision === "held"
        ? `A person will check this claim. ${amount} not sent yet.`
        : `Not paid. ${amount} not sent.`
    : last && last.key !== "refund"
      ? `${last.name[0].toUpperCase()}${last.name.slice(1)}: ${outcomeWord(last).toLowerCase()}. ${last.because ?? last.detail ?? ""}`.trim()
      : "";
  const refundRow = rows.find((r) => r.key === "refund");

  // Tall laptops: the headline and the refund on the left, the photo and the checks on the right. Phones and short
  // screens: the headline with a thumbnail, the checks, then the refund. The result keeps this layout, so nothing moves
  // when the outcome lands; a paid result prints the receipt out of the refund row.
  return (
    <ClaimLayout
      labelledBy="checking-title"
      head={
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
              // A 320px phone gives the headline the room: the rows themselves show the progress.
              <span className="self-start pt-2 font-mono text-ui text-faint max-[25rem]:hidden" aria-hidden="true">
                {clock(elapsed)}
              </span>
            )
          }
        />
      }
      checks={
        <>
          <CheckList rows={rows} label={`Checks for claim ${view.id}`} live />
          <p role="status" className="sr-only">
            {spoken}
          </p>
        </>
      }
      photo={<ClaimPhotos urls={srcs} claimId={view.id} />}
      outcome={
        <>
          {offline && (
            <p role="status" className="flex gap-2.5 text-ui text-muted">
              <AlertIcon className="mt-0.5 shrink-0" />
              <span>Lost the connection for a moment. Your claim is still being checked; this page catches up when you&apos;re back online.</span>
            </p>
          )}
          {refundRow && <RefundRow amount={refund} state={refundRow.state} />}
        </>
      }
    />
  );
}
