import clsx from "clsx";
import type { ReactNode } from "react";
import type { CheckState } from "@/components/ui";
import { EvidenceText, ModelQuote } from "./EvidenceText";
import styles from "./flow.module.css";
import type { CheckRow } from "./model";

/**
 * The claim's checks as the owner reads them: the five checks, then the refund, always the same six. The pipeline
 * records finer answers (the label, the code, each step, a real photo); each row takes the worst of its own. The words
 * are the claim flow's own, so src/lib/fiveChecks.ts (the homepage's) stays as it is. The list shows the five; the
 * refund is the outcome column's row (RefundRow), which the receipt prints over.
 */
export type SixKey = "session" | "duplicate" | "account" | "code" | "destroyed" | "refund";

export interface SixRow {
  key: SixKey;
  /** The row's name in a sentence, for the screen reader's line: "photo not used before". */
  name: string;
  label: ReactNode;
  state: CheckState;
  /** Nothing was recorded for it: the claim stopped before it ran. */
  unrun?: boolean;
  /** Why it failed or is held, in the owner's words. */
  detail?: string;
  /** Why it passed, in one plain line. */
  because?: string;
  /** What the photo check read on the tag: "X-VESOLJE · K7P". */
  read?: string;
  /** The photo check's own words, once. */
  quote?: string;
  /** The PayPal payout id of a sent refund. */
  reference?: string;
}

const KEY_OF = (id: string): SixKey | null => {
  if (id === "session") return "session";
  if (id === "duplicate_photo") return "duplicate";
  if (id === "account") return "account";
  if (id === "label" || id === "code") return "code";
  if (/^step_\d+$/.test(id) || id === "same_item" || id === "screen") return "destroyed";
  if (id === "payout") return "refund";
  return null;
};

// Worst first: a row is as bad as its worst answer.
const RANK: CheckState[] = ["running", "waiting", "blocked", "reject", "hold", "skipped", "pass"];

const firstQuoted = (s?: string) => /"([^"]{1,24})"/.exec(s ?? "")?.[1];

/** A quote's first sentence, so a line never ends mid-thought on an ellipsis. */
const firstSentence = (s?: string) => (s ? (/^.+?[.!?](?=\s|$)/.exec(s.trim())?.[0] ?? s.trim()) : undefined);

export interface SixOptions {
  code: string;
  /** The thing destroyed, capitalised: "Pillow". */
  noun: string;
  /** The notice asks for it cut in half. */
  cut: boolean;
  /** The claim is decided: a row with nothing recorded didn't run. */
  decided: boolean;
  held?: boolean;
  /** A demo claim: one account sends all four, so the account check that didn't run for it isn't listed. */
  demo?: boolean;
  /** How many photos were sent: a repost names its photo only when there were several. */
  photos?: number;
  /** A refused repost's earlier claim, when it's this account's own: the row names it. */
  earlier?: string;
  /** The result: its outcome column says why a check failed or is held, so the row doesn't say it again. */
  explained?: boolean;
  /** The label hand-written on the tag beside the code ("X-VESOLJE"), when the notice asks for one. */
  written?: string | null;
  /** What the photo check read, when the verdict is at hand; otherwise it's taken from its quotes. */
  read?: { label?: string | null; code?: string | null };
}

/** The six rows from a claim's recorded checks. */
export function sixRows(rows: CheckRow[], { code, noun, cut, decided, held, demo, photos = 1, earlier, explained, written, read }: SixOptions): SixRow[] {
  const of = (key: SixKey) => rows.filter((r) => KEY_OF(r.id) === key);
  const model = rows.find((r) => r.id === "model");
  const these = photos > 1 ? "these photos" : "this photo";
  const base: { key: SixKey; name: string; label: ReactNode; because?: string }[] = [
    // One name, demo and real: what the check can know is that the photo came through this claim's own camera.
    { key: "session", name: "sent from Remedy's camera", label: "Sent from Remedy's camera", because: demo ? "Sent through this claim, within its 10 minutes." : "Taken in this claim's camera, within 10 minutes." },
    { key: "duplicate", name: "photo not used before", label: "Photo not used before", because: `No earlier claim has ${these}.` },
    { key: "account", name: "one claim per PayPal account", label: "One claim per PayPal account", because: "No other claim from this PayPal account." },
    {
      key: "code",
      name: written ? `tag shows ${written} and ${code}` : `label and code ${code}`,
      label: written ? (
        <>
          Tag shows <span className="whitespace-nowrap">{written}</span> and <span className="font-mono whitespace-nowrap">{code}</span>
        </>
      ) : (
        <>
          Label and code <span className="font-mono whitespace-nowrap">{code}</span>
        </>
      ),
    },
    { key: "destroyed", name: `${noun.toLowerCase()} ${cut ? "cut in half" : "destroyed"}`, label: `${noun} ${cut ? "cut in half" : "destroyed"}`, because: `The photo shows it ${cut ? "cut in half" : "destroyed"}.` },
    { key: "refund", name: "refund to PayPal", label: "Refund to your PayPal" },
  ];
  const six = base.map((b): SixRow => {
    // The photo check never answered: both of its rows wait for a person.
    const own = model && (b.key === "code" || b.key === "destroyed") ? [model] : of(b.key);
    if (!own.length) {
      if (!decided) return { ...b, state: "waiting" };
      return b.key === "refund" && held ? { ...b, state: "hold" } : { ...b, state: "skipped", unrun: true, because: undefined };
    }
    const state = RANK.find((s) => own.some((r) => r.state === s)) ?? "pass";
    const off = own.filter((r) => r.state !== "pass" && r.state !== "skipped");
    const detail = off.length && b.key !== "refund" ? off.map((r) => r.detail).filter(Boolean).join(". ") || undefined : undefined;
    const out: SixRow = { ...b, state, detail, because: state === "pass" ? b.because : undefined };
    if (state === "waiting" || state === "running") return out;
    if (b.key === "session" && out.detail) out.detail = `${these.charAt(0).toUpperCase()}${these.slice(1)} came from outside the claim's camera.`;
    // "Already sent with claim RM-3481": a photo is numbered only when several were sent.
    if (b.key === "duplicate" && out.detail) {
      const where = earlier ? `claim ${earlier}` : "another claim";
      out.detail = photos > 1 ? out.detail.replace(/(was|were) already used in another claim/, `$1 already sent with ${where}`) : `Already sent with ${where}.`;
    }
    if (b.key === "code" && !model) {
      const seen = read?.code ?? firstQuoted(own.find((r) => r.id === "code")?.quote);
      // The label as read often carries the code too ("X-VESOLJE K7Q"): said once.
      const label = (read?.label ?? firstQuoted(own.find((r) => r.id === "label")?.quote))?.replace(seen ?? "\u0000", "").trim();
      if (label || seen) out.read = [label, seen].filter(Boolean).join(" · ");
      // What was read says it: the pipeline's sentence would only repeat it.
      if (out.read && state === "reject") out.detail = undefined;
      // Unsure: one plain line in Remedy's voice, not the pipeline's list. The photo check's words stay in the evidence.
      if (state === "hold") {
        const unsure = own.filter((r) => r.state === "hold").map((r) => (r.id === "code" ? code : "the label"));
        out.detail = `We couldn't read ${unsure.join(" or ")} on the tag.`;
        out.read = undefined;
      }
      if (state === "pass" && !out.read) out.because = "The tag matches this claim.";
    }
    if (b.key === "destroyed" && !model) {
      const steps = own.filter((r) => /^step_\d+$/.test(r.id) && r.state !== "pass" && r.state !== "skipped");
      if (steps.length) out.detail = steps.some((r) => r.state === "hold") ? `We couldn't see ${cut ? "the cut" : "that it's destroyed"} clearly.` : `The photo doesn't show it ${cut ? "cut in half" : "destroyed"}.`;
      else if (state === "pass") out.quote = firstSentence(own.find((r) => r.quote)?.quote);
    }
    if (model && (b.key === "code" || b.key === "destroyed")) out.detail = "The photo check didn't answer.";
    if (b.key === "refund") out.reference = /PayPal reference (\S+)/.exec(own[0]?.detail ?? "")?.[1];
    if (b.key === "refund" && state === "hold") out.detail = own[0]?.detail;
    if (explained && b.key !== "refund" && state !== "pass") {
      out.detail = undefined;
      if (state !== "reject") out.read = undefined;
    }
    return out;
  });
  // A demo claim's account check runs only for the genuine one (one account sends all four): where it didn't, no row.
  return demo ? six.filter((r) => !(r.key === "account" && r.state === "skipped")) : six;
}

/** A row's state as one word, for the screen reader's line and the list's hidden text. */
export function outcomeWord(r: Pick<SixRow, "key" | "state" | "unrun">): string {
  switch (r.state) {
    case "running":
      return r.key === "refund" ? "Sending" : "Checking";
    case "pass":
      return r.key === "refund" ? "Sent" : "Passed";
    case "reject":
    case "blocked":
      return "Failed";
    case "hold":
      return r.key === "refund" ? "Waiting for a person" : "For a person to look at";
    case "skipped":
      return r.key === "refund" ? "Not sent" : r.unrun ? "Not run" : "Skipped";
    default:
      return r.key === "refund" ? "After the checks" : "Waiting";
  }
}

/** A row's 16px mark: a tick for a pass, filled for a failure or a hold, a ring while it waits, a turning arc while it runs. */
function Glyph({ state }: { state: CheckState }) {
  const dot = "flex size-4 shrink-0 items-center justify-center rounded-full";
  const path = (d: string, size = 10) => (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  switch (state) {
    case "pass":
      return <span className={clsx(dot, "text-pay")}>{path("M1.75 5.25l2.25 2.25 4.25-4.75", 14)}</span>;
    case "reject":
    case "blocked":
      return <span className={clsx(dot, "bg-stop text-bg")}>{path("M3 3l4 4M7 3l-4 4")}</span>;
    case "hold":
      return <span className={clsx(dot, "bg-hold text-bg")}>{path("M3.75 3v4M6.25 3v4")}</span>;
    case "running":
      return (
        <span className={clsx(dot, "relative ring-1 ring-line-strong ring-inset")}>
          <span className={clsx("absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-text", styles.turn)} />
        </span>
      );
    case "skipped":
      return <span className={clsx(dot, "border border-dashed border-line-strong")} />;
    default:
      return <span className={clsx(dot, "ring-1 ring-line-strong ring-inset")} />;
  }
}

/** The one line under a check: "Checking" while it runs, then why it passed or what went wrong. */
function Reason({ r }: { r: SixRow }) {
  if (r.state === "running") return <>Checking</>;
  if (r.state === "pass") {
    if (r.read)
      return (
        <>
          Read on the tag: <span className="font-mono whitespace-nowrap text-text-2">{r.read}</span>
        </>
      );
    if (r.quote)
      return (
        <q className="[@media(max-height:600px)]:line-clamp-1">
          <ModelQuote>{r.quote}</ModelQuote>
        </q>
      );
    return <>{r.because}</>;
  }
  if (r.read && !r.detail)
    return (
      <>
        Read on the tag: <span className="font-mono whitespace-nowrap text-text">{r.read}</span>
      </>
    );
  if (r.detail) return <EvidenceText>{r.detail}</EvidenceText>;
  return null;
}

/**
 * The five checks, each a mark, its name and one plain line under it, resolving in place: "Checking", then the reason.
 * A waiting row keeps its line's height, so nothing below it moves when it lands. No outcome column: the mark and the
 * reason say it once (the word is there for a screen reader). `live`: the checking screen, where each answer lands as
 * it resolves (a 160ms settle of the mark, only under no-preference).
 */
export function CheckList({ rows, label = "Checks", live, className }: { rows: SixRow[]; label?: string; live?: boolean; className?: string }) {
  const checks = rows.filter((r) => r.key !== "refund");
  return (
    <ol aria-label={label} className={clsx("flex flex-col border-t border-line", className)}>
      {checks.map((r) => {
        const quiet = r.state === "waiting" || r.unrun;
        const failed = r.state === "reject" || r.state === "blocked";
        const reason = quiet ? null : <Reason r={r} />;
        return (
          <li key={r.key} data-row={r.key} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 border-b border-line py-3 [@media(max-height:600px)]:py-2">
            <span key={r.state} className={clsx("flex h-[1.55em] items-center text-body", live && !quiet && styles.settle)}>
              <Glyph state={r.state} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={clsx("text-body", quiet ? "text-faint" : "text-text")}>
                {r.label}
                <span className="sr-only">: {outcomeWord(r).toLowerCase()}</span>
              </span>
              {/* While the checks run every row keeps the line, so the list never changes height as rows land. */}
              {(live || reason) && (
                <span key={`${r.state}-${r.read ?? ""}`} className={clsx("min-h-[1.45em] text-ui text-pretty", failed && !r.read ? "text-text" : "text-muted", live && reason && styles.swap)}>
                  {reason}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
