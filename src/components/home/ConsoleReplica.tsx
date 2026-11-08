import clsx from "clsx";
import Image from "next/image";
import type { ReactNode } from "react";
import { Money, StatusPill, type Status } from "@/components/ui";

/*
 * A still of Remedy's claims console in plain DOM (no AG Grid, so the homepage and /signin ship no grid JS), styled
 * like the queue: thumbnails, decision pills, an evidence barcode per claim, and the evidence panel. On the homepage it
 * is the loading and no-JS stand-in for the real <ClaimsGridPreview> (CompaniesPreview.tsx), so its chrome matches
 * the grid's; /signin shows it as the page's backdrop.
 *
 * Every row is a real seeded claim: buildSeedClaims (src/lib/demo/seed.ts, seed 27071) gives the ids, codes, payer
 * ids, decisions and reasons below, and the open claim's quotes are the stored model answer
 * it uses (src/lib/demo/verdicts.json, GPT-6.1 Terra on c03). Seeded claims are eval samples and were never paid, so
 * every money figure here says "sample", no payout is shown as sent, and there are no photo-to-PayPal timings (the one
 * real timing, RM-0442's 15 s, belongs to the Chain of Custody).
 */

/** A check's outcome as one bar of the evidence barcode. */
export type Bar = "pass" | "hold" | "reject" | "waiting" | "skipped";

export interface PreviewRow {
  id: string;
  code: string;
  status: Status;
  /** The rule's reason, only when it says more than the pill. */
  reason?: string;
  photos: string[];
  /** Pre-checks (session, new photos, one claim per account), then the model's checks. */
  checks: [Bar[], Bar[]];
  payer: string;
}

const P: Bar = "pass";
const pre: Bar[] = [P, P, P];
// label, code, same item (two photos only), not a screen, step 1, step 2
const one = (screen: Bar = P): Bar[] => [P, P, screen, P, P];
const two = (same: Bar = P): Bar[] => [P, P, same, P, P, P];
const waiting = (n: number): Bar[] => Array<Bar>(n).fill("waiting");

// Decided claims first, the outcomes mixed (paid, the open held claim, rejected, then paid), and the one still waiting
// for photos at the foot, as the live preview orders them (components/console/preview.ts).
export const PREVIEW_ROWS: PreviewRow[] = [
  { id: "RM-0553", code: "R8D", status: "paid", photos: ["/demo/c03-1.jpg", "/demo/c03-2.jpg"], checks: [pre, two()], payer: "WW2P" },
  {
    id: "RM-9629",
    code: "R8D",
    status: "held",
    reason: "Couldn't tell if both photos show the same item",
    photos: ["/demo/c03-1.jpg", "/demo/c03-2.jpg"],
    checks: [pre, two("hold")],
    payer: "DSFD",
  },
  { id: "RM-9545", code: "K7Q", status: "rejected", reason: "Looks like a photo of a screen or a print", photos: ["/demo/c10-1.jpg"], checks: [pre, one("reject")], payer: "UGER" },
  { id: "RM-7581", code: "K7Q", status: "paid", photos: ["/demo/c01-1.jpg"], checks: [pre, one()], payer: "AY3L" },
  { id: "RM-6276", code: "K7Q", status: "paid", photos: ["/demo/c05-1.jpg"], checks: [pre, one()], payer: "KUNF" },
  { id: "RM-2125", code: "R8D", status: "paid", photos: ["/demo/c03-1.jpg", "/demo/c03-2.jpg"], checks: [pre, two()], payer: "Q559" },
  { id: "RM-8501", code: "K7Q", status: "paid", photos: ["/demo/c01-1.jpg"], checks: [pre, one()], payer: "QEB5" },
  { id: "RM-8466", code: "K7Q", status: "paid", photos: ["/demo/c05-1.jpg"], checks: [pre, one()], payer: "AUYQ" },
  { id: "RM-8121", code: "R8D", status: "paid", photos: ["/demo/c03-1.jpg", "/demo/c03-2.jpg"], checks: [pre, two()], payer: "FKBF" },
  { id: "RM-3789", code: "M3J", status: "pending", reason: "Waiting for photos", photos: [], checks: [waiting(3), waiting(5)], payer: "C4XB" },
];

// The open claim's evidence: the stored GPT-6.1 Terra answer RM-9629 is seeded with.
const OPEN_EVIDENCE: { check: string; bar: Bar; quote: string }[] = [
  { check: "Same item in both photos", bar: "hold", quote: "The photos are consistent with the same item, but that cannot be confirmed from the close-up alone." },
  { check: "Code R8D", bar: "pass", quote: "The handwritten code matches the expected code “R8D” character by character." },
  { check: "Cut fully in half", bar: "pass", quote: "The second photo shows two separated green pillow sections with cut edges and exposed stuffing." },
];

// The demo recall's totals (seed.ts MIX): 26 paid of 40, 3 held, 6 rejected, 3 blocked, 2 in progress.
const TABS: [string, number][] = [
  ["All", 40],
  ["Paid", 26],
  ["Held", 3],
  ["Rejected", 6],
  ["Blocked", 3],
  ["In progress", 2],
];

function BarMark({ b }: { b: Bar }) {
  return (
    <span
      className={clsx(
        "relative h-4 w-2 shrink-0 overflow-hidden rounded-[1.5px]",
        b === "pass" && "bg-pay/70",
        b === "hold" && "border border-hold bg-[linear-gradient(var(--hold)_50%,transparent_50%)]",
        b === "reject" && "bg-stop after:absolute after:top-1/2 after:-left-1 after:h-px after:w-4 after:-rotate-60 after:bg-bg",
        b === "waiting" && "border border-line-strong",
        b === "skipped" && "border border-dotted border-line-strong",
      )}
    />
  );
}

const BAR_WORD: Record<Bar, string> = { pass: "passed", hold: "unclear", reject: "failed", waiting: "not run", skipped: "not run" };

/** The barcode in words, for screen readers: "8 checks: 7 passed, 1 failed". */
export function barcodeWords([pre, model]: PreviewRow["checks"]) {
  const all = [...pre, ...model];
  const tally = new Map<string, number>();
  for (const b of all) tally.set(BAR_WORD[b], (tally.get(BAR_WORD[b]) ?? 0) + 1);
  return `${all.length} checks: ${[...tally].map(([word, n]) => `${n} ${word}`).join(", ")}`;
}

/** What the barcode's shapes mean, in one line under the claims (phones): shape carries it as well as colour. */
export function BarcodeLegend({ className }: { className?: string }) {
  return (
    <p className={clsx("flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-muted", className)}>
      {(["pass", "hold", "reject", "waiting"] as const).map((b) => (
        <span key={b} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="flex">
            <BarMark b={b} />
          </span>
          {BAR_WORD[b]}
        </span>
      ))}
    </p>
  );
}

function Barcode({ checks }: { checks: PreviewRow["checks"] }) {
  const bar = (b: Bar, i: number) => <BarMark key={i} b={b} />;
  const [preChecks, model] = checks;
  return (
    <span className="flex items-center gap-1.5" role="img" aria-label={barcodeWords(checks)}>
      <span className="flex gap-0.5">{preChecks.map(bar)}</span>
      <span className="flex gap-0.5">{model.map(bar)}</span>
    </span>
  );
}

function Thumbs({ photos, size = "md" }: { photos: string[]; size?: "md" | "sm" }) {
  const box = size === "md" ? "h-6 w-8" : "h-[30px] w-10";
  if (!photos.length) return <span className={clsx(box, "shrink-0 rounded-[4px] border border-dashed border-line-strong")} aria-hidden="true" />;
  return (
    <span className="relative flex shrink-0" aria-hidden="true">
      {photos.map((p, i) => (
        <Image
          key={i}
          src={p}
          alt=""
          width={40}
          height={30}
          className={clsx(box, "rounded-[4px] object-cover ring-1 ring-bg", i > 0 && (size === "md" ? "-ml-4" : "-ml-6"))}
        />
      ))}
    </span>
  );
}

/** A sample claim's payout: decided, never sent. */
function PayoutCell({ row }: { row: PreviewRow }) {
  if (row.status !== "paid") return <span className="text-faint">&mdash;</span>;
  return (
    <span className="flex flex-col leading-tight">
      <span className="inline-flex items-center gap-1.5 text-muted">
        <span className="size-1.5 rounded-full border border-muted" />
        Sample
      </span>
      <span className="font-mono text-micro text-faint">not sent</span>
    </span>
  );
}

const COLS = "grid grid-cols-[10.5rem_minmax(0,1fr)_6.5rem_5.5rem_5rem] items-center gap-x-4";

/** The open claim's evidence panel (laptops). */
function EvidencePanel({ row }: { row: PreviewRow }) {
  return (
    <aside aria-label={`Evidence for ${row.id}`} className="flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-float">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="flex items-center gap-3">
          <span className="font-mono text-ui font-medium">{row.id}</span>
          <StatusPill status={row.status} />
        </span>
        <span className="font-mono text-micro text-faint">•••• {row.payer} · Verified</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 pb-0">
        {row.photos.map((p, i) => (
          <figure key={p} className="relative m-0 overflow-hidden rounded-control border border-line">
            <Image src={p} alt="" width={200} height={150} className="aspect-[4/3] w-full object-cover" />
            <figcaption className="micro absolute inset-x-0 bottom-0 bg-bg/80 px-2 py-1 text-text">
              Photo {i + 1} · AI-made test photo
            </figcaption>
          </figure>
        ))}
      </div>
      <ol className="flex flex-col px-4 pt-3">
        {OPEN_EVIDENCE.map((e) => (
          <li key={e.check} className="border-b border-line py-2.5 last:border-b-0">
            <span className="flex items-center gap-2 text-ui font-medium">
              <span className={clsx("size-2 rounded-full", e.bar === "hold" ? "bg-hold" : "bg-pay")} aria-hidden="true" />
              {e.check}
              <span className={clsx("micro ml-auto", e.bar === "hold" ? "text-hold" : "text-faint")}>{e.bar === "hold" ? "Unclear" : "Yes"}</span>
            </span>
            <q className="mt-1 block text-ui leading-[1.55] text-muted">{e.quote}</q>
          </li>
        ))}
      </ol>
      <div className="mt-auto border-t border-line px-4 py-3">
        <p className="text-ui">
          <span className="font-medium">Held for a person.</span> <span className="text-muted">Any &ldquo;unclear&rdquo; holds; nothing is paid until Kikea Store decides.</span>
        </p>
        <div className="mt-3 flex gap-2" aria-hidden="true">
          <span className="inline-flex h-9 items-center rounded-control bg-accent px-3 text-ui font-medium text-accent-ink">Approve</span>
          <span className="inline-flex h-9 items-center rounded-control bg-surface-2 px-3 text-ui font-medium shadow-[inset_0_0_0_1px_var(--line-2)]">Reject</span>
          <span className="ml-auto self-center font-mono text-micro text-faint">A / R</span>
        </div>
      </div>
    </aside>
  );
}

/** The queue as a table (laptops): claim, verdict, checks, payout and amount, the open claim's row tinted with its edge. */
export function ReplicaTable({ rows, openId, className }: { rows: PreviewRow[]; openId?: string | null; className?: string }) {
  return (
    <div role="table" aria-label="Claims" className={className}>
      <div role="row" className={clsx(COLS, "h-9 border-b border-line bg-surface px-5")}>
        {["Claim", "Verdict", "Checks", "Payout", "Amount"].map((h, i) => (
          <span role="columnheader" key={h} className={clsx("micro text-faint", i === 4 && "text-right")}>
            {h}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div
          role="row"
          key={r.id}
          className={clsx(COLS, "relative min-h-13 border-b border-line px-5 last:border-b-0", r.id === openId && "bg-accent-soft before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent")}
        >
          <span role="cell" className="flex items-center gap-3">
            <Thumbs photos={r.photos} />
            <span className="flex flex-col leading-tight">
              <span className="font-mono text-ui font-medium">{r.id}</span>
              <span className="font-mono text-micro text-faint">Code {r.code}</span>
            </span>
          </span>
          <span role="cell" className="flex min-w-0 flex-col items-start gap-0.5">
            <StatusPill status={r.status} />
            {r.reason && <span className="line-clamp-2 w-full text-micro leading-snug text-muted">{r.reason}</span>}
          </span>
          <span role="cell">
            <Barcode checks={r.checks} />
          </span>
          <span role="cell" className="text-ui">
            <PayoutCell row={r} />
          </span>
          <span role="cell" className={clsx("text-right font-mono text-ui", r.status === "paid" ? "text-text" : "text-faint")}>
            {r.status === "paid" ? <Money value={29.99} size="grid" /> : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The queue as card rows (phones): photo, id and pill, then the barcode and the amount. */
export function ReplicaCards({ rows, className }: { rows: PreviewRow[]; className?: string }) {
  return (
    <ul className={className} aria-label="Claims">
      {rows.map((r) => (
        <li key={r.id} className="flex min-h-18 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
          {/* One width for one photo or two, so every id starts on the same line. */}
          <span className="flex w-14 shrink-0">
            <Thumbs photos={r.photos} size="sm" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex items-center justify-between gap-2">
              <span className="font-mono text-ui font-medium whitespace-nowrap">{r.id}</span>
              <StatusPill status={r.status} />
            </span>
            <span className="flex items-center gap-3 text-micro">
              <Barcode checks={r.checks} />
              <span className="ml-auto font-mono text-ui">{r.status === "paid" ? <Money value={29.99} size="grid" /> : <span className="text-faint">—</span>}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface ConsoleReplicaProps {
  rows?: PreviewRow[];
  /** The claim whose evidence panel is open (laptops only). */
  openId?: string;
  /** The claims phones show, as card rows: one of each outcome, not four paid in a row. */
  phoneIds?: string[];
  /** Wraps the panel, so a section can animate it in. */
  panelWrap?: (panel: ReactNode) => ReactNode;
  className?: string;
}

/** The console still: chrome, ledger, tabs and the queue, with the evidence panel open beside it on laptops. */
export function ConsoleReplica({ rows = PREVIEW_ROWS, openId, phoneIds = ["RM-0553", "RM-9629", "RM-9545", "RM-7581"], panelWrap = (p) => p, className }: ConsoleReplicaProps) {
  const open = rows.find((r) => r.id === openId);
  return (
    <div className={clsx("overflow-hidden rounded-frame bg-bg text-text shadow-float", className)}>
      {/* App chrome. Insights and Report are the console's other pages: faint, since this still can't open them. */}
      <div className="flex h-12 items-center gap-4 border-b border-line px-4 sm:gap-6 sm:px-5">
        <span className="font-semibold">Remedy</span>
        <span className="hidden gap-5 text-ui font-medium sm:flex">
          <span className="relative text-text after:absolute after:inset-x-0 after:-bottom-[15px] after:h-px after:bg-text">Claims</span>
          <span className="text-faint">Insights</span>
          <span className="text-faint">Report</span>
        </span>
        <span className="micro ml-auto text-faint">Preview</span>
        <span className="text-ui whitespace-nowrap text-muted">Kikea Store</span>
      </div>

      {/* Recall and ledger */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 pt-4 sm:px-5">
        <span className="text-ui font-medium">
          Kikea <span className="whitespace-nowrap">X-VESOLJE</span> nursing pillows
        </span>
        <span className="flex items-center gap-3">
          <span className="micro text-faint">CPSC 27-071</span>
          <span className="micro inline-flex h-5 items-center rounded-control border border-line-2 px-1.5 text-muted">Sample data</span>
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-b border-line px-4 pb-4 text-ui sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-8 sm:px-5">
        <div className="col-span-2 flex items-baseline gap-2">
          <dt className="sr-only">Remedied</dt>
          <dd className="font-semibold whitespace-nowrap">26 of 19,596</dd>
          <span className="hidden h-1 w-16 self-center overflow-hidden rounded-full bg-surface-2 sm:block" aria-hidden="true">
            <span className="block h-full w-[2px] bg-pay" />
          </span>
          <span className="text-muted">remedied</span>
        </div>
        <div className="col-span-2 flex items-baseline gap-2">
          <dt className="sr-only">Paid through PayPal</dt>
          {/* The console ledger's words: nothing was sent; the samples' $779.74 was decided, never paid. */}
          <dd className="font-semibold">
            <Money value={0} />
          </dd>
          <span className="text-muted">
            paid <span className="whitespace-nowrap text-faint">· $779.74 sample, never sent</span>
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <dd className="font-semibold">3</dd>
          <dt className="text-muted">held</dt>
        </div>
        <div className="flex items-baseline gap-2">
          <dd className="font-semibold">9</dd>
          <dt className="text-muted">refused</dt>
        </div>
      </dl>

      {/* The evidence panel from 1280px: beside it, a narrower table's five columns ran into each other. */}
      <div className={clsx("relative lg:flex", open && "xl:pr-3")}>
        <div className="min-w-0 flex-1">
          {/* Tabs */}
          <div className="flex gap-5 overflow-hidden border-b border-line px-4 text-ui sm:px-5" aria-hidden="true">
            {TABS.map(([label, n], i) => (
              <span
                key={label}
                className={clsx(
                  "relative h-11 shrink-0 items-center gap-1.5",
                  // Phones show the first three whole, never a tab cut mid-word.
                  i > 2 ? "hidden sm:flex" : "flex",
                  i === 0 ? "text-text after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-text" : "text-muted",
                )}
              >
                {label} <span className="font-mono text-micro text-faint">{n}</span>
              </span>
            ))}
          </div>

          {/* The queue, laptops */}
          <ReplicaTable rows={rows} openId={openId} className="hidden lg:block" />

          {/* Card rows, phones and tablets */}
          <ReplicaCards rows={phoneIds.map((id) => rows.find((r) => r.id === id)).filter((r) => r !== undefined)} className="lg:hidden" />
        </div>
        {open && <div className="hidden w-[25rem] shrink-0 py-3 xl:block">{panelWrap(<EvidencePanel row={open} />)}</div>}
      </div>
      {/* The console's sample marker: one line for the whole grid, not a tag per row. */}
      <p className="border-t border-line px-4 py-2 font-mono text-micro text-faint sm:px-5">40 sample claims from the eval set · no money moved · AI-made test photos</p>
    </div>
  );
}
