"use client";

import { Skeleton, SkeletonText } from "@/components/ui";
import type { ClaimRow } from "@/app/console/_lib/view";
import { EXCEPTION } from "./cells";
import { formatTime } from "./format";
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
  return <span className="ml-auto font-mono text-ui text-text">{row.amount}</span>;
}

/** The header's second line from the grid row: when it was filed, the PayPal account and the code. */
export function RowMeta({ row }: { row: ClaimRow }) {
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-ui text-muted">
      <span>{formatTime(row.createdAt)}</span>
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

/** The panel's frame while its module or its claim loads: the row's header, then the skeleton of the evidence. */
export function EvidenceShell({ row }: { row: ClaimRow | null }) {
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
        <span className="-mr-2 size-11 shrink-0" />
      </div>
      <DrawerSkeleton />
    </div>
  );
}

/** The evidence's skeleton: the reason, the photos, then the two check lists. */
export function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-7 px-5 py-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-16" />
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
