"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, CheckProgress, CrossIcon, ErrorState, ExhibitLabel, Skeleton, SkeletonText, StatusPill, type CheckState } from "@/components/ui";
import type { ApiError } from "@/app/console/_lib/api";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import type { PreCheckState } from "@/app/console/_lib/view";
import { api } from "./api";
import { EvidencePhoto } from "./EvidencePhoto";
import { formatClock, formatTime } from "./format";
import { Keys } from "./Keys";
import { ReviewActions, type ReviewIntent } from "./ReviewActions";

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

  const load: Load = hit ? { state: "ready" } : failure?.key === key ? { state: "error", error: failure.error } : { state: "loading" };
  return {
    claim: hit,
    stale: !hit && last && last.id !== id ? last : null,
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
export function EvidencePanel({ claimId, version, onClose, intent }: EvidenceProps) {
  if (!claimId) return null;
  return (
    <aside
      role="complementary"
      aria-label={`Evidence for ${claimId}`}
      className="evidence-panel flex h-full w-[440px] shrink-0 flex-col overflow-hidden rounded-card bg-surface shadow-float transition-[translate,opacity] duration-160 ease-out-expo starting:translate-x-4 starting:opacity-0"
    >
      <EvidenceContent id={claimId} version={version} onClose={onClose} intent={intent} variant="panel" />
    </aside>
  );
}

/** Phones and tablets: a full-screen modal dialog (a sheet from the right on tablets). */
export function EvidenceDrawer({ claimId, version, onClose, intent }: EvidenceProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (claimId && !d.open) d.showModal();
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
      {claimId && <EvidenceContent key={claimId} id={claimId} version={version} onClose={() => ref.current?.close()} intent={intent} variant="sheet" />}
    </dialog>
  );
}

function EvidenceContent({ id, version, onClose, intent, variant }: { id: string; version?: number | null; onClose: () => void; intent?: ReviewIntent | null; variant: "panel" | "sheet" }) {
  const router = useRouter();
  const { claim, stale, load, retry, replace } = useClaim(id, version);
  const done = (c: DrawerClaim) => {
    replace(c);
    router.refresh();
  };
  const body = claim ?? stale;
  const pad = variant === "panel" ? "px-5" : "px-4 sm:px-6";

  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy={load.state === "loading" || undefined}>
      <header className={clsx("flex items-start gap-3 border-b border-line py-3.5", pad)}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2 id={variant === "sheet" ? "drawer-title" : undefined} className="font-mono text-body font-medium" tabIndex={-1}>
              {id}
            </h2>
            {claim ? <StatusPill status={claim.decision} /> : <Skeleton className="h-6 w-16 rounded-full" />}
            {claim?.seeded && <span className="micro rounded-control border border-line px-1.5 py-px text-faint">Sample, never paid</span>}
            {claim?.demo && <span className="micro rounded-control border border-line px-1.5 py-px text-faint">Demo · sandbox</span>}
          </div>
          {claim ? (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-ui text-muted">
              <span>Filed {formatTime(claim.createdAt)}</span>
              <span>
                <span className="font-mono">{claim.payer}</span> {claim.verified ? "verified" : <span className="text-stop">unverified</span>}
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
            <Evidence claim={body} pad={pad} />
          </div>
        )}
      </div>

      {claim?.review && (
        <footer className={clsx("border-t border-line bg-surface py-4", pad)}>
          <ReviewActions key={claim.id} claim={claim} onDone={done} intent={intent} />
        </footer>
      )}
      {variant === "panel" && (
        <p className={clsx("flex h-9 shrink-0 items-center gap-4 border-t border-line font-mono text-[11px] text-faint", pad)} aria-hidden="true">
          <Keys k={["↑", "↓"]}>Next claim</Keys>
          {claim?.review && <Keys k={["A"]}>Approve</Keys>}
          {claim?.review && <Keys k={["R"]}>Reject</Keys>}
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

type Step = { label: string; at: string | null; note?: string };

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
                <span className={clsx("relative z-10 size-2.5 shrink-0 rounded-full", done ? (i >= 3 ? "bg-pay" : "bg-text") : "border border-line-strong bg-surface")} />
                {next && <span className={clsx("absolute inset-x-0 left-2.5 h-px", done && next.at ? "bg-muted/70" : "bg-line-strong/40")} />}
              </span>
              <span className={clsx("truncate text-micro", done ? "text-text" : "text-faint")}>{s.label}</span>
              <span className="font-mono text-micro text-muted tabular-nums">
                {!done ? <span className="text-faint">—</span> : i === 0 ? formatClock(s.at!) : `+${plus} s`}
              </span>
            </li>
          );
        })}
      </ol>
      {note && <p className="mt-2 text-micro text-faint">{note}</p>}
    </div>
  );
}

/** Held or refused: what decided it, first, with the model's own words, before the photos and the full list. */
function Deciding({ claim }: { claim: DrawerClaim }) {
  if (claim.decision !== "held" && claim.decision !== "rejected" && claim.decision !== "blocked") return null;
  const check = claim.checks.find((c) => c.outcome !== "pass");
  const pre = claim.preChecks.find((p) => p.state === "reject" || p.state === "hold");
  const label = check?.label ?? pre?.label ?? "The rule";
  const text = check?.rule ?? pre?.detail ?? claim.sentence;
  return (
    <section aria-label="What decided it" className={clsx("rounded-control border-l-2 px-3.5 py-3", claim.decision === "held" ? "border-hold bg-hold-soft" : "border-stop bg-stop-soft")}>
      <p className="micro text-muted">{claim.decision === "held" ? "Why it's held" : "Why it was refused"} · {label}</p>
      <p className="mt-1.5 text-ui text-text">{text}</p>
      {check?.evidence && <q className="mt-1.5 block font-mono text-micro leading-relaxed text-muted">{check.evidence}</q>}
    </section>
  );
}

function Evidence({ claim, pad }: { claim: DrawerClaim; pad: string }) {
  const passed = claim.checks.filter((c) => c.outcome === "pass").length;
  const sample = claim.seeded || claim.demo;
  return (
    <div className={clsx("flex flex-col gap-7 py-5", pad)}>
      <Deciding claim={claim} />
      <Section title="The money" aside={claim.payout ? (claim.payout.status === "SUCCESS" ? "Sent through PayPal" : "Settling at PayPal") : undefined}>
        <MoneyTimeline claim={claim} />
      </Section>

      <section className="flex flex-col gap-3" aria-label="Photos">
        <ExhibitLabel leader="right" leaderLength={24}>
          Exhibit A · {claim.photos.length ? `${claim.photos.length} ${sample ? "sample" : "live"} ${claim.photos.length === 1 ? "photo" : "photos"}` : "No photos yet"}
        </ExhibitLabel>
        {claim.photos.length ? (
          <div className={claim.photos.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
            {claim.photos.map((src, i) => (
              <EvidencePhoto key={src} src={src} n={i + 1} of={claim.photos.length} sample={sample} className={claim.photos.length === 3 && i === 0 ? "col-span-2" : undefined} />
            ))}
          </div>
        ) : (
          <p className="rounded-control border border-dashed border-line-strong px-4 py-6 text-center text-ui text-muted">
            The owner has code <span className="font-mono text-text">{claim.code}</span> and an open camera session. Photos appear here when they arrive.
          </p>
        )}
        {claim.seeded && <p className="text-ui text-muted">Sample photos from the eval set, shared by several seeded claims.</p>}
      </section>

      <Section title="Before the model" aside="No AI">
        <CheckProgress
          label={`Pre-checks for ${claim.id}`}
          steps={claim.preChecks.map((p) => ({ id: p.id, label: p.label, state: PRE_STATE[p.state], detail: p.detail }))}
        />
      </Section>

      <Section title="The model's answers" aside={claim.checks.length ? `${passed} of ${claim.checks.length} passed` : undefined}>
        {claim.checks.length ? (
          <>
            <CheckProgress
              label={`Model answers for ${claim.id}`}
              steps={claim.checks.map((c) => ({
                id: c.id,
                label: c.label,
                state: c.outcome === "reject" ? "reject" : c.outcome,
                detail: (
                  <>
                    {c.rule}
                    {c.evidence && <q className="mt-1.5 block border-l border-line-strong pl-3 font-mono text-micro leading-relaxed text-muted">{c.evidence}</q>}
                  </>
                ),
              }))}
            />
            {claim.summary && (
              <p className="rounded-control bg-surface-2 px-4 py-3 text-ui text-muted">
                <span className="micro mb-1 block text-muted">Model summary</span>
                <span className="font-mono text-micro leading-relaxed text-text">{claim.summary}</span>
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
              <span className="text-muted">{e.detail}</span>
            </li>
          ))}
        </ol>
      </details>
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
