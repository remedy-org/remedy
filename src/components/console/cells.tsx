"use client";

import clsx from "clsx";
import { useSyncExternalStore } from "react";
import type { CustomCellRendererProps, CustomTooltipProps } from "ag-grid-react";
import { StatusPill } from "@/components/ui";
import { barsSentence, duration, formatCents, isPreCheck, type BarState, type CheckBar, type ClaimRow } from "@/app/console/_lib/view";
import { formatClock, formatTime, plural } from "./format";

// The claims grid's cells (DESIGN.md "AG Grid", UI-SPEC §3.3). Every cell renders from the index row alone; nothing
// here fetches except the thumbnails, which are sealed, cached, 96px and lazy (only rows AG Grid renders load them).

/** A grid row: a claim, or (with Group by) the full-width row that heads a group of them. */
export type GridRow = ClaimRow & { group?: { key: string; label: string }; total?: GridTotal };
export interface GridTotal {
  count: number;
  approvedCents: number;
  sentCents: number;
}

/** What the grid hands every renderer: the homepage still's stacked layout, the checks' slot counts for this recall (so
 * every row's strip has the same length), and the live group totals (a store the group rows subscribe to). */
export interface GridContext {
  stacked?: boolean;
  slots?: { pre: number; model: number };
  groups?: GroupStats;
}

export interface GroupTotal {
  count: number;
  cents: number;
}
export interface GroupStats {
  get(key: string): GroupTotal | undefined;
  subscribe(on: () => void): () => void;
}

type Cell = CustomCellRendererProps<GridRow, unknown, GridContext>;

/** Up to two photos, 32x24, overlapping by 8px; a dashed slot before any arrive. */
export function Thumbs({ row, size = "md" }: { row: Pick<ClaimRow, "photos" | "photoCount">; size?: "md" | "lg" }) {
  const box = size === "md" ? "h-6 w-8" : "h-[30px] w-10";
  const shown = row.photos.slice(0, 2);
  if (!shown.length) {
    return (
      <span aria-hidden="true" className={clsx("flex shrink-0", size === "md" ? "w-14" : "w-[70px]")}>
        <span className={clsx(box, "rounded-[4px] border border-dashed border-line-strong", row.photoCount > 0 && "bg-surface-2")} />
      </span>
    );
  }
  // A fixed slot (room for two overlapping photos), so claim ids line up whether a claim has one photo or two.
  return (
    <span aria-hidden="true" className={clsx("relative flex shrink-0", size === "md" ? "w-14" : "w-[70px]")}>
      {shown.map((p, i) => (
        // A private, session-checked route: next/image's optimizer can't fetch it with the company's cookie.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.thumb}
          src={p.thumb}
          alt=""
          width={size === "md" ? 32 : 40}
          height={size === "md" ? 24 : 30}
          loading="lazy"
          decoding="async"
          className={clsx(box, "rounded-[4px] bg-surface-2 object-cover ring-1 ring-line", i > 0 && (size === "md" ? "-ml-2" : "-ml-2.5"))}
        />
      ))}
    </span>
  );
}

/** Thumbnails, the claim id (mono 14/500) and its code and filing time (mono 12, faint). */
export function ClaimCell({ data }: Cell) {
  if (!data) return null;
  return (
    <span className="flex h-full items-center gap-3">
      <Thumbs row={data} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-mono text-ui font-medium">{data.id}</span>
        {/* The code on the tag, then the time it was filed (UTC, as the column header says; the full date is in the
            title), so the line fits the column. */}
        <span className="mt-0.5 truncate font-mono text-micro whitespace-nowrap text-faint" title={`Filed ${formatTime(data.createdAt)}`}>
          {data.code ? (
            <>
              <span className="text-muted">{data.code}</span> · {formatClock(data.createdAt).slice(0, 5)}
            </>
          ) : (
            formatTime(data.createdAt)
          )}
        </span>
      </span>
    </span>
  );
}

/** The rule's decision: "Approved" until PayPal has the payout, then "Paid". Every other decision keeps its own word. */
export const verdictLabel = (r: Pick<ClaimRow, "decision" | "payoutStatus" | "seeded">) =>
  r.decision === "paid" ? (r.payoutStatus && !r.seeded ? "Paid" : "Approved") : undefined;

/** The pill in a fixed track as wide as the widest pill, then the reason: every reason starts on one x. Under it in
 * the homepage's narrower still (context.stacked), where a truncated sentence beside the pill would say little. */
export function VerdictCell({ data, context }: Cell) {
  if (!data) return null;
  if (context?.stacked) {
    return (
      <span className="flex h-full min-w-0 flex-col items-start justify-center gap-1">
        <StatusPill status={data.decision} label={verdictLabel(data)} />
        {data.note && data.decision !== "paid" && (
          <span className="w-full truncate text-micro leading-tight text-muted" title={data.note}>
            {data.note}
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="verdict-track h-full">
      <StatusPill status={data.decision} label={verdictLabel(data)} />
      {data.note && (
        <span className="min-w-0 truncate text-ui text-muted" title={data.note}>
          {data.note}
        </span>
      )}
    </span>
  );
}

// A word only where a check didn't simply pass; a pass is its filled bar alone.
const BAR_WORD: Record<BarState, string> = { pass: "", hold: "Held", reject: "Failed", waiting: "Waiting", skipped: "Not run" };

// One bar's shape by state; the hover card (ChecksTooltip) uses the same shapes as its legend.
function Bar({ bar }: { bar: Pick<CheckBar, "state"> }) {
  return (
    <span
      className={clsx(
        "relative h-4 w-2 shrink-0 overflow-hidden rounded-[1.5px]",
        bar.state === "pass" && "bg-pay/70",
        // Held: the top half filled, so it reads without colour.
        bar.state === "hold" && "border border-hold bg-[linear-gradient(var(--hold)_50%,transparent_50%)]",
        // Failed: filled, with a slash in the background colour.
        bar.state === "reject" && "bg-stop after:absolute after:top-1/2 after:-left-1 after:h-px after:w-4 after:-rotate-60 after:bg-bg",
        bar.state === "waiting" && "border border-line-strong",
        bar.state === "skipped" && "border border-dotted border-line-strong",
      )}
    />
  );
}

const splitBars = (bars: CheckBar[]) => ({ pre: bars.filter((b) => isPreCheck(b.id)), model: bars.filter((b) => !isPreCheck(b.id)) });

/** The checks as a fixed strip: the four pre-checks, 4px, then the model's answers, padded to the recall's longest so
 * every row's strip ends on one x. Shape carries the outcome as well as colour (filled, half, slashed, outline,
 * dotted). */
export function Barcode({ bars, slots }: { bars: CheckBar[]; slots?: GridContext["slots"] }) {
  const { pre, model } = splitBars(bars);
  const group = (list: CheckBar[], n = 0) => (
    <span className="flex gap-0.5">
      {list.map((b) => (
        <Bar key={b.id} bar={b} />
      ))}
      {Array.from({ length: Math.max(0, n - list.length) }, (_, i) => (
        <span key={`pad-${i}`} className="h-4 w-2 shrink-0" />
      ))}
    </span>
  );
  return (
    <span role="img" aria-label={barsSentence(bars)} className="flex items-center gap-1">
      {group(pre, slots?.pre)}
      {group(model, slots?.model)}
    </span>
  );
}

export function ChecksCell({ data, context }: Cell) {
  if (!data) return null;
  if (!data.bars) return <span className="text-faint" aria-label="Checks not recorded on this row">—</span>;
  return (
    <span className="flex h-full items-center">
      <Barcode bars={data.bars} slots={context?.slots} />
    </span>
  );
}

/** The time from the photos to the payout ("0:11"), right-aligned mono; with no payout to time, the model's answer
 * time, muted. The hover card breaks it down. */
export function TimeCell({ data }: Cell) {
  if (!data) return null;
  if (!data.timeline) return <span className="font-mono text-ui text-faint">—</span>;
  const paid = data.toPay !== null;
  const sec = data.toPay ?? data.modelSec;
  return (
    <span className={clsx("font-mono text-ui tabular-nums", paid ? "text-text" : "text-muted")}>
      <span className="sr-only">{paid ? "Photos to payout: " : "Model answered in "}</span>
      {sec === null ? "—" : duration(sec)}
    </span>
  );
}

/** The payer's last four; "Unverified" in red, on its own line, only when it's true. */
export function PayerCell({ data }: Cell) {
  if (!data) return null;
  return (
    <span className="flex h-full flex-col justify-center leading-tight">
      <span className="font-mono text-ui text-muted">{data.payer}</span>
      {!data.verified && <span className="mt-0.5 text-micro text-stop">Unverified</span>}
    </span>
  );
}

const FAILED = new Set(["FAILED", "RETURNED", "BLOCKED", "DENIED", "REVERSED", "REFUNDED", "CANCELED"]);
const NOT_LIVE = "The payee's PayPal account isn't live, so no payout was sent.";

/** Whether money left for this claim (a payout PayPal took). */
export const sent = (r: Pick<ClaimRow, "decision" | "payoutStatus" | "seeded">) => r.decision === "paid" && Boolean(r.payoutStatus) && !r.seeded;

/** Where the money is: Sent, Settling or Failed at PayPal; Not sent (red, with PayPal's time) when PayPal refused an
 * approve; Not sent (muted) for an approved claim whose payee's account isn't live; a dash while nothing is owed. */
export function PayoutCell({ data }: Cell) {
  if (!data) return null;
  if (data.payoutFailedAt) {
    return (
      <span className="flex h-full flex-col justify-center leading-tight" title={`PayPal didn't take the payout at ${formatTime(data.payoutFailedAt)}: nothing was paid`}>
        <span className="inline-flex items-center gap-1.5 text-ui text-stop">
          <span className="size-1.5 shrink-0 rounded-full bg-stop" aria-hidden="true" />
          Not sent
        </span>
        <span className="font-mono text-micro text-faint">PayPal {formatClock(data.payoutFailedAt).slice(0, 5)}</span>
      </span>
    );
  }
  if (data.decision === "paid" && !sent(data)) {
    return (
      <span className="inline-flex h-full items-center gap-2 text-ui text-muted" title={NOT_LIVE}>
        <span className="size-1.5 shrink-0 rounded-full border border-faint" aria-hidden="true" />
        Not sent
        <span className="sr-only">: {NOT_LIVE}</span>
      </span>
    );
  }
  if (!data.payoutStatus) return <span className="text-faint" aria-label="No payout">—</span>;
  const status = data.payoutStatus;
  const [word, mark] = status === "SUCCESS" ? ["Sent", "bg-pay"] : FAILED.has(status) ? ["Failed", "bg-stop"] : ["Settling", "border border-muted"];
  return (
    <span className="inline-flex h-full items-center gap-2 text-ui text-text-2" title={`PayPal: ${status}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${mark}`} aria-hidden="true" />
      {word}
    </span>
  );
}

/** "$29.99" with the cents at 73%, raised (Mercury's table cents). Money that hasn't left is muted. */
export function AmountText({ amount, muted }: { amount: string; muted?: boolean }) {
  const dot = amount.lastIndexOf(".");
  return (
    <span className={clsx("font-mono text-ui whitespace-nowrap tabular-nums", muted ? "text-muted" : "text-text")}>
      <span className="sr-only">{amount}</span>
      <span aria-hidden="true">
        {amount.slice(0, dot)}
        <span className="relative -top-[0.2em] text-[length:max(12px,0.73em)]">{amount.slice(dot)}</span>
      </span>
    </span>
  );
}

export function AmountCell({ data }: Cell) {
  if (!data) return null;
  if (!data.amount) return <span className="text-faint" aria-label="No amount">—</span>;
  return <AmountText amount={data.amount} muted={!sent(data)} />;
}

/** Narrow grids: one 72px card per claim. Photo, id and amount; then the pill in its track and the reason. */
export function CardRow({ data }: Cell) {
  if (!data) return null;
  return (
    <span className="flex h-full items-center gap-3 px-4">
      <Thumbs row={data} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-ui font-medium">{data.id}</span>
          <span className="shrink-0">{data.amount ? <AmountText amount={data.amount} muted={!sent(data)} /> : <span className="text-faint">—</span>}</span>
        </span>
        <span className="verdict-track">
          <StatusPill status={data.decision} label={verdictLabel(data)} />
          <span className="min-w-0 truncate text-ui text-muted">{data.note ?? data.reason}</span>
        </span>
      </span>
    </span>
  );
}

/** Group by: the row heading a group. Its name, how many claims it holds now (filters apply) and what they add up to. */
export function GroupRow({ data, context }: Cell) {
  const key = data?.group?.key ?? "";
  const stats = context?.groups;
  const total = useSyncExternalStore(
    stats?.subscribe ?? noop,
    () => stats?.get(key),
    () => stats?.get(key),
  );
  if (!data?.group) return null;
  return (
    <span className="flex h-full items-center gap-2 border-t border-line-2 bg-surface-2/60 px-3">
      <span className="min-w-0 truncate text-ui font-medium text-text">{data.group.label}</span>
      <span className="shrink-0 text-ui text-muted">· {plural(total?.count ?? 0, "claim")}</span>
      {total && total.cents > 0 && <span className="ml-auto shrink-0 font-mono text-ui text-muted tabular-nums">{formatCents(total.cents)}</span>}
    </span>
  );
}

const noop = () => () => {};

/** The totals pinned under the grid, over the claims the filters show. */
export function TotalRow({ data }: { data?: GridTotal }) {
  if (!data) return null;
  return (
    <span className="flex h-full items-center gap-2 px-3 font-mono text-micro text-muted tabular-nums">
      <span className="text-text-2">{plural(data.count, "claim")}</span>
      <span aria-hidden="true">·</span>
      <span>{formatCents(data.approvedCents)} approved</span>
      <span aria-hidden="true">·</span>
      <span>{formatCents(data.sentCents)} sent</span>
    </span>
  );
}

/** A column header's legend (headerTooltip): the column's tooltip component draws the header's too. */
function HeaderTip({ text }: { text: unknown }) {
  return <p className="w-[280px] rounded-card bg-surface px-3.5 py-3 text-ui text-muted shadow-float">{String(text ?? "")}</p>;
}

/** Hovering the strip: the count, then each check by name with its result, pre-checks first. */
export function ChecksTooltip({ data, location, value }: CustomTooltipProps<GridRow>) {
  if (location === "header") return <HeaderTip text={value} />;
  if (!data?.bars) return null;
  const { pre, model } = splitBars(data.bars);
  const groups = [
    { title: "Pre-checks", bars: pre },
    { title: "Model answers", bars: model },
  ].filter((g) => g.bars.length);
  return (
    <div className="w-[296px] rounded-card bg-surface px-3.5 py-3 shadow-float">
      <p className="text-ui text-text">{barsSentence(data.bars)}</p>
      {groups.map((g) => (
        <div key={g.title} className="mt-3">
          <p className="text-micro text-faint">{g.title}</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {g.bars.map((b) => (
              <li key={b.id} className="flex items-center gap-2.5 text-ui">
                <Bar bar={b} />
                <span className="min-w-0 flex-1 truncate text-text-2">{b.label}</span>
                {BAR_WORD[b.state] && <span className="shrink-0 text-micro text-muted">{b.id === "model" && b.state === "hold" ? "No answer" : BAR_WORD[b.state]}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Hovering the time: each step after the photos arrived. */
export function TimelineTooltip({ data, location, value }: CustomTooltipProps<GridRow>) {
  if (location === "header") return <HeaderTip text={value} />;
  const t = data?.timeline;
  if (!data || !t) return null;
  const steps: [string, number | null][] = [
    ["Photos in", 0],
    ["Model answered", t.answered],
    ["Rule decided", t.decided],
    ...(data.seeded
      ? []
      : ([
          ["PayPal sent", t.sent],
          ["PayPal settled", t.settled],
        ] as [string, number | null][])),
  ];
  const tail = data.decision === "paid" && !sent(data) ? "Approved. No payout: the payee's PayPal account isn't live." : t.end === "held" ? "Waiting for a person to approve or reject." : null;
  return (
    <div className="w-[240px] rounded-card bg-surface px-3.5 py-3 shadow-float">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-ui">
        {steps.map(([label, v]) => (
          <div key={label} className="contents">
            <dt className={v === null ? "text-faint" : "text-text-2"}>{label}</dt>
            <dd className="text-right font-mono text-micro leading-5 text-muted tabular-nums">{v === null ? "—" : duration(v)}</dd>
          </div>
        ))}
      </dl>
      {tail && <p className="mt-2 border-t border-line pt-2 text-micro text-muted">{tail}</p>}
    </div>
  );
}

/** Hovering a claim: its first photo at 240px, with its number and code. */
export function PhotoTooltip({ data }: CustomTooltipProps<GridRow>) {
  const photo = data?.photos[0];
  if (!data || !photo) return null;
  return (
    <div className="w-[256px] overflow-hidden rounded-card bg-surface p-2 pb-2.5 shadow-float">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.large} alt={`Photo 1 of ${data.photoCount} for ${data.id}`} width={240} height={180} className="block h-[180px] w-[240px] rounded-control bg-surface-2 object-cover" />
      <p className="mt-2 flex justify-between px-0.5 font-mono text-micro text-muted">
        <span>Photo 1 of {data.photoCount}</span>
        {data.code && <span>Code {data.code}</span>}
      </p>
    </div>
  );
}

