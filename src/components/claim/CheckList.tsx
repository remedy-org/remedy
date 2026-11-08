import clsx from "clsx";
import type { ReactNode } from "react";
import type { CheckState } from "@/components/ui";
import { EvidenceText, ModelQuote } from "./EvidenceText";
import styles from "./flow.module.css";
import type { CheckRow } from "./model";

/**
 * The claim's checks as the owner reads them: the five checks and the refund, six rows, always the same six. The
 * pipeline records finer answers (the label, the code, each step, a real photo); each row takes the worst of its own.
 * The words are the claim flow's own, so src/lib/fiveChecks.ts (the homepage's) stays as it is.
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
  /** Why it failed or is held, in the pipeline's words. */
  detail?: string;
  /** What the photo check read on the tag: "X-VESOLJE · K7P". */
  read?: string;
  /** The photo check's own words, once. */
  quote?: string;
  /** The PayPal reference of a sent refund. */
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

export interface SixOptions {
  code: string;
  /** The thing destroyed, capitalised: "Pillow". */
  noun: string;
  /** The notice asks for it cut in half. */
  cut: boolean;
  /** The claim is decided: a row with nothing recorded didn't run. */
  decided: boolean;
  held?: boolean;
  /** What the photo check read, when the verdict is at hand; otherwise it's taken from its quotes. */
  read?: { label?: string | null; code?: string | null };
}

/** The six rows from a claim's recorded checks. */
export function sixRows(rows: CheckRow[], { code, noun, cut, decided, held, read }: SixOptions): SixRow[] {
  const of = (key: SixKey) => rows.filter((r) => KEY_OF(r.id) === key);
  const model = rows.find((r) => r.id === "model");
  const base: { key: SixKey; name: string; label: ReactNode }[] = [
    { key: "session", name: "taken on the live camera", label: "Taken on the live camera" },
    { key: "duplicate", name: "photo not used before", label: "Photo not used before" },
    { key: "account", name: "one claim per PayPal account", label: "One claim per PayPal account" },
    {
      key: "code",
      name: `code ${code} and the label on the tag`,
      label: (
        <>
          Code <span className="font-mono whitespace-nowrap">{code}</span> and the label on the tag
        </>
      ),
    },
    { key: "destroyed", name: `${noun.toLowerCase()} ${cut ? "cut in half" : "destroyed"}`, label: `${noun} ${cut ? "cut in half" : "destroyed"}` },
    { key: "refund", name: "refund to PayPal", label: "Refund to PayPal" },
  ];
  return base.map((b) => {
    // The photo check never answered: both of its rows wait for a person.
    const own = model && (b.key === "code" || b.key === "destroyed") ? [model] : of(b.key);
    if (!own.length) {
      if (!decided) return { ...b, state: "waiting" };
      return b.key === "refund" && held ? { ...b, state: "hold" } : { ...b, state: "skipped", unrun: true };
    }
    const state = RANK.find((s) => own.some((r) => r.state === s)) ?? "pass";
    const off = own.filter((r) => r.state !== "pass" && r.state !== "skipped");
    const detail = off.length && b.key !== "refund" ? off.map((r) => r.detail).filter(Boolean).join(". ") || undefined : undefined;
    const out: SixRow = { ...b, state, detail };
    if (state === "waiting" || state === "running") return out;
    if (b.key === "code" && !model) {
      const label = read?.label ?? firstQuoted(own.find((r) => r.id === "label")?.quote);
      const seen = read?.code ?? firstQuoted(own.find((r) => r.id === "code")?.quote);
      if (label || seen) out.read = [label, seen].filter(Boolean).join(" · ");
      // What was read says it: the pipeline's sentence would only repeat it.
      if (out.read && state === "reject") out.detail = undefined;
    }
    if (b.key === "destroyed" && !model) out.quote = own.find((r) => r.quote)?.quote;
    if (b.key === "refund") out.reference = /PayPal reference (\S+)/.exec(own[0]?.detail ?? "")?.[1];
    if (b.key === "refund" && state === "hold") out.detail = own[0]?.detail;
    return out;
  });
}

/** The outcome word on a row's right. */
export function outcomeWord(r: Pick<SixRow, "key" | "state" | "unrun">, amount?: string): string {
  switch (r.state) {
    case "running":
      return "Checking";
    case "pass":
      return r.key === "refund" ? (amount ? `${amount} sent` : "Sent") : "Passed";
    case "reject":
    case "blocked":
      return "Failed";
    case "hold":
      return "For review";
    case "skipped":
      return r.key === "refund" ? "Not sent" : r.unrun ? "Not run" : "Skipped";
    default:
      return "";
  }
}

const TONE: Partial<Record<CheckState, string>> = { pass: "text-pay", reject: "text-stop", blocked: "text-stop", hold: "text-hold" };

/** A row's 16px mark: filled for an answer, a ring while it waits, a turning arc while it runs. */
function Glyph({ state }: { state: CheckState }) {
  const dot = "flex size-4 shrink-0 items-center justify-center rounded-full";
  const path = (d: string) => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  switch (state) {
    case "pass":
      return <span className={clsx(dot, "bg-pay text-bg")}>{path("M2.25 5.25l1.75 1.75 3.75-4")}</span>;
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

/**
 * The six rows: a mark, the check, its outcome on the right; under the code and the cut, one faint line of what the
 * photo check read; under the refund, the PayPal reference. `live`: the checking screen, where each answer lands as it
 * resolves (a 160ms settle of the mark, only under no-preference).
 */
export function CheckList({ rows, label = "Checks", amount, live, className }: { rows: SixRow[]; label?: string; amount?: string; live?: boolean; className?: string }) {
  return (
    <ol aria-label={label} className={clsx("flex flex-col border-t border-line", className)}>
      {rows.map((r) => {
        const waiting = r.state === "waiting";
        const word = outcomeWord(r, amount);
        return (
          <li key={r.key} data-row={r.key} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-x-3 border-b border-line py-3 [@media(max-height:600px)]:py-2">
            <span key={r.state} className={clsx("flex h-[1.55em] items-center text-body", live && !waiting && styles.settle)}>
              <Glyph state={r.state} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={clsx("text-body", waiting || r.unrun ? "text-faint" : "text-text")}>{r.label}</span>
              {r.read && <span className={clsx("truncate font-mono text-micro text-faint", live && styles.rise)}>Read: {r.read}</span>}
              {r.quote && (
                <q className={clsx("line-clamp-2 text-ui text-muted [@media(max-height:600px)]:line-clamp-1", live && styles.rise)}>
                  <ModelQuote>{r.quote}</ModelQuote>
                </q>
              )}
              {r.reference && <span className={clsx("truncate font-mono text-micro text-faint", live && styles.rise)}>PayPal {r.reference}</span>}
              {r.detail && (
                <span className="text-ui text-muted">
                  <EvidenceText>{r.detail}</EvidenceText>
                </span>
              )}
            </span>
            <span key={word} className={clsx("pt-[0.15em] text-right text-ui font-medium whitespace-nowrap", TONE[r.state] ?? "text-muted", live && word && styles.swap)}>
              {word}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
