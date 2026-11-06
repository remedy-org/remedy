"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, CheckProgress, CrossIcon, ErrorState, ExhibitLabel, Skeleton, SkeletonText, StatusPill, type CheckState } from "@/components/ui";
import type { ApiError } from "@/app/console/_lib/api";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import type { PreCheckState } from "@/app/console/_lib/view";
import { api } from "./api";
import { EvidencePhoto } from "./EvidencePhoto";
import { formatClock, formatTime } from "./format";
import { ReviewActions } from "./ReviewActions";

export interface EvidenceDrawerProps {
  claimId: string | null;
  onClose: () => void;
}

/**
 * The evidence for one claim, in a modal drawer on the right (full screen on phones): photos, pre-checks, every
 * model answer with its quoted evidence, the rule's decision, then approve or reject for held claims.
 */
export function EvidenceDrawer({ claimId, onClose }: EvidenceDrawerProps) {
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
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-surface p-0 text-text shadow-float transition-[translate,opacity] duration-240 ease-snap backdrop:bg-[oklch(0.1_0.01_255/0.6)] starting:translate-x-6 starting:opacity-0 sm:w-[min(36rem,100vw)] sm:rounded-l-card"
    >
      {claimId && <DrawerBody key={claimId} id={claimId} onClose={() => ref.current?.close()} />}
    </dialog>
  );
}

type Load = { state: "loading" } | { state: "error"; error: ApiError } | { state: "ready"; claim: DrawerClaim };

function DrawerBody({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    let live = true;
    api<DrawerClaim>(`/api/console/claims/${id}`).then((res) => {
      if (live) setLoad(res.ok ? { state: "ready", claim: res.data } : { state: "error", error: res.error });
    });
    return () => {
      live = false;
    };
  }, [id, attempt]);

  const claim = load.state === "ready" ? load.claim : null;
  const done = (c: DrawerClaim) => {
    setLoad({ state: "ready", claim: c });
    router.refresh();
  };

  return (
    <div className="flex h-full flex-col" aria-busy={load.state === "loading" || undefined}>
      <header className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="drawer-title" className="font-mono text-body font-medium">
              {id}
            </h2>
            {claim && <StatusPill status={claim.decision} />}
            {claim?.seeded && <span className="micro rounded-control border border-line px-1.5 py-px text-faint">Seeded sample</span>}
            {claim?.demo && <span className="micro rounded-control border border-line px-1.5 py-px text-faint">Demo, sandbox money</span>}
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

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {load.state === "loading" && <DrawerSkeleton />}
        {load.state === "error" && (
          <div className="p-4 sm:p-6">
            <ErrorState
              title={load.error.error}
              description="The claim itself is safe: opening it only reads it."
              action={
                <Button variant="secondary" size="sm" onClick={() => (setLoad({ state: "loading" }), setAttempt((a) => a + 1))}>
                  Try again
                </Button>
              }
            />
          </div>
        )}
        {claim && <Evidence claim={claim} />}
      </div>

      {claim?.review && (
        <footer className="border-t border-line bg-surface px-4 py-4 sm:px-6">
          <ReviewActions claim={claim} onDone={done} />
        </footer>
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

function Evidence({ claim }: { claim: DrawerClaim }) {
  const passed = claim.checks.filter((c) => c.outcome === "pass").length;
  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6">
      <section className="flex flex-col gap-3" aria-label="Photos">
        <ExhibitLabel leader="right" leaderLength={24}>
          Exhibit A · {claim.photos.length ? `${claim.photos.length} ${claim.seeded ? "sample" : "live"} ${claim.photos.length === 1 ? "photo" : "photos"}` : "No photos yet"}
        </ExhibitLabel>
        {claim.seeded && <p className="text-ui text-muted">Sample photos from the demo data, shared by several seeded claims.</p>}
        {claim.photos.length ? (
          <div className={claim.photos.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
            {claim.photos.map((src, i) => (
              <EvidencePhoto key={src} src={src} n={i + 1} of={claim.photos.length} className={claim.photos.length === 3 && i === 0 ? "col-span-2" : undefined} />
            ))}
          </div>
        ) : (
          <p className="rounded-control border border-dashed border-line-strong px-4 py-6 text-center text-ui text-muted">
            The owner has code <span className="font-mono text-text">{claim.code}</span> and an open camera session. Photos appear here when they arrive.
          </p>
        )}
      </section>

      <Section title="Before the model" aside="4 pre-checks">
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
                    {c.evidence && <span className="mt-1.5 block border-l border-line-strong pl-3 font-mono text-micro leading-relaxed text-muted">{c.evidence}</span>}
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
