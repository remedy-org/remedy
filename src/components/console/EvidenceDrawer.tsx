"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button, CrossIcon, ErrorState, Skeleton } from "@/components/ui";
import type { ApiError } from "@/app/console/_lib/api";
// The model's words set as the owner's pages set them: curly quotes, codes in mono.
import { ModelQuote } from "@/components/claim/EvidenceText";
import type { DrawerClaim, ReviewedClaim } from "@/app/console/_lib/drawer";
import { duration, NO_PAYOUT, type ClaimRow } from "@/app/console/_lib/view";
import { api } from "./api";
import { DurationText, EXCEPTION } from "./cells";
import { DrawerSkeleton, RowAmount, RowMeta, RowVerdict } from "./EvidenceShell";
import { CheckList } from "./CheckList";
import { EvidencePhoto } from "./EvidencePhoto";
import { formatClock, formatTime } from "./format";
import { Keys } from "./Keys";
import { LinkedIds } from "./LinkedIds";
import { PhotoViewer } from "./PhotoViewer";
import { payoutFailure, ReviewActions, reviewLabels, type ReviewIntent } from "./ReviewActions";
import { keepStarterDecision, starterDecision } from "./starterDecisions";
import { VerdictMark, verdictOf } from "./VerdictMark";

export { DrawerSkeleton };

// The evidence for one claim: on laptops a non-modal panel docked beside the grid (Mercury's detail card), so ↑/↓
// keeps walking the queue; on phones and tablets a full-screen modal. Both show the same content: the money's
// timeline, the photos, the pre-checks, every photo-check answer with its quoted evidence, the rule's decision, then
// approve or reject for held claims.

export interface EvidenceProps {
  claimId: string | null;
  // The claim's grid row: the header draws from it the moment the panel opens, before the evidence loads.
  row?: ClaimRow | null;
  // A decision just made on the claim before this one, said in the header for 2 s ("RM-5250 approved · $29.99 sent").
  notice?: string | null;
  // V or Space from the queue: opens the photo viewer at the first photo each time it changes.
  viewPhotos?: number;
  // The grid row's version: the panel asks for the claim at it, which the server caches (Blob budget).
  version?: number | null;
  // The grid row's filed time: part of that cache's key, so a claim id the demo data reused never shows an older claim.
  filedAt?: string;
  onClose: () => void;
  // A held claim's approve or reject, opened from the keyboard (A / R).
  intent?: ReviewIntent | null;
  // Opens another claim of the queue (the claim a repost copied, the next held claim).
  onOpen?: (id: string) => void;
  // A person approved or rejected this claim (ClaimsQueue works out the next held one). claim: what was decided.
  onDecided?: (id: string, decision: DrawerClaim["decision"], claim?: { sample?: boolean; amount?: string } | null) => void;
  // After a decision: the next held claim in the list, null when none is left, undefined before.
  nextHeld?: string | null;
  // The claim this one was opened from through a link in its evidence: the header offers the way back.
  back?: string | null;
  onBack?: () => void;
}

// Claims this page view already loaded, by id and version: walking back up the queue costs nothing.
const seen = new Map<string, DrawerClaim>();
const seenKey = (id: string, version: number | null | undefined) => `${id}@${version ?? "latest"}`;

type Load = { state: "loading" } | { state: "error"; error: ApiError } | { state: "ready" };

/** Loads a claim, keeping the one shown before on screen until the next arrives (no skeleton flash between rows). */
function useClaim(id: string, version: number | null | undefined, filedAt: string | undefined) {
  const key = seenKey(id, version);
  // A starter claim this tab decided: the evidence as decided (starterDecisions.ts), never the shared held one.
  const local = starterDecision(id);
  if (local && seen.get(key) !== local) seen.set(key, local);
  // Bumped when a fetch lands in `seen`, so this renders again.
  const [, setLanded] = useState(0);
  const [failure, setFailure] = useState<{ key: string; error: ApiError } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The last claim shown, kept on screen (dimmed) while the next one loads.
  const [last, setLast] = useState<DrawerClaim | null>(null);
  const hit = seen.get(key) ?? null;
  if (hit && hit !== last) setLast(hit);
  // The same claim at an older version (a poll, or a refused payout, moved it on) stays on screen, footer and all, while
  // the new version loads: a message under the buttons survives, and nothing flashes to a skeleton.
  const current = hit ?? (last?.id === id ? last : null);

  useEffect(() => {
    if (seen.has(key)) return;
    let live = true;
    api<DrawerClaim>(`/api/console/claims/${id}${version ? `?v=${version}${filedAt ? `&at=${encodeURIComponent(filedAt)}` : ""}` : ""}`).then((res) => {
      if (!live) return;
      if (res.ok) {
        seen.set(key, res.data);
        setLanded((n) => n + 1);
      } else setFailure({ key, error: res.error });
    });
    return () => {
      live = false;
    };
  }, [id, version, filedAt, key, attempt]);

  const load: Load = current ? { state: "ready" } : failure?.key === key ? { state: "error", error: failure.error } : { state: "loading" };
  return {
    claim: current,
    stale: !current && last ? last : null,
    load,
    retry: () => {
      setFailure(null);
      setAttempt((a) => a + 1);
    },
    replace: (c: DrawerClaim) => {
      seen.set(key, c);
      setLanded((n) => n + 1);
    },
  };
}

/** Laptops: an aside beside the grid. No backdrop, the grid stays live; Esc closes it (ClaimsQueue returns focus). */
export function EvidencePanel({ claimId, row, notice, viewPhotos, version, filedAt, onClose, intent, onOpen, onDecided, nextHeld, back, onBack }: EvidenceProps) {
  if (!claimId) return null;
  return (
    <aside
      role="complementary"
      aria-label={`Evidence for ${claimId}`}
      className="evidence-panel flex h-full w-full shrink-0 flex-col overflow-hidden rounded-card bg-surface shadow-float"
    >
      <EvidenceContent
        id={claimId}
        row={row}
        notice={notice}
        viewPhotos={viewPhotos}
        version={version}
        filedAt={filedAt}
        onClose={onClose}
        intent={intent}
        onOpen={onOpen}
        onDecided={onDecided}
        nextHeld={nextHeld}
        back={back}
        onBack={onBack}
        variant="panel"
      />
    </aside>
  );
}

/** Phones and tablets: a full-screen modal dialog (a sheet from the right on tablets). */
export function EvidenceDrawer({ claimId, row, viewPhotos, version, filedAt, onClose, intent, onOpen, onDecided, nextHeld, back, onBack }: EvidenceProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (claimId && !d.open) d.showModal();
    // Another claim in the open sheet (the next held one): focus starts at its heading, as on opening.
    else if (claimId) d.querySelector<HTMLElement>("#drawer-title")?.focus();
    if (!claimId && d.open) d.close();
  }, [claimId]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself.
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      aria-labelledby="drawer-title"
      className="evidence-panel evidence-sheet fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-surface p-0 text-text shadow-float transition-[translate,opacity] duration-240 ease-snap backdrop:bg-[oklch(0.1_0.004_75/0.6)] starting:translate-x-6 starting:opacity-0 sm:w-[min(36rem,100vw)] sm:rounded-l-card"
    >
      {claimId && (
        <EvidenceContent
          key={claimId}
          id={claimId}
          row={row}
          viewPhotos={viewPhotos}
          version={version}
          filedAt={filedAt}
          onClose={() => ref.current?.close()}
          intent={intent}
          onOpen={onOpen}
          onDecided={onDecided}
          nextHeld={nextHeld}
          back={back}
          onBack={onBack}
          variant="sheet"
        />
      )}
    </dialog>
  );
}

function EvidenceContent({
  id,
  row,
  notice,
  viewPhotos,
  version,
  filedAt,
  onClose,
  intent,
  onOpen,
  onDecided,
  nextHeld,
  back,
  onBack,
  variant,
}: Omit<EvidenceProps, "claimId"> & { id: string; variant: "panel" | "sheet" }) {
  const router = useRouter();
  const { claim, stale, load, retry, replace } = useClaim(id, version, filedAt);
  // The decision this view just saved: said in the footer, which then offers the next held claim.
  const [saved, setSaved] = useState<{ id: string; decision: DrawerClaim["decision"]; at: string } | null>(null);
  const done = (c: ReviewedClaim) => {
    // Another claim's evidence may now read differently (approving this one makes the account's other claim stop on
    // approve, rejecting it frees it): every claim loads afresh from here.
    seen.clear();
    // A starter claim's decision is kept in this tab (the shared record stays held); nothing else needs reloading.
    if (c.seeded) keepStarterDecision(c);
    replace(c);
    setSaved({ id: c.id, decision: c.decision, at: new Date().toISOString() });
    onDecided?.(c.id, c.decision, { sample: Boolean(c.sample), amount: c.amount });
    if (!c.seeded) router.refresh();
  };
  const heading = useRef<HTMLHeadingElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const savedFooter = useRef<HTMLElement>(null);
  const justSaved = saved?.id === id && !claim?.review ? saved : null;
  // The buttons that had focus are gone with the decision: focus goes to the next claim's button, else the heading,
  // never to the page, where the next letter typed would be a shortcut.
  useEffect(() => {
    if (!justSaved) return;
    // Back to the top, where the box now says what was decided (the reject form had scrolled to the photos).
    scroller.current?.scrollTo({ top: 0 });
    (savedFooter.current?.querySelector("button") ?? heading.current)?.focus();
  }, [justSaved, nextHeld]);
  // The reject form takes the footer's room: the photos it is about come into view above it.
  const photos = useRef<HTMLElement>(null);
  // The footer's open form, so the key line says what A and Enter do now.
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const onMode = useCallback((mode: "idle" | "approve" | "reject") => {
    setMode(mode);
    // Scrolled within the panel only: scrollIntoView would scroll the page under it too.
    if (mode === "reject")
      requestAnimationFrame(() => {
        const box = scroller.current;
        const el = photos.current;
        if (box && el) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top;
      });
  }, []);
  // A or R from the queue, or Approve and Reject in the photo viewer: both open the footer's confirm. A key meant for
  // another claim (the panel is still on the last one) waits for that claim's panel.
  const mine = (i: ReviewIntent | null | undefined) => (i && (!i.id || i.id === id) ? i : null);
  const [act, setAct] = useState(() => mine(intent));
  const [seenIntent, setSeenIntent] = useState(intent);
  if (intent !== seenIntent) {
    setSeenIntent(intent);
    setAct(mine(intent));
  }
  const review = claim?.review ? (mode: ReviewIntent["mode"]) => setAct((i) => ({ mode, n: (i?.n ?? 0) + 1 })) : undefined;
  const labels = claim?.review ? reviewLabels(claim) : null;
  const body = claim ?? stale;
  const pad = variant === "panel" ? "px-5" : "px-4 sm:px-6";

  return (
    // On a short window (under 600px) the panel scrolls as one, header and footer included, so the evidence isn't
    // squeezed between them; the reject form's buttons stay in view (ReviewActions).
    <div className="flex h-full min-h-0 flex-col [@media(max-height:600px)]:overflow-y-auto" aria-busy={load.state === "loading" || undefined}>
      <header className={clsx("flex items-start gap-3 border-b border-line py-3", pad)}>
        <div className="min-w-0 flex-1">
          {back && onBack && (
            <button type="button" onClick={onBack} className="-mt-1 mb-1 inline-flex min-h-8 items-center gap-1.5 text-ui text-muted hover:text-text">
              <span aria-hidden="true">←</span> Back to <span className="font-mono">{back}</span>
            </button>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* A programmatic focus target only (the sheet's showModal lands here): no ring, which on a phone read as a
                stray keyboard selection. */}
            <h2 ref={heading} id={variant === "sheet" ? "drawer-title" : undefined} className="font-mono text-body font-medium outline-none" tabIndex={-1}>
              {id}
            </h2>
            {/* In the grid's verdict track, so walking the queue never moves it. Before the claim loads, the grid row's. */}
            <span className="inline-flex w-[6.5rem]">
              {claim ? (
                <VerdictMark
                  verdict={verdictOf({ decision: claim.decision, payoutStatus: claim.payout?.status ?? null, seeded: Boolean(claim.seeded) })}
                  className={EXCEPTION.has(claim.decision) ? "text-text" : undefined}
                />
              ) : row?.id === id ? (
                <RowVerdict row={row} />
              ) : (
                <Skeleton className="h-4 w-20" />
              )}
            </span>
            {claim ? <MoneyLine claim={claim} /> : row?.id === id && <RowAmount row={row} />}
          </div>
          {!claim && row?.id === id ? (
            <RowMeta row={row} />
          ) : claim ? (
            // One line in the 440px panel, so the evidence keeps the height: "Unverified" only when it's true, as in the
            // grid (the pre-checks say verified).
            <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-ui text-muted">
              <span>{formatTime(claim.createdAt)}</span>
              <span>
                PayPal <span className="sr-only">account ending {claim.payer.slice(-4)}</span>
                <span aria-hidden="true" className="font-mono">
                  {claim.payer}
                </span>
                {!claim.verified && <span className="text-stop"> unverified</span>}
              </span>
              <span>
                Code <span className="font-mono text-text">{claim.code}</span>
              </span>
            </p>
          ) : (
            <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          )}
          {/* The decision just made on the claim before this one: said where the reviewer is looking, for 2 s. */}
          <p role="status" className="text-ui text-text-2 empty:hidden">
            {notice ? <span className="mt-1.5 block">{notice}</span> : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Close the evidence"
        >
          <CrossIcon />
        </button>
      </header>

      {/* Positioned, so its absolutely placed descendants (screen-reader text, the photo badges) scroll and clip with it:
          without a containing block of its own they reached past the window and the whole page scrolled into a void. */}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [@media(max-height:600px)]:flex-none [@media(max-height:600px)]:overflow-visible">
        {load.state === "error" && (
          <div className={clsx("py-6", pad)}>
            <ErrorState
              title={load.error.error}
              description="The claim itself is safe: opening it only reads it."
              action={
                <Button variant="secondary" size="sm" onClick={retry}>
                  Try again
                </Button>
              }
            />
          </div>
        )}
        {load.state !== "error" && !body && <DrawerSkeleton />}
        {load.state !== "error" && body && (
          <div className={clsx("transition-opacity duration-120", stale && "opacity-50")}>
            <Evidence claim={body} pad={pad} onReview={stale ? undefined : review} onOpen={onOpen} photosRef={photos} viewPhotos={stale ? undefined : viewPhotos} />
          </div>
        )}
      </div>

      {claim?.review && (
        <footer className={clsx("border-t border-line bg-surface py-4", pad)}>
          <ReviewActions key={claim.id} claim={claim} onDone={done} onFailed={() => router.refresh()} intent={act} onMode={onMode} onOpen={onOpen} />
        </footer>
      )}
      {claim && justSaved && (
        <footer ref={savedFooter} className={clsx("flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line bg-surface py-4", pad)}>
          <p role="status" className="min-w-0 flex-1 basis-56 text-ui text-muted">
            <span className="font-medium text-text">
              {justSaved.decision === "paid" ? "Approved" : "Rejected"} at <span className="font-mono">{formatClock(justSaved.at)}</span> UTC.
            </span>{" "}
            {justSaved.decision !== "paid" ? "The owner sees your reason on their claim page." : claim.seeded ? NO_PAYOUT : `${claim.amount} sent through PayPal.`}
            {nextHeld === null && " No held claims are left in this list."}
          </p>
          {nextHeld && onOpen && (
            <Button variant="secondary" size="sm" onClick={() => onOpen(nextHeld)}>
              Next held claim <span className="font-mono">{nextHeld}</span>
            </Button>
          )}
        </footer>
      )}
      {/* The keys: one compact line on a laptop's shorter window, so the evidence keeps the height; the footer's ?
          lists them all. */}
      {variant === "panel" && (
        <p
          className={clsx("flex h-9 shrink-0 items-center gap-4 border-t border-line text-micro text-faint [@media(max-height:600px)]:hidden [@media(max-height:960px)]:h-8", pad)}
          aria-hidden="true"
        >
          {mode === "approve" && labels && !labels.blocked ? (
            <>
              <Keys k={["A"]}>{labels.confirmKey}</Keys>
              <Keys k={["Esc"]}>Cancel</Keys>
            </>
          ) : mode === "reject" ? (
            <>
              <Keys k={["1–4"]}>Quick reason</Keys>
              <Keys k={["⌘↵"]}>Reject</Keys>
              <Keys k={["Esc"]}>Cancel</Keys>
            </>
          ) : (
            <>
              <Keys k={["↓", "↑"]}>Next claim</Keys>
              {/* On a wide screen only, where the line has room: the ? sheet lists it everywhere. */}
              {(claim ?? stale)?.photos.length ? (
                <span className="hidden min-[1600px]:inline-flex">
                  <Keys k={["V"]}>Photos</Keys>
                </span>
              ) : null}
              {labels && !labels.blocked && <Keys k={["A"]}>{labels.approveKey}</Keys>}
              {labels && <Keys k={["R"]}>Reject</Keys>}
              <Keys k={["Esc"]}>Close</Keys>
            </>
          )}
        </p>
      )}
    </div>
  );
}

// The rule's outcome under Decision, when the reason itself already leads the panel.
const OUTCOME: Partial<Record<DrawerClaim["decision"], string>> = {
  held: "Held for your review. Nothing is paid until a person approves it.",
  rejected: "Rejected. No money moves.",
  blocked: "Blocked before the photo check. No money moves.",
};

function Section({ title, children, aside }: { title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-ui font-medium text-text">{title}</h3>
        {aside && <span className="text-ui text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

type Step = { label: string; at: string | null; note?: string; failed?: boolean; value?: string };

/** The money's path for this claim, from its events: photos in, photo check, decision, PayPal sent, settled. */
function moneySteps(claim: DrawerClaim): Step[] {
  const at = (match: (e: DrawerClaim["events"][number]) => boolean) => claim.events.find(match)?.at ?? null;
  const photos = at((e) => e.type === "photos_received");
  const decided = at((e) => e.type === "decided" || e.type === "blocked" || e.type === "rejected");
  const steps: Step[] = [
    { label: "Photos in", at: photos },
    { label: "Photo check", at: at((e) => e.type === "checked"), note: claim.decision === "blocked" ? "The account checks stopped it, so the photos were never read." : undefined },
    { label: "Decision", at: decided },
  ];
  if (claim.seeded) return [...steps, { label: "PayPal", at: null, note: claim.decision === "paid" ? NO_PAYOUT : undefined }];
  if (claim.decision === "rejected" || claim.decision === "blocked") return steps;
  const failure = payoutFailure(claim);
  if (failure) {
    return [
      ...steps,
      { label: "Not sent", at: failure.at, failed: true, note: `${failure.what} at ${formatClock(failure.at)} UTC: nothing was paid, and the claim is still held.` },
      { label: "Settled", at: null },
    ];
  }
  return [
    ...steps,
    { label: "Sent", at: at((e) => e.type === "payout_sent"), note: claim.decision === "held" ? "Held: nothing is sent until a person at the company approves." : undefined },
    { label: "Settled", at: at((e) => e.type === "payout_updated" && e.detail.endsWith("SUCCESS")) },
  ];
}

/** The claim's path as one row of dots (Mercury's money timeline, laid flat to leave room for the photos): each step,
 * then its time after the photos arrived, from 0:00. A step not reached is a hollow dot. In a narrow panel (a phone, or
 * the docked panel at its narrowest) the steps stack, each name whole on the left and its time on the right. */
function MoneyTimeline({ claim }: { claim: DrawerClaim }) {
  const steps = moneySteps(claim);
  const start = steps[0].at ? Date.parse(steps[0].at) : null;
  const note = steps.find((s) => s.note)?.note;
  return (
    <div className="@container">
      <ol className="flex flex-col gap-2 @[26rem]:grid @[26rem]:gap-0" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={`Timeline for ${claim.id}`}>
        {steps.map((s, i) => {
          const done = s.at !== null;
          const next = steps[i + 1];
          const plus = done && start !== null ? Math.round((Date.parse(s.at!) - start) / 1000) : null;
          return (
            <li key={s.label} className="relative flex min-w-0 items-center gap-3 @[26rem]:flex-col @[26rem]:items-stretch @[26rem]:gap-1.5 @[26rem]:pr-2">
              <span aria-hidden="true" className="relative flex h-3 shrink-0 items-center">
                {/* A refused payout: a red ring, and its label says so, so it reads without colour too. */}
                <span
                  className={clsx(
                    "relative z-10 size-2.5 shrink-0 rounded-full",
                    s.failed ? "border-2 border-stop bg-surface" : done ? (i >= 3 ? "bg-pay" : "bg-text") : "border border-line-strong bg-surface",
                  )}
                />
                {next && <span className={clsx("absolute inset-x-0 left-2.5 hidden h-px @[26rem]:block", done && next.at && !s.failed ? "bg-muted/70" : "bg-line-strong/40")} />}
              </span>
              <span className={clsx("min-w-0 flex-1 text-micro @[26rem]:flex-none @[26rem]:truncate", s.failed ? "text-stop" : done ? "text-text" : "text-faint")}>{s.label}</span>
              {/* The figures in mono, the unit in the sans after a thin space, as the grid prints a span. */}
              <span className="text-micro text-muted">
                {!done ? <span className="text-faint">{s.value ?? "—"}</span> : s.failed ? <span className="font-mono">{formatClock(s.at!)}</span> : <DurationText sec={i === 0 ? 0 : plus!} plus={i > 0} />}
              </span>
            </li>
          );
        })}
      </ol>
      {note && <p className={clsx("mt-2 text-micro", steps.some((s) => s.failed) ? "text-muted" : "text-faint")}>{note}</p>}
    </div>
  );
}

/** What decided a held or refused claim: the reason as a heading, what it means, and the photo check's own words. Null
 * for any other claim. */
function deciding(claim: DrawerClaim): { title: string; detail: string | null; evidence: string | null } | null {
  if (claim.decision !== "held" && claim.decision !== "rejected" && claim.decision !== "blocked") return null;
  // The newest thing that stopped the money leads: PayPal not taking the payout, or the checks run again on approve.
  const failure = payoutFailure(claim);
  const refused = claim.refused;
  if (failure && (!refused || failure.at > refused.at)) {
    return { title: failure.what, detail: `At ${formatClock(failure.at)} UTC. ${failure.next}`, evidence: null };
  }
  if (refused) {
    return {
      title: "Not paid on review",
      detail: `When it was approved at ${formatClock(refused.at)} UTC, Remedy checked again and didn't send the payout: ${refused.text.charAt(0).toLowerCase()}${refused.text.slice(1)}.`,
      evidence: null,
    };
  }
  // A person rejected it: their reason, as the owner reads it, and who and when.
  if (claim.rejected) {
    return {
      title: "Rejected on review",
      detail: `${claim.rejected.by ?? "A person at the company"} rejected it at ${formatClock(claim.rejected.at)} UTC. The owner reads:`,
      evidence: claim.rejected.reason,
    };
  }
  // The rule refused it and the owner asked a person to look: their ask leads, then the check that refused it.
  if (claim.decision === "held" && claim.appealedAt) {
    const refused = claim.checks.find((c) => c.outcome === "reject");
    return {
      title: "The owner asked for a review",
      detail: `The rule refused it${refused ? ` on ${refused.label}: ${refused.rule.charAt(0).toLowerCase()}${refused.rule.slice(1).replace(/[.\s]+$/, "")}` : ""}. Nothing has been paid.`,
      evidence: refused?.evidence ?? null,
    };
  }
  const pre = claim.preChecks.find((p) => p.state === "reject" || p.state === "hold");
  const check = claim.checks.find((c) => c.outcome !== "pass");
  return { title: check?.rule ?? pre?.detail ?? claim.sentence, detail: null, evidence: check?.evidence ?? null };
}

/** Held or refused: the reason as the panel's first heading, the photo check's own words under it, then the count.
 * Claim ids it names open in the panel. */
function Deciding({ claim, onOpen }: { claim: DrawerClaim; onOpen?: (id: string) => void }) {
  const d = deciding(claim);
  if (!d) return null;
  return (
    <section aria-labelledby="deciding-title" className="flex flex-col gap-1.5">
      <h3 id="deciding-title" className="text-ui font-medium text-text">
        <LinkedIds text={d.title} onOpen={onOpen} self={claim.id} />
      </h3>
      {d.detail && (
        <p className="text-ui text-muted">
          <LinkedIds text={d.detail} onOpen={onOpen} self={claim.id} />
        </p>
      )}
      {d.evidence && <q className="block border-l border-line-strong pl-3 font-sans text-ui leading-[1.55] text-muted"><ModelQuote>{d.evidence}</ModelQuote></q>}
      {claim.five && <p className="mt-1 text-micro text-muted">{claim.five}</p>}
    </section>
  );
}

/** Under a check list: the passed rows' details, folded by default so what held or failed is in view first. */
function PassedToggle({ count, open, onToggle, name }: { count: number; open: boolean; onToggle: () => void; name: string }) {
  if (!count) return null;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${name} details`}
      onClick={onToggle}
      className="-mt-1 -ml-1.5 inline-flex min-h-8 items-center gap-1.5 self-start rounded-control px-1.5 text-ui text-muted hover:text-text"
    >
      <span aria-hidden="true" className={clsx("inline-block transition-transform", open && "rotate-90")}>
        ›
      </span>
      {open ? "Hide details" : "Details"}
    </button>
  );
}

function Evidence({
  claim,
  pad,
  onReview,
  onOpen,
  photosRef,
  viewPhotos,
}: {
  claim: DrawerClaim;
  pad: string;
  onReview?: (mode: ReviewIntent["mode"]) => void;
  onOpen?: (id: string) => void;
  photosRef?: RefObject<HTMLElement | null>;
  viewPhotos?: number;
}) {
  // The "model" hold is the photo check not answering, not an answer: it isn't counted as a check that didn't pass.
  // Before any photo arrives every check is waiting: one line says when they run, the rows are their names alone.
  const waiting = claim.preChecks.every((p) => p.state === "waiting");
  // The photo viewer, open on a photo (0-based); keyed by claim, so ↑/↓ to another claim closes it.
  const [viewing, setViewing] = useState<{ id: string; n: number } | null>(null);
  const viewer = viewing?.id === claim.id ? viewing.n : null;
  // V or Space from the queue opens the viewer at the first photo (a count that changes on each press).
  const [seenView, setSeenView] = useState(viewPhotos);
  if (viewPhotos !== seenView) {
    setSeenView(viewPhotos);
    if (viewPhotos && claim.photos.length) setViewing({ id: claim.id, n: 0 });
  }
  const d = deciding(claim);
  // The passed rows' details, open or folded, per claim: ↑/↓ to the next claim folds them again.
  const [unfolded, setUnfolded] = useState<{ id: string; open: boolean }>({ id: claim.id, open: false });
  const open = unfolded.id === claim.id && unfolded.open;
  const link = (text: string) => <LinkedIds text={text} onOpen={onOpen} self={claim.id} />;
  // What a screen reader hears for each photo: what it shows and what the tag reads, in a few words from the checks.
  const seen = claim.photoAlt ?? undefined;
  return (
    // Paragraphs wrap with no word left alone on a last line ("it.").
    <div className={clsx("flex flex-col gap-7 py-5 [&_p]:text-pretty [&_q]:text-pretty", pad)}>
      {/* What decided it, then the photos, so a laptop's first view of the panel holds both. */}
      <Deciding claim={claim} onOpen={onOpen} />
      <section ref={photosRef} className="flex scroll-mt-4 flex-col gap-3" aria-labelledby="photos-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 id="photos-title" className="text-ui font-medium text-text">
            {claim.photos.length ? "Photos" : "No photos yet"}
          </h3>
          {/* A person deciding a held claim reads the tag against this: one glance, beside the photos. */}
          {claim.review && claim.photos.length > 0 && <TagCode code={claim.code} />}
        </div>
        {claim.duplicate ? (
          <Duplicate claim={claim} onOpen={onOpen} onView={(n) => setViewing({ id: claim.id, n })} />
        ) : claim.photos.length ? (
          <div className={claim.photos.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
            {claim.photos.map((src, i) => (
              <EvidencePhoto
                key={src}
                src={src}
                n={i + 1}
                of={claim.photos.length}
                tall={claim.photos.length === 2}
                description={seen}
                onOpen={() => setViewing({ id: claim.id, n: i })}
                className={claim.photos.length === 3 && i === 0 ? "col-span-2" : undefined}
              />
            ))}
          </div>
        ) : (
          <p className="text-ui text-muted">
            The owner has code <span className="font-mono text-text">{claim.code}</span> and an open camera session. Photos appear here when they arrive.
          </p>
        )}
        {viewer !== null && (
          <PhotoViewer
            claimId={claim.id}
            photos={claim.photos}
            start={viewer}
            code={claim.code}
            question={d && { title: d.title, detail: d.detail }}
            labels={claim.review ? reviewLabels(claim) : undefined}
            onOpen={onOpen}
            onReview={onReview}
            onClose={() => setViewing(null)}
          />
        )}
      </section>

      <Section title="Timeline" aside={claim.payout ? (claim.payout.status === "SUCCESS" ? "Sent through PayPal" : "Settling at PayPal") : undefined}>
        <MoneyTimeline claim={claim} />
      </Section>

      {waiting && <p className="-mb-4 text-ui text-muted">Checks run when the photos arrive.</p>}
      {/* The five checks the owner's result and the homepage name, in their order and states; what each one recorded
          (an account check, the photo check's answers and its quoted words) under it. */}
      <Section title="Checks" aside={waiting ? undefined : claim.five}>
        <CheckList
          label={`Checks for ${claim.id}`}
          steps={claim.fiveRows.map((r) => ({
            id: String(r.n),
            label: r.name,
            state: r.state === "reject" ? (r.n <= 3 ? "blocked" : "reject") : r.state,
            detail: r.state === "waiting" || (r.state === "pass" && !open) ? undefined : fiveDetail(r, d, link),
          }))}
        />
        <PassedToggle name="Checks" count={claim.fiveRows.filter((r) => r.state === "pass" && r.parts.length > 0).length} open={open} onToggle={() => setUnfolded({ id: claim.id, open: !open })} />
      </Section>

      <Section title="Decision">
        {/* What decided a held or refused claim leads the panel; here, only what the rule did with it. */}
        <p className="text-ui text-text-2">{d ? OUTCOME[claim.decision] ?? claim.sentence : claim.sentence}</p>
        {claim.review?.note && <p className="text-ui text-muted">{claim.review.note}</p>}
      </Section>

      {claim.payout && !claim.seeded && (
        // The payout as PayPal knows it, on hairlines: what support asks for, and nothing else.
        <Section title="PayPal" aside={claim.payout.status === "SUCCESS" ? "Settled" : "Settling"}>
          <dl className="grid grid-cols-[7rem_minmax(0,1fr)] text-ui">
            {(
              [
                [claim.payout.itemId ? "Payout" : "Batch", <span key="v" className="truncate font-mono text-text">{claim.payout.itemId ?? claim.payout.batchId}</span>],
                ...(claim.payout.itemId ? [["Batch", <span key="v" className="truncate font-mono text-text-2">{claim.payout.batchId}</span>]] : []),
                ["Status", <span key="v" className="font-mono text-text-2">{claim.payout.status}</span>],
                ["Updated", <span key="v" className="font-mono text-text-2">{formatTime(claim.payout.updatedAt)}</span>],
              ] as [string, ReactNode][]
            ).map(([k, v], i) => (
              <div key={i} className="contents">
                <dt className="border-t border-line py-2 text-muted">{k}</dt>
                <dd className="flex min-w-0 border-t border-line py-2">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-ui font-medium text-text [&::-webkit-details-marker]:hidden">
          History
          <span className="text-muted">
            {claim.events.length} events <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span>
          </span>
        </summary>
        <ol className="mt-2 flex flex-col border-l border-line">
          {claim.events.map((e, i) => (
            <li key={i} className="relative grid grid-cols-[5.5rem_1fr] gap-3 py-2 pl-4 text-ui">
              <time dateTime={e.at} className="font-mono text-micro leading-5 text-muted">
                {formatClock(e.at)}
              </time>
              <span className="min-w-0 text-muted">
                {/* One format for a span, as the grid and timeline print it ("11 s", not "10.8 s"). */}
                <LinkedIds text={e.detail.replace(/(\d+\.\d+) s\b/, (_, n: string) => duration(Number(n)))} onOpen={onOpen} self={claim.id} />
                {e.raw && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-micro text-faint hover:text-muted">Service&apos;s answer</summary>
                    <span className="mt-1 block font-mono text-micro break-words text-faint">{e.raw}</span>
                  </details>
                )}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

/**
 * Under one of the five checks: why it was skipped, or each thing recorded under it. One part says its line alone; several
 * name themselves ("Code K7P: the tag reads K7Q…"). The photo check's own words are quoted, except the answer the panel
 * already leads with, which is its name and state alone here. Undefined when there is nothing more to say.
 */
function fiveDetail(row: DrawerClaim["fiveRows"][number], decided: ReturnType<typeof deciding>, link: (text: string) => ReactNode): ReactNode {
  const led = (p: DrawerClaim["fiveRows"][number]["parts"][number]) => Boolean(decided && p.text === decided.title && (p.evidence ?? null) === decided.evidence);
  const shown = row.parts.filter((p) => (p.text || p.evidence) && !led(p));
  if (!row.note && !shown.length) return undefined;
  const named = row.parts.filter((p) => p.text || p.evidence).length > 1;
  return (
    <span className="flex flex-col gap-1.5">
      {row.note && <span>{row.note}</span>}
      {shown.map((p) => (
        <span key={p.id} className="block">
          {named && <span className={p.state === "pass" ? "text-text-2" : "text-text"}>{p.label}: </span>}
          {link(p.text)}
          {p.evidence && (
            <q className="mt-1.5 block border-l border-line-strong pl-3 font-sans text-ui leading-[1.55] text-muted">
              <ModelQuote>{p.evidence}</ModelQuote>
            </q>
          )}
        </span>
      ))}
    </span>
  );
}

/** The header's money: what the claim pays, and "Settling" or "Received" once PayPal has it; nothing for a refused claim.
 * A payout that wasn't sent is said once, on the timeline's PayPal step. */
function MoneyLine({ claim }: { claim: DrawerClaim }) {
  if (claim.decision !== "paid" && claim.decision !== "held") return null;
  // The receipt's own word once PayPal has settled it, so the owner and the company say the same thing.
  const state = claim.decision === "held" || !claim.payout ? null : claim.payout.status === "SUCCESS" ? "Received" : "Settling";
  return (
    <span className="ml-auto inline-flex items-baseline gap-1.5 text-ui">
      <span className="font-mono text-text">{claim.amount}</span>
      {state && <span className="text-muted">· {state}</span>}
    </span>
  );
}

/** "Tag must read K7P": the code the owner wrote, in mono at a size that reads against the photo's tag. */
function TagCode({ code }: { code: string }) {
  return (
    <p className="flex shrink-0 items-baseline gap-2 text-ui text-muted">
      Tag must read <span className="font-mono text-body font-medium tracking-wide text-text">{code}</span>
    </p>
  );
}

/** A blocked repost: its photo beside the earlier claim's matching one, each with its photo number and claim id; the
 * earlier claim's id opens its row. */
function Duplicate({ claim, onOpen, onView }: { claim: DrawerClaim; onOpen?: (id: string) => void; onView: (n: number) => void }) {
  const dup = claim.duplicate!;
  const mine = Math.min(dup.photo, claim.photos.length) - 1;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <EvidencePhoto src={claim.photos[mine]} n={mine + 1} of={claim.photos.length} tall onOpen={() => onView(mine)} />
        <p className="text-micro text-muted">
          This claim, <span className="font-mono">{claim.id}</span>
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {dup.src ? (
          <EvidencePhoto src={dup.src} n={dup.theirs} of={dup.of} tall />
        ) : (
          <p className="flex aspect-[3/4] items-center justify-center rounded-control border border-dashed border-line-strong px-3 text-center text-ui text-muted">The earlier photo isn&apos;t available</p>
        )}
        <p className="text-micro text-muted">
          Earlier claim,{" "}
          {onOpen ? (
            <button type="button" onClick={() => onOpen(dup.id)} className="font-mono text-text underline decoration-line-strong underline-offset-2 hover:decoration-text">
              {dup.id}
            </button>
          ) : (
            <span className="font-mono text-text">{dup.id}</span>
          )}
        </p>
      </div>
    </div>
  );
}
