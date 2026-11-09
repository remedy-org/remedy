"use client";

import clsx from "clsx";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { CustomCellRendererProps, CustomTooltipProps } from "ag-grid-react";
import { barsSentence, duration, fiveOf, formatCents, isPreCheck, type BarState, type CheckBar, type ClaimRow } from "@/app/console/_lib/view";
import { checkOf, FIVE_CHECKS, type Outcome } from "@/lib/fiveChecks";
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
      <span aria-hidden="true" className={clsx("flex shrink-0", size === "md" ? "w-14" : "w-12")}>
        <span className={clsx(box, size === "md" && "mx-auto", "rounded-[4px] border border-dashed border-line-strong", row.photoCount > 0 && "bg-surface-2")} />
      </span>
    );
  }
  // A fixed slot, so claim ids line up whether a claim has one photo or two, each centred in it; a phone's card starts its
  // photo on the card's 16px inset instead, in a slot just wide enough for two. Two photos stack as two prints: the
  // second behind the first, 6px up and to the right, the first ringed in the row's ground, so they never read as one
  // wide photo.
  return (
    <span aria-hidden="true" className={clsx("thumbs relative flex shrink-0", size === "md" ? "w-14 justify-center" : "w-12")}>
      <span className={clsx("relative flex", shown.length > 1 && (size === "md" ? "pt-1.5 pr-1.5" : "pt-2 pr-2"))}>
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
            className={clsx(
              box,
              "rounded-[4px] bg-surface-2 object-cover",
              i === 0 ? "relative z-[1] ring-1 ring-line" : "absolute top-0 right-0 ring-1 ring-line",
              i === 0 && shown.length > 1 && "outline-[1.5px] outline-offset-1 outline-bg outline-solid",
            )}
          />
        ))}
      </span>
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

/** Thumbnails, the claim id (mono 14/500) and its filing time (mono 12, faint), on the homepage's still (context.stacked)
 * as in the console; a phone's (context.compact) shows one tag photo and the time. */
export function ClaimCell({ data, context }: Cell) {
  if (!data) return null;
  if (context?.stacked) {
    return (
      <span className="flex h-full items-center gap-3">
        {context.compact ? <TagThumb row={data} /> : <Thumbs row={data} />}
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-mono text-ui font-medium">{data.id}</span>
          {/* When it was filed, as the console's second line ends: the day and time, so the newest-first order reads. The
              code is left to the claim's evidence. */}
          <span className="mt-0.5 truncate font-mono text-micro whitespace-nowrap text-faint" title={`Filed ${formatTime(data.createdAt)}`}>
            {context.compact ? formatClock(data.createdAt).slice(0, 5) : formatDayTime(data.createdAt)}
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex h-full items-center gap-3">
      <span className="relative flex">
        <Thumbs row={data} />
        {/* Shown on a picked row only (ClaimsGrid's pick style): a filled box with a check in place of the photos. */}
        <span aria-hidden="true" className="pick-box">
          <svg viewBox="0 0 12 12" className="size-3">
            <path d="M2.75 6.25l2.1 2.1 4.4-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-mono text-ui font-medium">{data.id}</span>
        {/* The day and time it was filed (UTC, as the heading says): a list spans days, and a time alone made it look
            unsorted. Each claim's one-time code belongs to that claim alone, so it is the evidence's to show (Tag must
            read), beside the photos it is checked against; search still finds a claim by it. */}
        <span className="mt-0.5 truncate font-mono text-micro whitespace-nowrap text-faint" title={`Filed ${formatTime(data.createdAt)}`}>
          {formatDayTime(data.createdAt)}
        </span>
      </span>
    </span>
  );
}

/** The mark in a fixed track as wide as the widest, then the reason: every reason starts on one x (under the mark in a
 * narrow cell, claims-grid.css). On a phone's still (context.stacked and compact) the reason is under it, two lines at
 * most; the homepage's laptop still draws it as the console does. */
export function VerdictCell({ data, context }: Cell) {
  if (!data) return null;
  if (context?.stacked && context.compact) {
    return (
      <span className="flex h-full min-w-0 flex-col items-start justify-center gap-1">
        <VerdictMark verdict={verdictOf(data)} className={EXCEPTION.has(data.decision) ? "text-text" : undefined} />
        {data.note && data.decision !== "paid" && (
          // A phone has no hover to read a cut reason: it wraps to a second line there instead.
          <span className="line-clamp-2 w-full text-micro leading-tight whitespace-normal text-muted" title={data.note}>
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

// One bar's shape by state; the hover card (ChecksTooltip) uses the same shapes as its legend. A pass is a solid bar
// in ink: green means money moved, and a strip of checks moves none, so only what held or failed takes a colour and
// stands out down the column. A check not run is a dashed outline, one still waiting a solid one: neither reads as a
// pass at a glance.
function Bar({ bar }: { bar: Pick<CheckBar, "state"> }) {
  return (
    <span
      data-state={bar.state}
      className={clsx(
        "relative h-4 w-2 shrink-0 overflow-hidden rounded-[1.5px]",
        bar.state === "pass" && "bg-text-2",
        // Held: the top half filled, so it reads without colour.
        bar.state === "hold" && "border border-hold bg-[linear-gradient(var(--hold)_50%,transparent_50%)]",
        // Failed: filled, with a slash in the background colour.
        bar.state === "reject" && "bg-stop after:absolute after:top-1/2 after:-left-1 after:h-px after:w-4 after:-rotate-60 after:bg-bg",
        bar.state === "waiting" && "border border-line-strong",
        // Not run: a dashed outline, empty, so the strip keeps its slot without claiming a check.
        bar.state === "skipped" && "border border-dashed border-line-strong",
      )}
    />
  );
}

/** A span as the console prints it ("11 s", "7 min 28 s"): the figures in mono, each unit in the sans, faint, after a
 * narrow no-break space, so the gap is a thin one beside $29.99 rather than a typewriter's. */
export function DurationText({ sec, plus = false, className }: { sec: number; plus?: boolean; className?: string }) {
  const parts = duration(sec).split(" ");
  return (
    <span className={clsx("whitespace-nowrap", className)}>
      {plus && <span className="font-mono">+</span>}
      {parts.map((t, i) =>
        /\d/.test(t) ? (
          <span key={i} className="font-mono tabular-nums">
            {i > 0 ? "\u00a0" : ""}
            {t}
          </span>
        ) : (
          <span key={i} className="font-sans text-faint">
            {"\u202f"}
            {t}
          </span>
        ),
      )}
    </span>
  );
}

export function ChecksCell({ data }: Cell) {
  if (!data) return null;
  if (!data.bars) return <span className="text-faint" aria-label="Checks not recorded on this row">—</span>;
  return (
    <span className="flex h-full items-center">
      <FiveBarcode bars={data.bars} />
    </span>
  );
}

/** A recorded answer's state as one of the five checks' outcome shows it. */
const FIVE_STATE: Record<Outcome, BarState> = { pass: "pass", skipped: "skipped", hold: "hold", fail: "reject", open: "waiting" };

/**
 * The strip, in the console and on the homepage alike: the five checks the page names, three that run before any AI and
 * the model's two, one bar each, coloured by its worst answer (fiveOf groups the recorded answers under them; the hover
 * card lists them), so the grid counts five checks as the panel, the receipt and How it works do.
 */
function FiveBarcode({ bars }: { bars: CheckBar[] }) {
  const five = fiveOf(bars).map((c) => ({ id: String(c.n), state: FIVE_STATE[c.outcome] }));
  return (
    <span role="img" aria-label={barsSentence(bars)} className="flex items-center gap-2.5">
      <span className="flex gap-0.5">
        {five.slice(0, 3).map((b) => (
          <Bar key={b.id} bar={b} />
        ))}
      </span>
      <span className="flex gap-0.5">
        {five.slice(3).map((b) => (
          <Bar key={b.id} bar={b} />
        ))}
      </span>
    </span>
  );
}

/** How long the photo check took to answer ("11 s"), right-aligned. The hover card has every step to the payout. An
 * empty cell is the column's one dash, in the sans, as every other column's. */
export function TimeCell({ data, context }: Cell) {
  if (!data) return null;
  if (!data.timeline || data.modelSec === null) return <span className="text-ui text-faint">—</span>;
  // The homepage's still prints it as the console does: the figure in mono, the unit in the sans.
  if (context?.stacked) {
    return (
      <span className="text-ui text-text-2">
        <DurationText sec={data.modelSec} />
      </span>
    );
  }
  // The payout time under it, faint, only where it says something the answer doesn't: a person approved the claim
  // later, or PayPal took a while. Most claims are paid a second after the answer.
  const later = sent(data) && data.toPay !== null && data.toPay - data.modelSec > 5 ? data.toPay : null;
  return (
    <span className="flex h-full flex-col items-end justify-center leading-tight">
      <span className="text-ui text-text-2">
        <span className="sr-only">Photo check answered in </span>
        <DurationText sec={data.modelSec} />
      </span>
      {later !== null && (
        <span className="mt-0.5 text-micro text-faint">
          <span className="font-sans">paid </span>
          <DurationText sec={later} />
        </span>
      )}
    </span>
  );
}

/** Photos to PayPal taking the payout, for claims a payout was sent for; a dash for the rest. */
export function ToPayCell({ data }: Cell) {
  if (!data) return null;
  if (data.toPay === null || !sent(data)) return <span className="text-ui text-faint">—</span>;
  return (
    <span className="text-ui text-text-2">
      <span className="sr-only">Photo to payout </span>
      <DurationText sec={data.toPay} />
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
/** Whether money left for this claim (a payout PayPal took). */
export const sent = (r: Pick<ClaimRow, "decision" | "payoutStatus">) => r.decision === "paid" && Boolean(r.payoutStatus);

export type PayoutState = { word: "Paid" | "Sent" | "Refused"; detail: string | null; title: string };

/**
 * The money's one column, in the one payout vocabulary (lib/payoutWords.ts): Sent and Settling once PayPal has the
 * payout, Paid once PayPal confirmed it, Refused when PayPal didn't take it. Null while nothing is owed: a held claim
 * waits for a person, a refused one owes nothing, an approved one has nothing sent.
 */
export function payoutState(r: Pick<ClaimRow, "decision" | "payoutStatus" | "payoutFailedAt">): PayoutState | null {
  if (r.payoutFailedAt) return { word: "Refused", detail: `PayPal ${formatClock(r.payoutFailedAt).slice(0, 5)}`, title: `PayPal didn’t take the payout at ${formatTime(r.payoutFailedAt)}: nothing was paid` };
  if (!r.payoutStatus) return null;
  if (FAILED.has(r.payoutStatus)) return { word: "Refused", detail: "PayPal", title: `PayPal: ${r.payoutStatus}` };
  return r.payoutStatus === "SUCCESS" ? { word: "Paid", detail: "PayPal confirmed", title: "PayPal: SUCCESS" } : { word: "Sent", detail: "Settling", title: `PayPal: ${r.payoutStatus}` };
}

/** The Payout column: the word, and under it where PayPal has it or when it refused. Refused is the only colour. */
export function PayoutCell({ data }: Cell) {
  if (!data) return null;
  const p = payoutState(data);
  if (!p) return <span className="text-faint" aria-label="No payout">—</span>;
  return (
    <span className="flex h-full flex-col justify-center leading-tight" title={p.title}>
      <span className={clsx("text-ui", p.word === "Refused" ? "text-stop" : "text-text-2")}>{p.word}</span>
      {p.detail && <span className="mt-0.5 text-micro text-faint">{p.detail}</span>}
    </span>
  );
}

type AmountTone = "sent" | "approved" | "owed";
const TONE_CLASS: Record<AmountTone, string> = { sent: "text-text", approved: "text-text-2", owed: "text-faint" };

/** "$29.99" as a plain tabular figure, so a column of amounts lines up and copies as it reads. Its tone says where the
 * money is: sent through PayPal (full ink), approved (second tone), or only owed once a person approves (muted). The
 * homepage's still prints it the same way. */
export function AmountText({ amount, tone }: { amount: string; tone: AmountTone }) {
  return (
    <span className={clsx("font-mono text-ui whitespace-nowrap tabular-nums", TONE_CLASS[tone])}>
      {amount}
    </span>
  );
}

const toneOf = (r: Pick<ClaimRow, "decision" | "payoutStatus">): AmountTone => (sent(r) ? "sent" : r.decision === "paid" ? "approved" : "owed");

export function AmountCell({ data }: Cell) {
  if (!data) return null;
  if (!data.amount) return <span className="text-faint" aria-label="No amount">—</span>;
  return (
    <span title={data.decision === "held" ? "Owed once a person approves it" : undefined}>
      <AmountText amount={data.amount} tone={toneOf(data)} />
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
        <span className="verdict-track is-mark is-card">
          <VerdictMark verdict={verdict} className={EXCEPTION.has(data.decision) ? "text-text" : undefined} />
          {/* Two lines on a phone rather than cut mid-word: the reason is what tells this claim apart. */}
          {note && (
            <span className="line-clamp-2 min-w-0 text-ui whitespace-normal text-muted">
              <LinkedIds text={note} />
            </span>
          )}
        </span>
        {/* What the columns say on a wider grid, in one line: the filing time (data, in mono), then the payout only where
            money moved or was refused. */}
        <span className="flex min-w-0 items-baseline gap-2 text-micro text-faint">
          <span className="truncate font-mono">{formatDayTime(data.createdAt)}</span>
          {payoutWord(data) && <span className="shrink-0">· {payoutWord(data)}</span>}
        </span>
      </span>
    </span>
  );
}

/** The payout column's word, for the card row's line and the CSV. */
export function payoutWord(r: Pick<ClaimRow, "decision" | "payoutStatus" | "payoutFailedAt">): string | null {
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


/** Hovering the strip: the count, then each of the five checks by the name the evidence, the homepage and the owner's
 * receipt give it (fiveChecks.ts fiveNames), one row each with its bar and word as the strip draws it; under a check,
 * its finer answers (the tag's label and code, the photo's steps), which sit only here. An answer named as its check is
 * that check's own row, never a heading over a row that repeats it. A check that doesn't apply to this claim keeps its
 * dash in the strip but isn't listed. */
export function ChecksTooltip({ data, location, value, context }: CustomTooltipProps<GridRow, unknown, GridContext>) {
  if (location === "header") return <HeaderTip text={value} />;
  if (!data?.bars) return null;
  if (context?.stacked) return <FiveCard row={data} bars={data.bars} />;
  return <ChecksCard row={data} bars={data.bars} />;
}

/**
 * The console's checks card. It escapes the grid (claims-grid.css fixes it to the screen, so the grid's rounded frame
 * never clips it on the last rows) and sits 8px under the hovered row, or over it where the screen's foot has no room,
 * never under the app bar.
 */
function ChecksCard({ row, bars }: { row: GridRow; bars: CheckBar[] }) {
  const card = useRef<HTMLDivElement>(null);
  const id = row.id;
  useLayoutEffect(() => {
    const el = card.current;
    const cell = el?.ownerDocument.querySelector<HTMLElement>(`.claims-grid .ag-row[row-id="${CSS.escape(id)}"] .ag-cell[col-id="checks"]`);
    if (!el || !cell) return;
    // AG Grid places its popup at the pointer after this renders: measured once it has, then moved from there.
    let frame = 0;
    const place = () => {
      el.style.translate = "";
      const box = el.getBoundingClientRect();
      const at = cell.closest(".ag-row")!.getBoundingClientRect();
      const bar = 72;
      const foot = innerHeight - 8;
      const below = at.bottom + 8;
      const above = at.top - 8 - box.height;
      const top = below + box.height <= foot ? below : above >= bar ? above : Math.max(bar, foot - box.height);
      const left = Math.max(8, Math.min(cell.getBoundingClientRect().left, innerWidth - 8 - box.width));
      el.style.translate = `${Math.round(left - box.left)}px ${Math.round(top - box.top)}px`;
    };
    place();
    frame = requestAnimationFrame(() => (place(), (frame = requestAnimationFrame(place))));
    return () => cancelAnimationFrame(frame);
  }, [id]);
  const shown = bars.filter((b) => !(isPreCheck(b.id) && b.state === "skipped"));
  const five = fiveOf(bars);
  const checks = FIVE_CHECKS.map((c) => {
    const title = row.checkNames?.[c.n - 1] ?? c.short;
    const of = shown.filter((b) => checkOf(b.id) === c.n);
    return { n: c.n, title, state: FIVE_BAR[five[c.n - 1].outcome], listed: of.length > 0, answers: of.filter((b) => b.label !== title) };
  }).filter((c) => c.listed);
  return (
    // Wide enough for the longest check beside its longest word ("Same item in both photos", "One photo, not needed");
    // a longer one wraps, never cut.
    <div ref={card} data-float="" className="w-[360px] rounded-card bg-surface px-3.5 py-3 shadow-float">
      <p className="text-ui text-text">{barsSentence(bars)}</p>
      <ul className="mt-2.5 flex flex-col gap-2">
        {checks.map((c) => (
          <li key={c.n}>
            <span className="flex items-center gap-2.5 text-ui">
              <Bar bar={{ state: c.state }} />
              <span className="min-w-0 flex-1 text-text-2">{c.title}</span>
              {BAR_WORD[c.state] && <span className="shrink-0 text-micro text-muted">{BAR_WORD[c.state]}</span>}
            </span>
            {c.answers.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5 pl-[18px]">
                {c.answers.map((b) => (
                  <li key={b.id} className="flex items-baseline gap-2.5 text-micro">
                    <span className="min-w-0 flex-1 text-muted">{b.label}</span>
                    {barWord(b) && <span className="shrink-0 text-faint">{barWord(b)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const FIVE_BAR: Record<Outcome, BarState> = { pass: "pass", hold: "hold", fail: "reject", open: "waiting", skipped: "skipped" };
const FIVE_WORD: Record<Outcome, string> = { pass: "Passed", hold: "Held", fail: "Failed", open: "Waiting", skipped: "Not run" };

/**
 * The homepage's checks card: the five checks as the strip draws them, one bar each, with each one's outcome, under the
 * strip's own count ("4 of 5 checks passed · 1 held"). It sits 8px under the hovered row, or over it near the list's foot,
 * and never over the column header.
 */
function FiveCard({ row, bars }: { row: GridRow; bars: CheckBar[] }) {
  const card = useRef<HTMLDivElement>(null);
  const id = row.id;
  useLayoutEffect(() => {
    const el = card.current;
    const cell = el?.ownerDocument.querySelector<HTMLElement>(`.claims-grid .ag-row[row-id="${CSS.escape(id)}"] .ag-cell[col-id="checks"]`);
    const body = cell?.closest(".claims-grid")?.querySelector<HTMLElement>(".ag-body-viewport");
    if (!el || !cell || !body) return;
    // AG Grid places its popup at the pointer after this renders: measured once it has, then moved from there.
    let frame = 0;
    const place = () => {
      el.style.translate = "";
      const box = el.getBoundingClientRect();
      const at = cell.closest(".ag-row")!.getBoundingClientRect();
      const room = body.getBoundingClientRect();
      const below = at.bottom + 8;
      const above = at.top - 8 - box.height;
      const top = below + box.height <= room.bottom ? below : above >= room.top ? above : Math.max(room.top, room.bottom - box.height);
      el.style.translate = `${Math.round(cell.getBoundingClientRect().left - box.left)}px ${Math.round(top - box.top)}px`;
    };
    place();
    frame = requestAnimationFrame(() => (place(), (frame = requestAnimationFrame(place))));
    return () => cancelAnimationFrame(frame);
  }, [id]);
  const five = fiveOf(bars);
  return (
    <div ref={card} className="w-[320px] rounded-card bg-surface px-3.5 py-3 shadow-float">
      <p className="text-ui text-text">{barsSentence(bars)}</p>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {five.map((f) => (
          <li key={f.n} className="flex items-center gap-2.5 text-ui">
            <Bar bar={{ state: FIVE_BAR[f.outcome] }} />
            <span className="min-w-0 flex-1 text-text-2">{row.checkNames?.[f.n - 1] ?? FIVE_CHECKS[f.n - 1].short}</span>
            <span className="shrink-0 text-micro text-muted">{FIVE_WORD[f.outcome]}</span>
          </li>
        ))}
      </ul>
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
    ["PayPal sent", t.sent],
    ["PayPal settled", t.settled],
  ];
  const tail = t.end === "held" ? "Waiting for a person to approve or reject." : null;
  return (
    <div className="w-[240px] rounded-card bg-surface px-3.5 py-3 shadow-float">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-ui">
        {steps.map(([label, v]) => (
          <div key={label} className="contents">
            <dt className={v === null ? "text-faint" : "text-text-2"}>{label}</dt>
            <dd className="text-right text-micro leading-5 text-muted">{v === null ? "—" : <DurationText sec={v} />}</dd>
          </div>
        ))}
      </dl>
      {tail && <p className="mt-2 border-t border-line pt-2 text-micro text-muted">{tail}</p>}
    </div>
  );
}

/** Hovering a claim: its first photo at 240px, with its number and code, just above the claim's row rather than under
 * the pointer, where it covered the row's own verdict. */
export function PhotoTooltip({ data }: CustomTooltipProps<GridRow>) {
  const card = useRef<HTMLDivElement>(null);
  const id = data?.id;
  useLayoutEffect(() => {
    const el = card.current;
    const cell = id ? document.querySelector<HTMLElement>(`.claims-grid .ag-row[row-id="${CSS.escape(id)}"] .ag-cell[col-id="createdAt"]`) : null;
    if (!el || !cell) return;
    // AG Grid places its popup at the pointer after this renders: measured once it has, then moved from there.
    let frame = 0;
    const place = () => {
      el.style.translate = "";
      const box = el.getBoundingClientRect();
      const at = cell.getBoundingClientRect();
      // Above the row (below it when there is no room), from the claim cell's left edge: the row itself, its verdict
      // included, stays in view beside the photo.
      const top = at.top - box.height - 6 >= 64 ? at.top - box.height - 6 : at.bottom + 6;
      el.style.translate = `${Math.round(at.left + 8 - box.left)}px ${Math.round(top - box.top)}px`;
    };
    place();
    frame = requestAnimationFrame(() => (place(), (frame = requestAnimationFrame(place))));
    return () => cancelAnimationFrame(frame);
  }, [id]);
  const photo = data?.photos[0];
  if (!data || !photo) return null;
  return (
    <div ref={card} className="w-[256px] overflow-hidden rounded-card bg-surface p-2 pb-2.5 shadow-float">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.large} alt={`Photo 1 of ${data.photoCount} for ${data.id}`} width={240} height={180} className="block h-[180px] w-[240px] rounded-control bg-surface-2 object-cover" />
      <p className="mt-2 flex justify-between px-0.5 font-mono text-micro text-muted">
        <span>Photo 1 of {data.photoCount}</span>
        {data.code && <span>Code {data.code}</span>}
      </p>
    </div>
  );
}

