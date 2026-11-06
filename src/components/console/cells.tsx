"use client";

import type { CustomCellRendererProps } from "ag-grid-react";
import { StatusPill } from "@/components/ui";
import type { ClaimRow } from "@/app/console/_lib/view";
import { formatTime } from "./format";

type Cell = CustomCellRendererProps<ClaimRow>;

export function SampleTag({ row }: { row: Pick<ClaimRow, "seeded" | "demo"> }) {
  if (!row.seeded && !row.demo) return null;
  return (
    <span className="micro text-faint" title={row.seeded ? "Sample claim from the eval: never paid" : "Filed through the judges' demo with sandbox money"}>
      {row.seeded ? "Seeded" : "Demo"}
    </span>
  );
}

/** Claim id in mono with its sample tag. In the narrow layout the filing time sits under it. */
export function ClaimCell({ data, context }: Cell & { context?: { narrow?: boolean } }) {
  if (!data) return null;
  return (
    <span className="flex h-full flex-col justify-center leading-tight">
      <span className="flex items-center gap-2">
        <span className="font-mono text-ui">{data.id}</span>
        <SampleTag row={data} />
      </span>
      {context?.narrow && <span className="mt-0.5 font-mono text-micro text-faint">{formatTime(data.createdAt)}</span>}
    </span>
  );
}

export function FiledCell({ data }: Cell) {
  return data ? <span className="font-mono text-ui text-muted">{formatTime(data.createdAt)}</span> : null;
}

export function PayerCell({ data }: Cell) {
  if (!data) return null;
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-ui">{data.payer}</span>
      <span className={data.verified ? "text-micro text-faint" : "text-micro text-stop"}>{data.verified ? "Verified" : "Unverified"}</span>
    </span>
  );
}

export function DecisionCell({ data }: Cell) {
  return data ? <StatusPill status={data.decision} /> : null;
}

export function ReasonCell({ data }: Cell) {
  return data ? (
    <span className="min-w-0 truncate text-ui text-muted" title={data.reason}>
      {data.reason}
    </span>
  ) : null;
}

export function PayoutCell({ data }: Cell) {
  if (!data) return null;
  if (!data.payoutStatus) return <span className="text-faint" aria-label="No payout">—</span>;
  const settled = data.payoutStatus === "SUCCESS";
  return <span className={settled ? "font-mono text-micro text-muted" : "font-mono text-micro text-hold"}>{data.payoutStatus}</span>;
}

export function AmountCell({ data }: Cell) {
  if (!data) return null;
  if (!data.amount) return <span className="text-faint" aria-label="No amount">—</span>;
  return <span className={data.decision === "paid" ? "font-mono text-ui" : "font-mono text-ui text-muted"}>{data.amount}</span>;
}
