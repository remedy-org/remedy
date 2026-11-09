"use client";

import { CrossIcon, Skeleton, SkeletonText } from "@/components/ui";
import type { ClaimRow } from "@/app/console/_lib/view";
import { EXCEPTION } from "./cells";
import { formatDayTime } from "./format";
import { VerdictMark, verdictOf } from "./VerdictMark";

// What the evidence panel shows before its claim has loaded: the header from the grid's row (the id, verdict, amount,
// filing time, account and code are all in it), and the body's skeleton. So no frame of an open is an empty card.

/** The verdict as the loaded header draws it, in the grid's verdict track. */
export function RowVerdict({ row }: { row: ClaimRow }) {
  return <VerdictMark verdict={verdictOf(row)} className={EXCEPTION.has(row.decision) ? "text-text" : undefined} />;
}

/** The refund a paid or held claim carries, on the header's right edge. */
export function RowAmount({ row }: { row: ClaimRow }) {
  if (!row.amount || (row.decision !== "paid" && row.decision !== "held")) return null;
  return <span className="font-mono text-ui text-text sm:ml-auto">{row.amount}</span>;
}

/** The header's second line from the grid row: when it was filed, the PayPal account and the code. */
export function RowMeta({ row }: { row: ClaimRow }) {
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-ui text-muted">
      <span>{formatDayTime(row.createdAt)}</span>
      <span>
        PayPal <span className="font-mono">{row.payer}</span>
        {!row.verified && <span className="text-stop"> unverified</span>}
      </span>
      {row.code && (
        <span>
          Code <span className="font-mono text-text">{row.code}</span>
        </span>
      )}
    </p>
  );
}

/** The panel's frame while its module or its claim loads: the row's header, the skeleton of the evidence, and a held
 * claim's foot, each at the loaded panel's own geometry, so nothing moves when the evidence lands. */
export function EvidenceShell({ row, onClose }: { row: ClaimRow | null; onClose?: () => void }) {
  return (
    <div aria-busy="true" className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-card bg-surface shadow-float">
      <div className="flex items-start gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0 flex-1">
          {row ? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="font-mono text-body font-medium">{row.id}</p>
                <span className="inline-flex w-[6.5rem]">
                  <RowVerdict row={row} />
                </span>
                <RowAmount row={row} />
              </div>
              <RowMeta row={row} />
            </>
          ) : (
            <Skeleton className="h-5 w-40" />
          )}
        </div>
        {/* The close button from the first frame, where the loaded header has it. */}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="-mt-2.5 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Close the evidence"
          >
            <CrossIcon />
          </button>
        ) : (
          <span className="-mt-2.5 -mr-2 size-11 shrink-0" />
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <DrawerSkeleton row={row} />
      </div>
      {row?.decision === "held" && <GhostFooter />}
      <div aria-hidden="true" className="flex h-9 shrink-0 items-center gap-4 border-t border-line px-5 [@media(max-height:600px)]:hidden [@media(max-height:960px)]:h-8">
        {["w-24", "w-20", "w-16", "w-14"].map((w) => (
          <Skeleton key={w} className={`h-2.5 ${w}`} />
        ))}
      </div>
    </div>
  );
}

/** A held claim's foot while it loads: its two buttons, as ghosts, at the loaded foot's height. */
export function GhostFooter() {
  return (
    <div aria-hidden="true" className="flex shrink-0 gap-3 border-t border-line px-5 py-4">
      <Skeleton className="h-11 w-32 rounded-button" />
      <Skeleton className="h-11 w-24 rounded-button" />
    </div>
  );
}

const REASONED = new Set<ClaimRow["decision"]>(["held", "rejected", "blocked"]);

/** The evidence's skeleton at the loaded panel's geometry: a held or refused claim's reason (its title, the photo
 * check's quoted words on their rule, the count), the photos under their title, then the timeline and the checks. */
export function DrawerSkeleton({ row }: { row?: ClaimRow | null }) {
  const reasoned = row ? REASONED.has(row.decision) : false;
  return (
    <div className="flex flex-col gap-7 px-5 py-5">
      {reasoned && (
        <div className="flex flex-col gap-1.5">
          <span className="flex h-5 items-center">
            <Skeleton className="h-[15px] w-3/4" />
          </span>
          <span className="flex h-[65px] flex-col justify-center gap-2 border-l border-line-strong pl-3">
            <Skeleton className="h-[13px] w-full" />
            <Skeleton className="h-[13px] w-11/12" />
            <Skeleton className="h-[13px] w-2/3" />
          </span>
          <span className="mt-1 flex h-[17px] items-center">
            <Skeleton className="h-3 w-48" />
          </span>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <span className={row?.decision === "held" ? "flex h-[26px] items-center" : "flex h-5 items-center"}>
          <Skeleton className="h-4 w-16" />
        </span>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="aspect-[3/4] w-full rounded-control" />
          <Skeleton className="aspect-[3/4] w-full rounded-control" />
        </div>
      </div>
      {[3, 4].map((rows, s) => (
        <div key={s} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <SkeletonText lines={1} className="flex-1" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
