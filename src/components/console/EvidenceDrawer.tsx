"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button, CheckProgress, CrossIcon, ErrorState, ExhibitLabel, Skeleton, SkeletonText, StatusPill, type CheckState } from "@/components/ui";
import type { ApiError } from "@/app/console/_lib/api";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import { duration, type PreCheckState } from "@/app/console/_lib/view";
import { api } from "./api";
import { EvidencePhoto } from "./EvidencePhoto";
import { formatClock, formatTime } from "./format";
import { Keys } from "./Keys";
import { LinkedIds } from "./LinkedIds";
import { PhotoViewer } from "./PhotoViewer";
import { payoutFailure, ReviewActions, reviewLabels, type ReviewIntent } from "./ReviewActions";

// The evidence for one claim: on laptops a non-modal panel docked beside the grid (Mercury's detail card), so ↑/↓
// keeps walking the queue; on phones and tablets a full-screen modal. Both show the same content: the money's
// timeline, the photos, the pre-checks, every model answer with its quoted evidence, the rule's decision, then approve
// or reject for held claims.

export interface EvidenceProps {
  claimId: string | null;
  // The grid row's version: the panel asks for the claim at it, which the server caches (Blob budget).
  version?: number | null;
  onClose: () => void;
  // A held claim's approve or reject, opened from the keyboard (A / R).
  intent?: ReviewIntent | null;
  // Opens another claim of the queue (the claim a repost copied, the next held claim).
  onOpen?: (id: string) => void;
  // A person paid or rejected this claim (ClaimsQueue works out the next held one).
  onDecided?: (id: string) => void;
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
function useClaim(id: string, version: number | null | undefined) {
  const key = seenKey(id, version);
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
    api<DrawerClaim>(`/api/console/claims/${id}${version ? `?v=${version}` : ""}`).then((res) => {
      if (!live) return;
      if (res.ok) {
        seen.set(key, res.data);
        setLanded((n) => n + 1);
      } else setFailure({ key, error: res.error });
    });
    return () => {
      live = false;
    };
  }, [id, version, key, attempt]);

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
export function EvidencePanel({ claimId, version, onClose, intent, onOpen, onDecided, nextHeld, back, onBack }: EvidenceProps) {
  if (!claimId) return null;
  return (
    <aside
      role="complementary"
      aria-label={`Evidence for ${claimId}`}
      className="evidence-panel flex h-full w-[440px] shrink-0 flex-col overflow-hidden rounded-card bg-surface shadow-float transition-[translate,opacity] duration-160 ease-out-expo starting:translate-x-4 starting:opacity-0"
    >
      <EvidenceContent
        id={claimId}
        version={version}
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
export function EvidenceDrawer({ claimId, version, onClose, intent, onOpen, onDecided, nextHeld, back, onBack }: EvidenceProps) {
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
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-surface p-0 text-text shadow-float transition-[translate,opacity] duration-240 ease-snap backdrop:bg-[oklch(0.1_0.004_75/0.6)] starting:translate-x-6 starting:opacity-0 sm:w-[min(36rem,100vw)] sm:rounded-l-card"
    >
      {claimId && (
        <EvidenceContent
          key={claimId}
          id={claimId}
          version={version}
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
  version,
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
  const { claim, stale, load, retry, replace } = useClaim(id, version);
  // The decision this view just saved: said in the footer, which then offers the next held claim.
  const [saved, setSaved] = useState<{ id: string; decision: DrawerClaim["decision"]; at: string } | null>(null);
  const done = (c: DrawerClaim) => {
    // Another claim's evidence may now read differently (approving this one makes the account's other claim stop on
    // approve, rejecting it frees it): every claim loads afresh from here.
    seen.clear();
    replace(c);
    setSaved({ id: c.id, decision: c.decision, at: new Date().toISOString() });
    onDecided?.(c.id);
    router.refresh();
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
  const onMode = useCallback((mode: "idle" | "approve" | "reject") => {
    if (mode === "reject") requestAnimationFrame(() => photos.current?.scrollIntoView({ block: "start", behavior: "instant" }));
  }, []);
  // A or R from the queue, or Approve and Reject in the photo viewer: both open the footer's confirm.
  const [act, setAct] = useState(intent);
  const [seenIntent, setSeenIntent] = useState(intent);
  if (intent !== seenIntent) {
    setSeenIntent(intent);
    setAct(intent);
  }
  const review = claim?.review ? (mode: ReviewIntent["mode"]) => setAct((i) => ({ mode, n: (i?.n ?? 0) + 1 })) : undefined;
  const labels = claim?.review ? reviewLabels(claim) : null;
  const body = claim ?? stale;
  const pad = variant === "panel" ? "px-5" : "px-4 sm:px-6";

  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy={load.state === "loading" || undefined}>
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
            {claim ? <StatusPill status={claim.decision} /> : <Skeleton className="h-6 w-16 rounded-full" />}
            {claim?.seeded && <span className="micro rounded-control border border-line px-1.5 py-px text-faint">Sample, never paid</span>}
            {claim?.demo && <span className="micro rounded-control border border-line px-1.5 py-px text-faint">Demo · sandbox</span>}
          </div>
          {claim ? (
            // One line in the 440px panel, so the evidence keeps the height: "Unverified" only when it's true, as in the
            // grid (the pre-checks say verified).
            <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-ui text-muted">
              <span>Filed {formatTime(claim.createdAt)}</span>
              <span>
                <span className="font-mono">{claim.payer}</span>
                {!claim.verified && <span className="text-stop"> unverified</span>}
              </span>
              <span>
                Code <span className="font-mono text-text">{claim.code}</span>
              </span>
            </p>
          ) : (
            <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          )}
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

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
            <Evidence claim={body} pad={pad} onReview={stale ? undefined : review} onOpen={onOpen} photosRef={photos} />
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
              {justSaved.decision === "paid" ? "Approved and paid" : "Rejected"} · saved at <span className="font-mono">{formatClock(justSaved.at)}</span> UTC.
            </span>{" "}
            {justSaved.decision === "paid"
              ? `${claim.amount} sent through PayPal${claim.sandbox ? " sandbox" : ""}.`
              : "The owner sees your reason on their claim page."}
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
        <p className={clsx("flex h-9 shrink-0 items-center gap-4 border-t border-line font-mono text-[11px] text-faint [@media(max-height:960px)]:h-7", pad)} aria-hidden="true">
          <Keys k={["↑", "↓"]}>Next claim</Keys>
          {labels && !labels.blocked && <Keys k={["A"]}>{labels.approveKey}</Keys>}
          {labels && <Keys k={["R"]}>Reject</Keys>}
          <Keys k={["Esc"]}>Close</Keys>
        </p>
      )}
    </div>
  );
}

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

const PRE_STATE: Record<PreCheckState, CheckState> = { pass: "pass", hold: "hold", reject: "blocked", waiting: "waiting", skipped: "skipped" };

type Step = { label: string; at: string | null; note?: string; failed?: boolean };

/** The money's path for this claim, from its events: photos in, model answered, rule decided, PayPal sent, settled. */
function moneySteps(claim: DrawerClaim): Step[] {
  const at = (match: (e: DrawerClaim["events"][number]) => boolean) => claim.events.find(match)?.at ?? null;
  const photos = at((e) => e.type === "photos_received");
  const decided = at((e) => e.type === "decided" || e.type === "blocked" || e.type === "rejected");
  const steps: Step[] = [
    { label: "Photos in", at: photos },
    { label: "Model", at: at((e) => e.type === "checked"), note: claim.decision === "blocked" ? "A pre-check stopped it: the photos never reached the model." : undefined },
    { label: "Rule", at: decided },
  ];
  if (claim.seeded) return [...steps, { label: "PayPal", at: null, note: claim.decision === "paid" ? "A sample claim: the rule decided to pay, and no money was sent." : undefined }];
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

/** The money's path as one row of dots (Mercury's money timeline, laid flat to leave room for the photos): each step,
 * then its time after the photos arrived. A step not reached is a hollow dot. */
function MoneyTimeline({ claim }: { claim: DrawerClaim }) {
  const steps = moneySteps(claim);
  const start = steps[0].at ? Date.parse(steps[0].at) : null;
  const note = steps.find((s) => s.note)?.note;
  return (
    <div>
      <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="The money's timeline">
        {steps.map((s, i) => {
          const done = s.at !== null;
          const next = steps[i + 1];
          const plus = done && start !== null ? Math.round((Date.parse(s.at!) - start) / 1000) : null;
          return (
            <li key={s.label} className="relative flex min-w-0 flex-col gap-1.5 pr-2">
              <span aria-hidden="true" className="relative flex h-3 items-center">
                {/* A refused payout: a red ring, and its label says so, so it reads without colour too. */}
                <span
                  className={clsx(
                    "relative z-10 size-2.5 shrink-0 rounded-full",
                    s.failed ? "border-2 border-stop bg-surface" : done ? (i >= 3 ? "bg-pay" : "bg-text") : "border border-line-strong bg-surface",
                  )}
                />
                {next && <span className={clsx("absolute inset-x-0 left-2.5 h-px", done && next.at && !s.failed ? "bg-muted/70" : "bg-line-strong/40")} />}
              </span>
              <span className={clsx("truncate text-micro", s.failed ? "text-stop" : done ? "text-text" : "text-faint")}>{s.label}</span>
              <span className="font-mono text-micro text-muted tabular-nums">
                {!done ? <span className="text-faint">—</span> : i === 0 || s.failed ? formatClock(s.at!) : `+${duration(plus!)}`}
              </span>
            </li>
          );
        })}
      </ol>
      {note && <p className={clsx("mt-2 text-micro", steps.some((s) => s.failed) ? "text-muted" : "text-faint")}>{note}</p>}
    </div>
  );
}

/** What decided a held or refused claim: the first check that didn't pass (or pre-check), its sentence and the model's
 * own words. Null for any other claim. */
function deciding(claim: DrawerClaim): { lead: string; text: string; evidence: string | null } | null {
  if (claim.decision !== "held" && claim.decision !== "rejected" && claim.decision !== "blocked") return null;
  // The newest thing that stopped the money leads: PayPal not taking the payout, or the checks run again on approve.
  const failure = payoutFailure(claim);
  const refused = claim.refused;
  if (failure && (!refused || failure.at > refused.at)) {
    return { lead: "Why it's held · PayPal", text: `${failure.what} at ${formatClock(failure.at)} UTC. ${failure.next}`, evidence: null };
  }
  if (refused) {
    return {
      lead: "Why it's held · Not paid on review",
      text: `When it was approved at ${formatClock(refused.at)} UTC, Remedy checked again and didn't send the payout: ${refused.text.charAt(0).toLowerCase()}${refused.text.slice(1)}.`,
      evidence: null,
    };
  }
  // A person rejected it: their reason, as the owner reads it, and who and when.
  if (claim.rejected) {
    return {
      lead: "Why it was refused · Rejected on review",
      text: `${claim.rejected.by ?? "A person at the company"} rejected it at ${formatClock(claim.rejected.at)} UTC. The owner reads:`,
      evidence: claim.rejected.reason,
    };
  }
  // The rule refused it and the owner asked a person to look: their ask leads, then the check that refused it.
  if (claim.decision === "held" && claim.appealedAt) {
    const refused = claim.checks.find((c) => c.outcome === "reject");
    return {
      lead: "Why it's held · Owner asked for a review",
      text: `The rule refused it${refused ? ` on ${refused.label}: ${refused.rule.charAt(0).toLowerCase()}${refused.rule.slice(1).replace(/[.\s]+$/, "")}` : ""}. The owner asked a person to look, so it needs your review. Nothing has been paid.`,
      evidence: refused?.evidence ?? null,
    };
  }
  const pre = claim.preChecks.find((p) => p.state === "reject" || p.state === "hold");
  const check = claim.checks.find((c) => c.outcome !== "pass");
  return {
    lead: `${claim.decision === "held" ? "Why it's held" : "Why it was refused"} · ${check?.label ?? pre?.label ?? "The rule"}`,
    text: check?.rule ?? pre?.detail ?? claim.sentence,
    evidence: check?.evidence ?? null,
  };
}

/** Held or refused: what decided it, first, with the model's own words, then the five checks in one line (the grid's
 * count), before the photos and the full list. Claim ids it names open in the panel. */
function Deciding({ claim, onOpen }: { claim: DrawerClaim; onOpen?: (id: string) => void }) {
  const d = deciding(claim);
  if (!d) return null;
  return (
    <section aria-label="What decided it" className={clsx("rounded-control border-l-2 px-3.5 py-3", claim.decision === "held" ? "border-hold bg-hold-soft" : "border-stop bg-stop-soft")}>
      <p className="micro text-muted">{d.lead}</p>
      <p className="mt-1.5 text-ui text-text">
        <LinkedIds text={d.text} onOpen={onOpen} self={claim.id} />
      </p>
      {d.evidence && <q className="mt-1.5 block font-sans text-ui leading-[1.55] text-muted">{d.evidence}</q>}
      {claim.five && <p className="mt-2 text-ui text-muted">{claim.five}</p>}
    </section>
  );
}

/** Under a check list: the passed rows' details, folded by default so what held or failed is in view first. */
function PassedToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  if (!count) return null;
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="-mt-1 inline-flex min-h-8 items-center gap-1.5 self-start text-ui text-muted hover:text-text">
      <span aria-hidden="true" className={clsx("inline-block transition-transform", open && "rotate-90")}>
        ›
      </span>
      {open ? "Hide what the passed checks found" : `Show what the ${count === 1 ? "passed check" : `${count} passed checks`} found`}
    </button>
  );
}

function Evidence({
  claim,
  pad,
  onReview,
  onOpen,
  photosRef,
}: {
  claim: DrawerClaim;
  pad: string;
  onReview?: (mode: ReviewIntent["mode"]) => void;
  onOpen?: (id: string) => void;
  photosRef?: RefObject<HTMLElement | null>;
}) {
  // The "model" hold is the photo check not answering, not an answer: it isn't counted as a check that didn't pass.
  const answers = claim.checks.filter((c) => c.id !== "model");
  const passed = answers.filter((c) => c.outcome === "pass").length;
  const sample = claim.seeded || claim.demo;
  // The photo viewer, open on a photo (0-based); keyed by claim, so ↑/↓ to another claim closes it.
  const [viewing, setViewing] = useState<{ id: string; n: number } | null>(null);
  const viewer = viewing?.id === claim.id ? viewing.n : null;
  const d = deciding(claim);
  // The passed rows' details, open or folded, per claim: ↑/↓ to the next claim folds them again.
  const [unfolded, setUnfolded] = useState<{ id: string; pre: boolean; model: boolean }>({ id: claim.id, pre: false, model: false });
  const open = unfolded.id === claim.id ? unfolded : { id: claim.id, pre: false, model: false };
  const toggle = (which: "pre" | "model") => setUnfolded({ ...open, [which]: !open[which] });
  const link = (text: string) => <LinkedIds text={text} onOpen={onOpen} self={claim.id} />;
  // The summary is already quoted under the check it explains (Same item, Real photo): don't print it twice.
  const summary = claim.summary && !claim.checks.some((c) => c.evidence === claim.summary) ? claim.summary : null;
  return (
    <div className={clsx("flex flex-col gap-7 py-5", pad)}>
      {/* What decided it, then the photos, so a laptop's first view of the panel holds both. */}
      <Deciding claim={claim} onOpen={onOpen} />
      <section ref={photosRef} className="flex scroll-mt-4 flex-col gap-3" aria-label="Photos">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <ExhibitLabel leader="right" leaderLength={24}>
            {claim.photos.length ? `${claim.photos.length === 1 ? "Photo 1" : `Photos 1 to ${claim.photos.length}`} · ${sample ? "sample" : "live"}` : "No photos yet"}
          </ExhibitLabel>
          {/* A person deciding a held claim reads the tag against this: one glance, beside the photos. */}
          {claim.review && claim.photos.length > 0 && <TagCode code={claim.code} />}
        </div>
        {claim.duplicate ? (
          <Duplicate claim={claim} sample={sample} onOpen={onOpen} onView={(n) => setViewing({ id: claim.id, n })} />
        ) : claim.photos.length ? (
          <div className={claim.photos.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
            {claim.photos.map((src, i) => (
              <EvidencePhoto
                key={src}
                src={src}
                n={i + 1}
                of={claim.photos.length}
                sample={sample}
                tall={claim.photos.length === 2}
                onOpen={() => setViewing({ id: claim.id, n: i })}
                className={claim.photos.length === 3 && i === 0 ? "col-span-2" : undefined}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-control border border-dashed border-line-strong px-4 py-6 text-center text-ui text-muted">
            The owner has code <span className="font-mono text-text">{claim.code}</span> and an open camera session. Photos appear here when they arrive.
          </p>
        )}
        {claim.seeded && <p className="text-ui text-muted">Sample photos from the eval set, shared by several seeded claims.</p>}
        {viewer !== null && (
          <PhotoViewer
            claimId={claim.id}
            photos={claim.photos}
            start={viewer}
            sample={sample}
            code={claim.code}
            question={d && { lead: d.lead, text: d.text }}
            labels={claim.review ? reviewLabels(claim) : undefined}
            onOpen={onOpen}
            onReview={onReview}
            onClose={() => setViewing(null)}
          />
        )}
      </section>

      <Section title="The money" aside={claim.payout ? (claim.payout.status === "SUCCESS" ? "Sent through PayPal" : "Settling at PayPal") : undefined}>
        <MoneyTimeline claim={claim} />
      </Section>

      <Section title="Before the model" aside="No AI">
        <CheckProgress
          label={`Pre-checks for ${claim.id}`}
          steps={claim.preChecks.map((p) => ({ id: p.id, label: p.label, state: PRE_STATE[p.state], detail: p.state === "pass" && !open.pre ? undefined : link(p.detail) }))}
        />
        <PassedToggle count={claim.preChecks.filter((p) => p.state === "pass").length} open={open.pre} onToggle={() => toggle("pre")} />
      </Section>

      <Section title="The model's answers" aside={answers.length ? `${passed} of ${answers.length} passed` : claim.checks.length ? "No answer" : undefined}>
        {claim.checks.length ? (
          <>
            <CheckProgress
              label={`Model answers for ${claim.id}`}
              steps={claim.checks.map((c) => ({
                id: c.id,
                label: c.label,
                state: c.outcome === "reject" ? "reject" : c.outcome,
                detail:
                  c.outcome === "pass" && !open.model ? undefined : (
                    <>
                      {link(c.rule)}
                      {c.evidence && <q className="mt-1.5 block border-l border-line-strong pl-3 font-sans text-ui leading-[1.55] text-muted">{c.evidence}</q>}
                    </>
                  ),
              }))}
            />
            <PassedToggle count={claim.checks.filter((c) => c.outcome === "pass").length} open={open.model} onToggle={() => toggle("model")} />
            {summary && (
              <p className="rounded-control bg-surface-2 px-4 py-3 text-ui text-muted">
                <span className="micro mb-1 block text-muted">Model summary</span>
                <span className="font-sans text-ui leading-[1.55] text-text-2">{summary}</span>
              </p>
            )}
          </>
        ) : (
          <p className="text-ui text-muted">
            {claim.decision === "blocked"
              ? "None. A pre-check stopped this claim, so its photos never reached the model."
              : claim.photos.length
                ? "The model is still answering."
                : "None yet. The model runs once the photos arrive."}
          </p>
        )}
      </Section>

      <Section title="Decision">
        <p className="text-body text-text">{claim.sentence}</p>
        {claim.review?.note && <p className="text-ui text-muted">{claim.review.note}</p>}
        {claim.payout && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-control border border-line px-4 py-3 text-ui">
            <dt className="text-muted">PayPal batch</dt>
            <dd className="truncate font-mono">{claim.payout.batchId}</dd>
            <dt className="text-muted">Status</dt>
            <dd className="text-muted">
              {claim.payout.status === "SUCCESS" ? "Sent" : "Settling at PayPal"} <span className="font-mono">· {claim.payout.status}</span>
            </dd>
            <dt className="text-muted">Updated</dt>
            <dd className="font-mono">{formatTime(claim.payout.updatedAt)}</dd>
          </dl>
        )}
      </Section>

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
                {e.detail}
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
function Duplicate({ claim, sample, onOpen, onView }: { claim: DrawerClaim; sample: boolean; onOpen?: (id: string) => void; onView: (n: number) => void }) {
  const dup = claim.duplicate!;
  const mine = Math.min(dup.photo, claim.photos.length) - 1;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <EvidencePhoto src={claim.photos[mine]} n={mine + 1} of={claim.photos.length} sample={sample} tall onOpen={() => onView(mine)} />
        <p className="font-mono text-micro text-muted">This claim, {claim.id}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {dup.src ? (
          <EvidencePhoto src={dup.src} n={dup.theirs} of={dup.of} sample={sample} tall />
        ) : (
          <p className="flex aspect-[3/4] items-center justify-center rounded-control border border-dashed border-line-strong px-3 text-center text-ui text-muted">The earlier photo isn&apos;t available</p>
        )}
        <p className="font-mono text-micro text-muted">
          Earlier claim,{" "}
          {onOpen ? (
            <button type="button" onClick={() => onOpen(dup.id)} className="text-text underline decoration-line-strong underline-offset-2 hover:decoration-text">
              {dup.id}
            </button>
          ) : (
            <span className="text-text">{dup.id}</span>
          )}
        </p>
      </div>
    </div>
  );
}

export function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="aspect-[4/3] w-full rounded-control" />
      </div>
      {[4, 5].map((rows, s) => (
        <div key={s} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex gap-3 border-b border-line py-3 last:border-b-0">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <SkeletonText lines={2} className="flex-1" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
