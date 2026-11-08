"use client";

import clsx from "clsx";
import { useSyncExternalStore } from "react";
import type { CustomCellRendererProps, CustomTooltipProps } from "ag-grid-react";
import { StatusPill } from "@/components/ui";
import { barsSentence, duration, formatCents, isPreCheck, type BarState, type CheckBar, type ClaimRow } from "@/app/console/_lib/view";
import { formatClock, formatDayTime, formatTime, plural } from "./format";
import { LinkedIds } from "./LinkedIds";
import { VerdictMark, verdictOf, verdictWord } from "./VerdictMark";

// The claims grid's cells (DESIGN.md "AG Grid", UI-SPEC §3.3). Every cell renders from the index row alone; nothing
// here fetches except the thumbnails, which are sealed, cached, 96px and lazy (only rows AG Grid renders load them).

/** A grid row: a claim, or (with Group by) the full-width row that heads a group of them. */
export type GridRow = ClaimRow & { group?: { key: string; label: string } };

/** What the grid hands every renderer: the homepage still's stacked layout, the checks' slot counts for this recall (so
 * every row's strip has the same length), and the live group totals (a store the group rows subscribe to). */
export interface GridContext {
  stacked?: boolean;
  /** The homepage's phone still: one tag photo per row, the code alone, a reason that wraps. */
  compact?: boolean;
  /** Opens a claim a row's reason names ("Second claim from one PayPal account · RM-7306"). */
  open?: (id: string) => void;
  slots?: { pre: number; model: number };
  groups?: GroupStats;
}

export interface GroupTotal {
  count: number;
  cents: number;
  mix: Partial<Record<ClaimRow["decision"], number>>;
  folded: boolean;
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

/** A phone's still: one 40px square of the claim's first photo (its tag), so every row's photo reads and lines up. */
function TagThumb({ row }: { row: Pick<ClaimRow, "photos"> }) {
  const first = row.photos[0];
  if (!first) return <span aria-hidden="true" className="size-10 shrink-0 rounded-[6px] border border-dashed border-line-strong" />;
  // A private, session-checked route: next/image's optimizer can't fetch it with the company's cookie.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={first.thumb} alt="" aria-hidden="true" width={40} height={40} loading="lazy" decoding="async" className="size-10 shrink-0 rounded-[6px] bg-surface-2 object-cover ring-1 ring-line" />;
}

/** Thumbnails, the claim id (mono 14/500) and its code and filing time (mono 12, faint). The homepage's still
 * (context.stacked) sets the second line in the sans; a phone's (context.compact) shows one tag photo and the code alone. */
export function ClaimCell({ data, context }: Cell) {
  if (!data) return null;
  if (context?.stacked) {
    return (
      <span className="flex h-full items-center gap-3">
        {context.compact ? <TagThumb row={data} /> : <Thumbs row={data} />}
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-mono text-ui font-medium">{data.id}</span>
          <span className="mt-1 truncate text-micro whitespace-nowrap text-muted" title={`Filed ${formatTime(data.createdAt)}`}>
            {data.code ? `Code ${data.code}${context.compact ? "" : ` · ${formatClock(data.createdAt).slice(0, 5)}`}` : formatTime(data.createdAt)}
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex h-full items-center gap-3">
      <span className="relative flex">
        <Thumbs row={data} />
        {/* Shown on a picked row only (ClaimsGrid's pick style): a filled box with a check over the photos' corner. */}
        <span aria-hidden="true" className="pick-box">
          <svg viewBox="0 0 12 12" className="size-3">
            <path d="M2.75 6.25l2.1 2.1 4.4-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-mono text-ui font-medium">{data.id}</span>
        {/* The code on the tag, then the day and time it was filed (UTC, as the column header says): a list spans days,
            and a time alone made it look unsorted. */}
        <span className="mt-0.5 truncate font-mono text-micro whitespace-nowrap text-faint" title={`Filed ${formatTime(data.createdAt)}`}>
          {data.code && (
            <>
              <span className="text-muted">{data.code}</span> ·{" "}
            </>
          )}
          {formatDayTime(data.createdAt)}
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
          // A phone has no hover to read a cut reason: it wraps to a second line there instead.
          <span className={clsx("w-full text-micro leading-tight text-muted", context.compact ? "line-clamp-2 whitespace-normal" : "truncate")} title={data.note}>
            {data.note}
          </span>
        )}
      </span>
    );
  }
  // An approved claim that passed every check says nothing more than its mark and its full strip of checks: the line
  // stays empty, so only the exceptions carry a reason and stand out.
  const note = data.decision === "paid" && data.note === "All checks passed" ? null : data.note;
  return (
    <span className="verdict-track is-mark h-full">
      <VerdictMark verdict={verdictOf(data)} className={EXCEPTION.has(data.decision) ? "text-text" : undefined} />
      {note && (
        <span className="min-w-0 truncate text-ui text-muted" title={note}>
          <LinkedIds text={note} onOpen={context?.open} self={data.id} />
        </span>
      )}
    </span>
  );
}

/** The decisions a reviewer acts on or answers for: their word is in full ink, the rest in the second. */
export const EXCEPTION = new Set<ClaimRow["decision"]>(["held", "rejected", "blocked"]);

// A word only where a check didn't simply pass; a pass is its filled bar alone.
const BAR_WORD: Record<BarState, string> = { pass: "", hold: "Held", reject: "Failed", waiting: "Waiting", skipped: "Not run" };
const barWord = (b: Pick<CheckBar, "id" | "state">) =>
  b.id === "model" && b.state === "hold" ? "No answer" : b.id === "same_item" && b.state === "skipped" ? "One photo, not needed" : BAR_WORD[b.state];

// One bar's shape by state; the hover card (ChecksTooltip) uses the same shapes as its legend. In the console a pass
// is a filled bar in ink: green means money moved, and a strip of checks moves none, so only what held or failed takes
// a colour and stands out down the column. The homepage's still keeps its green passes (`pay`).
function Bar({ bar, pay }: { bar: Pick<CheckBar, "state">; pay?: boolean }) {
  return (
    <span
      data-state={bar.state}
      className={clsx(
        "relative h-4 w-2 shrink-0 overflow-hidden rounded-[1.5px]",
        bar.state === "pass" && (pay ? "bg-pay/70" : "bg-text-2/45"),
        // Held: the top half filled, so it reads without colour.
        bar.state === "hold" && "border border-hold bg-[linear-gradient(var(--hold)_50%,transparent_50%)]",
        // Failed: filled, with a slash in the background colour.
        bar.state === "reject" && "bg-stop after:absolute after:top-1/2 after:-left-1 after:h-px after:w-4 after:-rotate-60 after:bg-bg",
        bar.state === "waiting" && "border border-line-strong",
        // Not needed or not run: a dim hollow box, so the strip keeps its length without claiming a check.
        bar.state === "skipped" && "border border-line-strong opacity-45",
      )}
    />
  );
}

const splitBars = (bars: CheckBar[]) => ({ pre: bars.filter((b) => isPreCheck(b.id)), model: bars.filter((b) => !isPreCheck(b.id)) });

/** The checks as a fixed strip: the four pre-checks, 4px, then the photo check's answers, padded to the recall's longest
 * so every row's strip ends on one x. Shape carries the outcome as well as colour (filled, half, slashed, outline, dim). */
export function Barcode({ bars, slots, pay }: { bars: CheckBar[]; slots?: GridContext["slots"]; pay?: boolean }) {
  const { pre, model } = splitBars(bars);
  const group = (list: CheckBar[], n = 0) => (
    <span className="flex gap-0.5">
      {list.map((b) => (
        <Bar key={b.id} bar={b} pay={pay} />
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
      <Barcode bars={data.bars} slots={context?.slots} pay={context?.stacked} />
    </span>
  );
}

/** How long the photo check took to answer ("11 s"), right-aligned mono. The hover card has every step to the payout. */
export function TimeCell({ data, context }: Cell) {
  if (!data) return null;
  // The homepage's still sets its figures in the sans, as the page around it does.
  const face = context?.stacked ? "" : "font-mono tabular-nums ";
  if (!data.timeline || data.modelSec === null) return <span className={`${face}text-ui text-faint`}>—</span>;
  return (
    <span className={`${face}text-ui text-text-2`}>
      <span className="sr-only">Photo check answered in </span>
      {duration(data.modelSec)}
    </span>
  );
}

/** The payer's last four; "Unverified" in red, on its own line, only when it's true. */
export function PayerCell({ data, context }: Cell) {
  if (!data) return null;
  return (
    <span className="flex h-full flex-col justify-center leading-tight">
      <span className={clsx("text-ui text-muted", !context?.stacked && "font-mono")}>{data.payer}</span>
      {!data.verified && <span className="mt-0.5 text-micro text-stop">Unverified</span>}
    </span>
  );
}

const FAILED = new Set(["FAILED", "RETURNED", "BLOCKED", "DENIED", "REVERSED", "REFUNDED", "CANCELED"]);
// The one wording for an approved refund on a claim that came with the console, which never pays out: here and in
// the drawer's timeline.
export const NO_PAYOUT = "This claim came with your console, so the rule's approval sends no payout.";

/** Whether money left for this claim (a payout PayPal took). */
export const sent = (r: Pick<ClaimRow, "decision" | "payoutStatus" | "seeded">) => r.decision === "paid" && Boolean(r.payoutStatus) && !r.seeded;

/** Where the money is, in the homepage still's words: Sent, Settling or Failed at PayPal; Not sent when PayPal refused
 * an approve; a quiet Approved for a claim that came with the console; a dash while nothing is owed. */
function StillPayout({ data }: { data: GridRow }) {
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
      <span className="inline-flex h-full items-center gap-2 text-ui text-muted" title={NO_PAYOUT}>
        <span className="size-1.5 shrink-0 rounded-full border border-faint" aria-hidden="true" />
        Approved
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

export type PayoutState = { word: "Not sent" | "Sent" | "Refused"; detail: string | null; title: string };

/**
 * The money's one column, in three words: Sent once PayPal has the payout (settling, then settled), Refused when PayPal
 * didn't take it, Not sent for an approved claim no payout went out for (one that came with the console). Null while
 * nothing is owed: a held claim waits for a person, a refused one owes nothing.
 */
export function payoutState(r: Pick<ClaimRow, "decision" | "payoutStatus" | "seeded" | "payoutFailedAt">): PayoutState | null {
  if (r.payoutFailedAt) return { word: "Refused", detail: `PayPal ${formatClock(r.payoutFailedAt).slice(0, 5)}`, title: `PayPal didn't take the payout at ${formatTime(r.payoutFailedAt)}: nothing was paid` };
  if (r.decision === "paid" && !sent(r)) return { word: "Not sent", detail: null, title: NO_PAYOUT };
  if (!r.payoutStatus) return null;
  if (FAILED.has(r.payoutStatus)) return { word: "Refused", detail: "PayPal", title: `PayPal: ${r.payoutStatus}` };
  return { word: "Sent", detail: r.payoutStatus === "SUCCESS" ? "Settled" : "Settling", title: `PayPal: ${r.payoutStatus}` };
}

/** The Payout column: the word, and under it where PayPal has it or when it refused. Refused is the only colour. */
export function PayoutCell({ data, context }: Cell) {
  if (!data) return null;
  if (context?.stacked) return <StillPayout data={data} />;
  const p = payoutState(data);
  if (!p) return <span className="text-faint" aria-label="No payout">—</span>;
  return (
    <span className="flex h-full flex-col justify-center leading-tight" title={p.title}>
      <span className={clsx("text-ui", p.word === "Refused" ? "text-stop" : p.word === "Sent" ? "text-text-2" : "text-muted")}>{p.word}</span>
      {p.detail && <span className="mt-0.5 text-micro text-faint">{p.detail}</span>}
    </span>
  );
}

type AmountTone = "sent" | "approved" | "owed";
const TONE_CLASS: Record<AmountTone, string> = { sent: "text-text", approved: "text-text-2", owed: "text-faint" };

/** "$29.99" as a plain tabular figure, so a column of amounts lines up and copies as it reads. Its tone says where the
 * money is: sent through PayPal (full ink), approved (second tone), or only owed once a person approves (muted).
 * `plain`: the homepage's still, as a finance console prints money: the sans, with proportional figures. */
export function AmountText({ amount, tone, plain }: { amount: string; tone: AmountTone; plain?: boolean }) {
  // Proportional figures, said outright: the grid's right-aligned cells set tabular ones, which space the stop like mono.
  if (plain) return <span className={clsx("text-ui whitespace-nowrap [font-variant-numeric:normal]", TONE_CLASS[tone])}>{amount}</span>;
  return (
    <span className={clsx("font-mono text-ui whitespace-nowrap tabular-nums", TONE_CLASS[tone])}>
      {amount}
    </span>
  );
}

const toneOf = (r: Pick<ClaimRow, "decision" | "payoutStatus" | "seeded">): AmountTone => (sent(r) ? "sent" : r.decision === "paid" ? "approved" : "owed");

export function AmountCell({ data, context }: Cell) {
  if (!data) return null;
  if (!data.amount) return <span className="text-faint" aria-label="No amount">—</span>;
  return (
    <span title={data.decision === "held" ? "Owed once a person approves it" : undefined}>
      <AmountText amount={data.amount} tone={toneOf(data)} plain={context?.stacked} />
    </span>
  );
}

/** Narrow grids: one 88px card per claim. Photo, id and amount; then the pill in its track and the reason; then code, time and payout. */
export function CardRow({ data }: Cell) {
  if (!data) return null;
  // A screen reader hears the card as one labelled sentence, not its columns' glyphs ("—", "·") read one by one.
  const verdict = verdictOf(data);
  const note = data.decision === "paid" && data.note === "All checks passed" ? null : (data.note ?? (data.decision === "paid" ? null : data.reason));
  const said = [
    data.id,
    verdictWord(verdict).toLowerCase(),
    note,
    data.amount ? `${data.amount}${data.decision === "held" ? " once approved" : ""}` : "no refund",
    payoutWord(data),
    data.code && `code ${data.code}`,
    `filed ${formatDayTime(data.createdAt)} UTC`,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <span className="flex h-full items-center gap-3 px-4">
      <span className="sr-only">{said}</span>
      <Thumbs row={data} size="lg" />
      <span aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-ui font-medium">{data.id}</span>
          <span className="shrink-0">{data.amount ? <AmountText amount={data.amount} tone={toneOf(data)} /> : <span className="text-faint">—</span>}</span>
        </span>
        <span className="verdict-track is-mark">
          <VerdictMark verdict={verdict} className={EXCEPTION.has(data.decision) ? "text-text" : undefined} />
          {note && (
            <span className="min-w-0 truncate text-ui text-muted">
              <LinkedIds text={note} />
            </span>
          )}
        </span>
        {/* What the columns say on a wider grid, in one line: the code and filing time (data, in mono), then the payout
            only where money moved or was refused. */}
        <span className="flex min-w-0 items-baseline gap-2 text-micro text-faint">
          <span className="truncate font-mono">{[data.code, formatDayTime(data.createdAt)].filter(Boolean).join(" · ")}</span>
          {payoutState(data)?.word !== "Not sent" && payoutWord(data) && <span className="shrink-0">· {payoutWord(data)}</span>}
        </span>
      </span>
    </span>
  );
}

/** The payout column's word, for the card row's line and the CSV. */
export function payoutWord(r: Pick<ClaimRow, "decision" | "payoutStatus" | "seeded" | "payoutFailedAt">): string | null {
  return payoutState(r)?.word ?? null;
}

/** Group by: the row heading a group, which folds it (a click, Enter, → and ←). Its name, how many claims it holds now
 * (filters apply) and which of them wait on a person or were refused, in words; what the approved ones add up to sits on
 * the Amount column's edge. */
export function GroupRow({ data, context }: Cell) {
  const key = data?.group?.key ?? "";
  const stats = context?.groups;
  const total = useSyncExternalStore(
    stats?.subscribe ?? noop,
    () => stats?.get(key),
    () => stats?.get(key),
  );
  if (!data?.group) return null;
  const folded = Boolean(total?.folded);
  const exceptions = total ? MIX_ORDER.filter((d) => d !== "paid" && total.mix[d]).map((d) => `${total.mix[d]} ${MIX_WORD[d]}`) : [];
  return (
    <span className="flex h-full cursor-pointer items-center gap-2.5 border-t border-line bg-surface-2/50 pr-3 pl-3">
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className={clsx("size-3 shrink-0 text-muted transition-transform duration-160 ease-snap", !folded && "rotate-90")}
      >
        <path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="min-w-0 truncate text-ui font-medium text-text">
        <LinkedIds text={data.group.label} />
      </span>
      <span className="shrink-0 truncate text-ui text-muted">
        {plural(total?.count ?? 0, "claim")}
        {exceptions.length > 0 && `, ${exceptions.join(", ")}`}
        <span className="sr-only">{folded ? ", folded" : ", expanded"}</span>
      </span>
      {total && total.cents > 0 && (
        <span className="ml-auto shrink-0 text-ui text-muted">
          <span className="font-mono text-text-2 tabular-nums">{formatCents(total.cents)}</span> approved
        </span>
      )}
    </span>
  );
}

const MIX_ORDER: ClaimRow["decision"][] = ["paid", "held", "rejected", "blocked", "pending"];
const MIX_WORD: Record<ClaimRow["decision"], string> = { paid: "approved", held: "held", rejected: "rejected", blocked: "blocked", pending: "in progress" };

const noop = () => () => {};

/** A column header's legend (headerTooltip): the column's tooltip component draws the header's too. */
function HeaderTip({ text }: { text: unknown }) {
  return <p className="w-[280px] rounded-card bg-surface px-3.5 py-3 text-ui text-muted shadow-float">{String(text ?? "")}</p>;
}

/** A column whose cells need no hover card: its header's legend only. */
export function HeaderOnlyTip({ location, value }: CustomTooltipProps<GridRow>) {
  return location === "header" ? <HeaderTip text={value} /> : null;
}

/** Hovering the strip: the count, then each check by name with its result, pre-checks first. */
export function ChecksTooltip({ data, location, value, context }: CustomTooltipProps<GridRow, unknown, GridContext>) {
  if (location === "header") return <HeaderTip text={value} />;
  if (!data?.bars) return null;
  const { pre, model } = splitBars(data.bars);
  const groups = [
    { title: "Account checks", bars: pre },
    { title: "Photo check", bars: model },
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
                <Bar bar={b} pay={context?.stacked} />
                <span className="min-w-0 flex-1 truncate text-text-2">{b.label}</span>
                {barWord(b) && <span className="shrink-0 text-micro text-muted">{barWord(b)}</span>}
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
    ["Photo check answered", t.answered],
    ["Decided", t.decided],
    ...(data.seeded
      ? []
      : ([
          ["PayPal sent", t.sent],
          ["PayPal settled", t.settled],
        ] as [string, number | null][])),
  ];
  const tail = data.decision === "paid" && !sent(data) ? NO_PAYOUT : t.end === "held" ? "Waiting for a person to approve or reject." : null;
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

