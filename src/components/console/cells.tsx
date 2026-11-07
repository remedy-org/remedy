"use client";

import clsx from "clsx";
import type { CustomCellRendererProps, CustomTooltipProps } from "ag-grid-react";
import { StatusPill } from "@/components/ui";
import { checkOf, FIVE_CHECKS } from "@/lib/fiveChecks";
import { barsSentence, duration, type BarState, type CheckBar, type ClaimRow, type RowTimeline } from "@/app/console/_lib/view";
import { formatClock, formatTime } from "./format";

// The claims grid's cells (DESIGN.md "AG Grid", UI-SPEC §3.3). Every cell renders from the index row alone; nothing
// here fetches except the thumbnails, which are sealed, cached, 96px and lazy (only rows AG Grid renders load them).

type Cell = CustomCellRendererProps<ClaimRow>;

const SAMPLE_TITLE = { seeded: "Sample claim from the eval set: never paid", demo: "Filed through the judges' demo with sandbox money" };

/** The 6px diamond itself, neutral (amber is the one action's): hollow for a sample claim, filled for a judges' demo
 * claim. The note over the grid shows both, labelled. */
export function SampleDiamond({ demo }: { demo?: boolean }) {
  return <span aria-hidden="true" className={clsx("size-1.5 shrink-0 rotate-45 border", demo ? "border-muted bg-muted" : "border-faint")} />;
}

/** A diamond after a sample or demo claim's id. */
export function SampleMark({ row }: { row: Pick<ClaimRow, "seeded" | "demo"> }) {
  if (!row.seeded && !row.demo) return null;
  const title = row.seeded ? SAMPLE_TITLE.seeded : SAMPLE_TITLE.demo;
  return (
    <span title={title} className="inline-flex size-3 shrink-0 items-center justify-center">
      <SampleDiamond demo={!row.seeded} />
      <span className="sr-only">{title}</span>
    </span>
  );
}

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

/** Thumbnails, the claim id (mono 14/500) and when it was filed (mono 12, faint). */
export function ClaimCell({ data }: Cell) {
  if (!data) return null;
  return (
    <span className="flex h-full items-center gap-3">
      <Thumbs row={data} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-ui font-medium">{data.id}</span>
          <SampleMark row={data} />
        </span>
        {/* The claim's one-time code, as the sign-in page's replica shows it, then the time it was filed (UTC, as the
            column header says; the full date is in the tooltip), so the line fits the column. */}
        <span className="mt-0.5 truncate font-mono text-micro whitespace-nowrap text-faint" title={`Filed ${formatTime(data.createdAt)}`}>
          {data.code ? (
            <>
              <span className="text-muted">Code {data.code}</span> · {formatClock(data.createdAt).slice(0, 5)}
            </>
          ) : (
            formatTime(data.createdAt)
          )}
        </span>
      </span>
    </span>
  );
}

/** The pill, then the reason in one muted line when it says more than the pill: beside it in the queue, under it in
 * the homepage's narrower still (context.stacked), where a truncated sentence beside the pill would say little. */
export function VerdictCell({ data, context }: Cell & { context?: { stacked?: boolean } }) {
  if (!data) return null;
  if (context?.stacked) {
    return (
      <span className="flex h-full min-w-0 flex-col items-start justify-center gap-1">
        <StatusPill status={data.decision} />
        {data.note && data.decision !== "paid" && (
          <span className="w-full truncate text-micro leading-tight text-muted" title={data.note}>
            {data.note}
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="flex h-full min-w-0 items-center gap-3">
      <StatusPill status={data.decision} />
      {data.note && (
        <span className="min-w-0 truncate text-ui text-muted" title={data.note}>
          {data.note}
        </span>
      )}
    </span>
  );
}

const BAR_WORD: Record<BarState, string> = { pass: "passed", hold: "unclear, held", reject: "failed", waiting: "waiting", skipped: "not run" };

// One bar's shape by state; the grid's hover card (ChecksTooltip) uses the same shapes as its legend.
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

/** The bars under the homepage's five checks, in order, then any hold from the process (the model down, PayPal). */
function byCheck(bars: CheckBar[]): { title: string; bars: CheckBar[] }[] {
  return [
    ...FIVE_CHECKS.map((c) => ({ title: `${c.n} · ${c.short}`, bars: bars.filter((b) => checkOf(b.id) === c.n) })),
    { title: "Other holds", bars: bars.filter((b) => checkOf(b.id) === null) },
  ].filter((g) => g.bars.length);
}

/** The evidence barcode: one 8x16 bar per answer recorded, grouped by the five checks with a 4px gap between them. Shape
 * carries the outcome as well as colour (filled, half, slashed, outline, dotted). */
export function Barcode({ bars }: { bars: CheckBar[] }) {
  const groups = byCheck(bars).map((g) => g.bars);
  return (
    <span role="img" aria-label={barsSentence(bars)} className="flex items-center gap-1">
      {groups.map((g, i) => (
        <span key={i} className="flex gap-0.5">
          {g.map((b) => (
            <Bar key={b.id} bar={b} />
          ))}
        </span>
      ))}
    </span>
  );
}

export function ChecksCell({ data }: Cell) {
  if (!data) return null;
  if (!data.bars) return <span className="text-faint" aria-label="Checks not recorded on this row">—</span>;
  return (
    <span className="flex h-full items-center">
      <Barcode bars={data.bars} />
    </span>
  );
}

// The timeline's scale: 0 to 120 s after the photos arrive, clamped.
const SCALE = 120;
// 92px wide, so the track and a "1:05" chip fit the 168px column (144px inside its padding).
const W = 92;
const x = (sec: number) => 4 + (Math.min(sec, SCALE) / SCALE) * (W - 8);

/** A 92x12 track from the photos arriving: dots where the model answered, the rule decided, PayPal sent and PayPal
 * settled, on a 0 to 120 s scale. Held ends on a hollow blue dot (a person decides), refused on a red tick. */
export function TimelineTrack({ t, decision }: { t: RowTimeline; decision: ClaimRow["decision"] }) {
  const last = Math.max(0, ...[t.answered, t.decided, t.sent, t.settled].filter((v): v is number => v !== null));
  const end = x(last);
  const stop = decision === "rejected" || decision === "blocked";
  return (
    <svg width={W} height={12} viewBox={`0 0 ${W} 12`} aria-hidden="true" className="shrink-0 overflow-visible">
      <line x1={4} x2={W - 4} y1={6} y2={6} stroke="var(--line-strong)" strokeOpacity={0.45} strokeDasharray="1 3" />
      <line x1={4} x2={end} y1={6} y2={6} stroke="var(--muted)" strokeWidth={1} />
      <circle cx={4} cy={6} r={2} fill="var(--muted)" />
      {t.answered !== null && <circle cx={x(t.answered)} cy={6} r={2} fill="var(--muted)" />}
      {t.decided !== null && !stop && t.end !== "held" && <circle cx={x(t.decided)} cy={6} r={2} fill="var(--text)" />}
      {t.sent !== null && <circle cx={x(t.sent)} cy={6} r={2.5} fill="var(--pay)" />}
      {t.settled !== null && <circle cx={x(t.settled)} cy={6} r={3.5} fill="var(--pay)" stroke="var(--surface)" strokeWidth={1} />}
      {t.end === "held" && <circle cx={x(t.decided ?? last)} cy={6} r={3} fill="var(--surface)" stroke="var(--hold)" strokeWidth={1.5} />}
      {stop && <line x1={x(t.decided ?? last)} x2={x(t.decided ?? last)} y1={1} y2={11} stroke="var(--stop)" strokeWidth={2} strokeLinecap="round" />}
      {t.end === "open" && <circle cx={end} cy={6} r={3} fill="none" stroke="var(--text)" strokeWidth={1.5} className="pending-dot" />}
    </svg>
  );
}

/** What the timeline says in words, for screen readers and the tooltip. */
function timelineSentence(d: ClaimRow): string {
  const t = d.timeline;
  if (!t) return d.photoCount ? "No times recorded on this row" : "Waiting for photos";
  const at = (label: string, v: number | null) => (v === null ? [] : [`${label} at ${duration(v)}`]);
  const steps = [...at("model answered", t.answered), ...at("rule decided", t.decided), ...at("PayPal sent", t.sent), ...at("PayPal settled", t.settled)];
  const tail = d.seeded && d.decision === "paid" ? "; a sample claim, never paid" : t.end === "held" ? "; waiting for a person" : "";
  return `From the photos: ${steps.join(", ") || "checking"}${tail}`;
}

/** The track, then the time to pay as a chip ("0:41"). A claim with no payout to time (held, refused, a sample) shows
 * the model's answer time instead, unboxed, in the same "0:03" format; the hover card says which it is. */
export function TimelineCell({ data }: Cell) {
  if (!data) return null;
  if (!data.timeline) return <span className="font-mono text-micro text-faint">{data.photoCount ? "—" : "No photos yet"}</span>;
  return (
    <span className="flex h-full items-center gap-2">
      <TimelineTrack t={data.timeline} decision={data.decision} />
      <span className="sr-only">{timelineSentence(data)}</span>
      {data.toPay !== null ? (
        <span className="inline-flex h-5 items-center rounded-control bg-surface-2 px-1.5 font-mono text-micro text-text tabular-nums" aria-hidden="true">
          {duration(data.toPay)}
        </span>
      ) : data.modelSec !== null ? (
        // No payout to time (held, refused, or a sample): the model's answer time, whenever it answered.
        <span className="font-mono text-micro text-faint tabular-nums" aria-hidden="true">
          {duration(data.modelSec)}
        </span>
      ) : null}
    </span>
  );
}

/** The payer's last four; "Unverified" in red only when it's true. */
export function PayerCell({ data }: Cell) {
  if (!data) return null;
  return (
    <span className="flex h-full items-center gap-2">
      <span className="font-mono text-ui text-muted">{data.payer}</span>
      {!data.verified && <span className="text-micro text-stop">Unverified</span>}
    </span>
  );
}

const FAILED = new Set(["FAILED", "RETURNED", "BLOCKED", "DENIED", "REVERSED", "REFUNDED", "CANCELED"]);

/** PayPal's status in a word: Sent, Settling or Failed. A sample claim's payout was never sent, and says so; a held
 * claim whose approve PayPal refused says Not sent, in red, and when. */
export function PayoutCell({ data }: Cell) {
  if (!data) return null;
  if (data.payoutFailedAt) {
    return (
      <span className="flex h-full flex-col justify-center leading-tight" title={`The payout wasn't sent at ${formatTime(data.payoutFailedAt)}: nothing was paid`}>
        <span className="inline-flex items-center gap-1.5 text-ui text-stop">
          <span className="size-1.5 shrink-0 rounded-full bg-stop" aria-hidden="true" />
          Not sent
        </span>
        <span className="font-mono text-micro text-faint">PayPal {formatClock(data.payoutFailedAt).slice(0, 5)}</span>
      </span>
    );
  }
  if (data.seeded && data.decision === "paid") {
    return (
      <span className="flex h-full flex-col justify-center leading-tight" title="A sample claim: the rule decided to pay, and no money moved">
        <span className="inline-flex items-center gap-1.5 text-ui text-muted">
          <span className="size-1.5 shrink-0 rounded-full border border-muted" aria-hidden="true" />
          Sample
        </span>
        <span className="font-mono text-micro text-faint">not sent</span>
      </span>
    );
  }
  if (!data.payoutStatus) return <span className="text-faint" aria-label="No payout">—</span>;
  const status = data.payoutStatus;
  const [word, mark] = status === "SUCCESS" ? ["Sent", "bg-pay"] : FAILED.has(status) ? ["Failed", "bg-stop"] : ["Settling", "border border-muted"];
  return (
    <span className="inline-flex h-full items-center gap-2 text-ui text-muted" title={`PayPal: ${status}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${mark}`} aria-hidden="true" />
      {word}
    </span>
  );
}

/** "$29.99" with the cents at 73%, raised (Mercury's table cents). Sample and unpaid amounts are muted. */
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
  return <AmountText amount={data.amount} muted={data.decision !== "paid" || data.seeded} />;
}

/** Phones: one 72px card per claim. Photo, id and pill; then the barcode, the time to pay and the amount. */
export function CardRow({ data }: Cell) {
  if (!data) return null;
  return (
    <span className="flex h-full items-center gap-3 px-4">
      <Thumbs row={data} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="font-mono text-ui font-medium">{data.id}</span>
            <SampleMark row={data} />
          </span>
          <StatusPill status={data.decision} />
        </span>
        {/* The amount always fits: the time to pay goes first on a narrow card (it is in the evidence too). */}
        <span className="flex min-w-0 items-center gap-3">
          {data.bars ? <Barcode bars={data.bars} /> : <span className="min-w-0 truncate font-mono text-micro text-faint">{formatTime(data.createdAt)}</span>}
          {data.toPay !== null && <span className="font-mono text-micro text-muted tabular-nums max-[359px]:hidden">{duration(data.toPay)}</span>}
          <span className="ml-auto shrink-0">{data.amount ? <AmountText amount={data.amount} muted={data.decision !== "paid" || data.seeded} /> : <span className="text-faint">—</span>}</span>
        </span>
      </span>
    </span>
  );
}

// A seeded sample's fingerprint check (why it's dotted), and the photo check that never answered.
function barNote(row: ClaimRow, b: CheckBar): string {
  if (b.id === "duplicate_photo" && b.state === "skipped" && row.seeded) return "not run: shared sample photo";
  if (b.id === "model" && b.state === "hold") return "no answer, held";
  return BAR_WORD[b.state];
}

/** A column header's legend (headerTooltip): the column's tooltip component draws the header's too. */
function HeaderTip({ text }: { text: unknown }) {
  return <p className="w-[280px] rounded-card bg-surface px-3.5 py-3 text-ui text-muted shadow-float">{String(text ?? "")}</p>;
}

/** Hovering the barcode: the five checks, each with its bars named and their states. */
export function ChecksTooltip({ data, location, value }: CustomTooltipProps<ClaimRow>) {
  if (location === "header") return <HeaderTip text={value} />;
  if (!data?.bars) return null;
  const groups = byCheck(data.bars);
  return (
    <div className="w-[296px] rounded-card bg-surface px-3.5 py-3 shadow-float">
      <p className="mb-2.5 text-ui text-text">{barsSentence(data.bars)}</p>
      {groups.map((g) => (
        <div key={g.title} className="mt-2.5 first:mt-0">
          <p className="micro text-faint">{g.title}</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {g.bars.map((b) => (
              // The check's full name always; a long state wraps to its own line under it.
              <li key={b.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-ui">
                <Bar bar={b} />
                <span className="flex-1 whitespace-nowrap text-text-2">{b.label}</span>
                <span className="ml-auto text-micro text-muted">{barNote(data, b)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Hovering the timeline: each step after the photos arrived, in words. */
export function TimelineTooltip({ data, location, value }: CustomTooltipProps<ClaimRow>) {
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
  const tail = data.seeded && data.decision === "paid" ? "A sample claim: the rule decided to pay, and no money was sent." : t.end === "held" ? "Waiting for a person to approve or reject." : null;
  return (
    <div className="w-[240px] rounded-card bg-surface px-3.5 py-3 shadow-float">
      <p className="micro text-faint">After the photos arrived</p>
      <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-ui">
        {steps.map(([label, v]) => (
          <div key={label} className="contents">
            <dt className={v === null ? "text-faint" : "text-text-2"}>{label}</dt>
            <dd className="text-right font-mono text-micro leading-5 text-muted tabular-nums">{v === null ? "—" : duration(v)}</dd>
          </div>
        ))}
      </dl>
      {tail && <p className="mt-2 text-micro text-muted">{tail}</p>}
      {/* What the time beside the track measures. */}
      {(data.toPay !== null || data.modelSec !== null) && (
        <p className="mt-2 border-t border-line pt-2 text-micro text-muted">
          {data.toPay !== null ? (
            <>
              The boxed <span className="font-mono">{duration(data.toPay)}</span> is photos to PayPal payout.
            </>
          ) : (
            <>
              The grey <span className="font-mono">{duration(data.modelSec!)}</span> is the model&apos;s answer time: there is no payout to time.
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** Hovering a claim: its first photo at 240px, with the exhibit label. */
export function PhotoTooltip({ data }: CustomTooltipProps<ClaimRow>) {
  const photo = data?.photos[0];
  if (!data || !photo) return null;
  const sample = data.seeded || data.demo;
  return (
    <div className="w-[256px] overflow-hidden rounded-card bg-surface p-2 pb-2.5 shadow-float">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.large} alt={`Photo 1 of ${data.photoCount} for ${data.id}`} width={240} height={180} className="block h-[180px] w-[240px] rounded-control bg-surface-2 object-cover" />
      <p className="micro mt-2 px-0.5 text-accent-text">Photo 1 of {data.photoCount}</p>
      <p className="mt-0.5 px-0.5 font-mono text-micro text-faint">
        {data.code ? `Code ${data.code}` : ""}
        {data.code && sample ? " · " : ""}
        {sample ? "AI-made test photo" : ""}
      </p>
    </div>
  );
}
