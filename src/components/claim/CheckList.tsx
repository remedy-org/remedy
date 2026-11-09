import clsx from "clsx";
import type { ReactNode } from "react";
import type { CheckState } from "@/components/ui";
import { CHECK_NAMES, checkOf, type CheckNumber } from "@/lib/fiveChecks";
import { EvidenceText } from "./EvidenceText";
import styles from "./flow.module.css";
import { codeDiff, type CheckRow } from "./model";

/**
 * The claim's checks as the owner reads them: the five checks, then the refund, always the same six, on every claim. The
 * pipeline records finer answers (the label, the code, each step, a real photo); each row takes the worst of its own.
 * The names are src/lib/fiveChecks.ts's, the homepage's and the console's too. The list shows the five; the refund is
 * the outcome column's row (RefundRow), which the receipt prints over. The photo check's own words stay in the company's
 * evidence: here each line is Remedy's, the same on every claim.
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
  /** The words in `detail` that are data, set in mono: the label and the code the photo check couldn't read. */
  marks?: string[];
  /** Why it passed, in one plain line. */
  because?: string;
  /** What the photo check read on the tag: the label and the code, and which of the code's characters are wrong. */
  read?: TagRead;
  /** The PayPal payout id of a sent refund. */
  reference?: string;
}

/** What the photo check read on the tag ("X-VESOLJE", "K7Q"), and the code's characters that differ from the claim's. */
export interface TagRead {
  label?: string;
  code?: string;
  off?: number[];
}

const KEYS: Record<CheckNumber, SixKey> = { 1: "session", 2: "duplicate", 3: "account", 4: "code", 5: "destroyed" };

/** The row a recorded check counts under, grouped as the console groups it (fiveChecks.ts checkOf): with the recall's
 * proof steps, the step about the tag ("The X-VESOLJE tag is on the cut pillow") is the tag's check, never the cut's. */
export const keyOf = (id: string, steps: readonly string[] = []): SixKey | null => {
  if (id === "payout") return "refund";
  const n = checkOf(id, steps);
  return n === null ? null : KEYS[n];
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
  /** A demo claim: one account sends all four, so the account check counts once, on the genuine one (the others say so). */
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
  /** The recall's proof steps: the one about the tag counts under the tag's check, as in the console (keyOf). */
  steps?: readonly string[];
  /** "Kikea Store": a held row whose reason the result's lead says names who looks at it. */
  company?: string;
}

/** The account check on a demo claim after the genuine one: one account sends all four, and it counts once. */
export const DEMO_ACCOUNT = "Counted once, on your genuine claim.";

/** The six rows from a claim's recorded checks. */
export function sixRows(rows: CheckRow[], { code, noun, cut, decided, held, demo, photos = 1, earlier, explained, written, read, steps = [], company }: SixOptions): SixRow[] {
  const of = (key: SixKey) => rows.filter((r) => keyOf(r.id, steps) === key);
  const model = rows.find((r) => r.id === "model");
  const these = photos > 1 ? "these photos" : "this photo";
  const base: { key: SixKey; name: string; label: ReactNode; because?: string }[] = [
    // One name, demo and real: what the check can know is that the photo arrived from this claim's page, inside its
    // session, never that a camera took it.
    { key: "session", name: CHECK_NAMES.session.toLowerCase(), label: CHECK_NAMES.session, because: "Arrived from this page, inside the code’s 10 minutes." },
    { key: "duplicate", name: CHECK_NAMES.duplicate.toLowerCase(), label: CHECK_NAMES.duplicate, because: `No earlier claim has ${these}.` },
    { key: "account", name: CHECK_NAMES.account.toLowerCase().replace("paypal", "PayPal"), label: CHECK_NAMES.account, because: "No other claim from this PayPal account." },
    {
      key: "code",
      name: CHECK_NAMES.code(code, written).replace(/^T|^L/, (c) => c.toLowerCase()),
      // Both tokens are data, so both are mono: the same as the "Read on the tag" line under it.
      label: written ? (
        <>
          Tag shows <span className="font-mono whitespace-nowrap">{written}</span> and <span className="font-mono whitespace-nowrap">{code}</span>
        </>
      ) : (
        <>
          Label and code <span className="font-mono whitespace-nowrap">{code}</span>
        </>
      ),
    },
    {
      key: "destroyed",
      name: CHECK_NAMES.destroyed(noun, cut).toLowerCase(),
      label: CHECK_NAMES.destroyed(noun, cut),
      // One fixed line in Remedy's voice, the same on every claim; the model's description is the company's evidence.
      because: cut ? "Both halves and the cut are in the photo." : `The photo shows the ${noun.toLowerCase()} destroyed.`,
    },
    { key: "refund", name: "refund to PayPal", label: "Refund to your PayPal" },
  ];
  const six = base.map((b): SixRow => {
    // The photo check never answered: both of its rows wait for a person.
    const own = model && (b.key === "code" || b.key === "destroyed") ? [model] : of(b.key);
    if (!own.length) {
      if (!decided) return { ...b, state: "waiting" };
      return b.key === "refund" && held ? { ...b, state: "hold" } : { ...b, state: "skipped", unrun: true, because: undefined, detail: "Not run: an earlier check stopped the claim." };
    }
    const state = RANK.find((s) => own.some((r) => r.state === s)) ?? "pass";
    const off = own.filter((r) => r.state !== "pass" && r.state !== "skipped");
    const detail = off.length && b.key !== "refund" ? off.map((r) => r.detail).filter(Boolean).join(". ") || undefined : undefined;
    const out: SixRow = { ...b, state, detail, because: state === "pass" ? b.because : undefined };
    if (state === "waiting" || state === "running") return out;
    if (b.key === "session" && out.detail) out.detail = `${these.charAt(0).toUpperCase()}${these.slice(1)} came from outside the claim’s camera.`;
    // "Already sent with claim RM-3481": a photo is numbered only when several were sent.
    if (b.key === "duplicate" && out.detail) {
      const where = earlier ? `claim ${earlier}` : "another claim";
      out.detail = photos > 1 ? out.detail.replace(/(was|were) already used in another claim/, `$1 already sent with ${where}`) : `Already sent with ${where}.`;
    }
    if (b.key === "code" && !model) {
      const seen = read?.code ?? firstQuoted(own.find((r) => r.id === "code")?.quote);
      // The label as read often carries the code too ("X-VESOLJE K7Q"): said once.
      const label = (read?.label ?? firstQuoted(own.find((r) => r.id === "label")?.quote))?.replace(seen ?? "\u0000", "").trim();
      if (label || seen) {
        // A wrong code: the characters that differ are marked, as the headline marks them.
        const diff = state === "reject" && seen ? codeDiff(code, seen) : null;
        out.read = diff?.readable
          ? { label: label || undefined, code: diff.cells.map((c) => c.seen).join(""), off: diff.cells.flatMap((c, i) => (c.same ? [] : [i])) }
          : { label: label || undefined, code: seen || undefined };
      }
      // What was read says it: the pipeline's sentence would only repeat it (unless only the tag's own step failed).
      const onTag = (r: CheckRow) => r.id === "code" || r.id === "label";
      if (out.read && state === "reject" && own.some((r) => onTag(r) && r.state === "reject")) out.detail = undefined;
      // Unsure: one plain line in Remedy's voice, not the pipeline's list. The photo check's words stay in the evidence.
      if (state === "hold") {
        // Each unsure word named by its text, as the owner wrote it: "X-VESOLJE or H9D".
        const unsure = own.filter((r) => onTag(r) && r.state === "hold").map((r) => (r.id === "code" ? code : (written ?? "the label")));
        out.detail = unsure.length ? `We couldn’t read ${unsure.join(" or ")} on your ${written ? "paper " : ""}tag.` : "We couldn’t see the tag clearly.";
        out.marks = unsure.filter((w) => w !== "the label");
        out.read = undefined;
      }
      if (state === "pass" && !out.read) out.because = "The tag matches this claim.";
    }
    if (b.key === "destroyed" && !model) {
      const steps = own.filter((r) => /^step_\d+$/.test(r.id) && r.state !== "pass" && r.state !== "skipped");
      if (steps.length) out.detail = steps.some((r) => r.state === "hold") ? `We couldn’t see ${cut ? "the cut" : "that it’s destroyed"} clearly.` : `We couldn’t see the ${noun.toLowerCase()} ${cut ? "cut in half" : "destroyed"}.`;
      // The cut is plainly there and only the photo itself was refused: the row says both, so it never reads as "no cut".
      else if (cut && own.some((r) => r.id === "screen" && r.state === "reject")) out.detail = "Both halves are in the photo, but it looks like a photo of a screen or a print.";
    }
    // The demo's other three claims skip it (one account sends all four): said on the row, which stays in the list.
    if (b.key === "account" && demo && state === "skipped") out.detail = DEMO_ACCOUNT;
    // The pipeline's sentence, as the page writes one: a full stop ("… for this recall (RM-0442)."), the claim id kept.
    if (b.key === "account" && out.detail && !/[.!?]$/.test(out.detail)) out.detail = `${out.detail}.`;
    if (model && (b.key === "code" || b.key === "destroyed")) out.detail = "The photo check didn’t answer.";
    if (b.key === "refund") out.reference = /PayPal reference (\S+)/.exec(own[0]?.detail ?? "")?.[1];
    if (b.key === "refund" && state === "hold") out.detail = own[0]?.detail;
    // A held row's reason is the result's lead, so the row doesn't say it again: it says who looks at it instead. A
    // failed row keeps its line, as a passed one does: the list reads the same from the checking screen to the result.
    if (explained && b.key !== "refund" && state === "hold") {
      out.detail = company ? `A person at ${company} will look at this.` : undefined;
      out.marks = undefined;
      out.read = undefined;
    }
    return out;
  });
  // A check that never ran names the one that stopped the claim, so the order reads as meant: the camera, the photo and
  // the account are checked together, and the photo check runs only on what they let through.
  const stopper = six.find((r) => r.key !== "refund" && (r.state === "reject" || r.state === "blocked"))?.key;
  const notRun = stopper ? stoppedBy(stopper, these) : null;
  // A demo claim's account check that didn't run for it (the claim stopped before it) still says why it never would.
  return six.map((r) =>
    demo && r.key === "account" && r.state === "skipped" && !r.detail ? { ...r, unrun: false, detail: DEMO_ACCOUNT } : r.unrun && r.key !== "refund" && notRun ? { ...r, detail: notRun } : r,
  );
}

/** Why a later check never ran, by the check that stopped the claim. */
function stoppedBy(key: SixKey, these: string): string {
  switch (key) {
    case "session":
      return `Not run: ${these} wasn’t sent in this claim’s camera session.`.replace("these photos wasn’t", "these photos weren’t");
    case "duplicate":
      return `Not run: ${these} ${these === "this photo" ? "was" : "were"} claimed before.`;
    case "account":
      return "Not run: this PayPal account has claimed already.";
    case "code":
      return "Not run: the tag doesn’t match this claim.";
    default:
      return "Not run: an earlier check stopped the claim.";
  }
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

/**
 * A row's 16px mark, one family of bare strokes at one weight: a tick for a pass, a cross for a failure, a pause for a
 * hold, a ring while it waits, a turning arc while it runs, a dash when it didn't run (the console strip's dash).
 */
function Glyph({ state }: { state: CheckState }) {
  const dot = "flex size-4 shrink-0 items-center justify-center rounded-full";
  const path = (d: string) => (
    <svg width={14} height={14} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  switch (state) {
    case "pass":
      return <span className={clsx(dot, "text-pay")}>{path("M1.75 5.25l2.25 2.25 4.25-4.75")}</span>;
    case "reject":
    case "blocked":
      return <span className={clsx(dot, "text-stop")}>{path("M2.5 2.5l5 5M7.5 2.5l-5 5")}</span>;
    case "hold":
      return <span className={clsx(dot, "text-hold")}>{path("M3.75 2.25v5.5M6.25 2.25v5.5")}</span>;
    case "running":
      return (
        <span className={clsx(dot, "relative ring-1 ring-line-strong ring-inset")}>
          {/* The brass arc: the checking screen's one amber, so the turning reads as work going on. */}
          <span className={clsx("absolute inset-0 rounded-full border-[2px] border-transparent border-t-accent", styles.turn)} />
        </span>
      );
    case "skipped":
      return <span className={clsx(dot, "text-muted")}>{path("M2.75 5h4.5")}</span>;
    default:
      return <span className={clsx(dot, "ring-1 ring-line-strong ring-inset")} />;
  }
}

/**
 * "Read on the tag: X-VESOLJE · K7Q": the tag's words in mono, the dot between them in the sans (a mono space is a wide
 * gap), and on a wrong code the characters that differ underlined in red, as the headline marks them.
 */
function ReadOnTag({ read, className }: { read: TagRead; className: string }) {
  return (
    <>
      Read on the tag:{" "}
      <span className={clsx("whitespace-nowrap", className)}>
        {read.label && <span className="font-mono">{read.label}</span>}
        {read.label && read.code && "\u00a0·\u00a0"}
        {read.code && (
          <span className="font-mono">
            {[...read.code].map((ch, i) =>
              read.off?.includes(i) ? (
                <span key={i} className="text-stop underline decoration-stop decoration-2 underline-offset-[5px]">
                  {ch}
                </span>
              ) : (
                ch
              ),
            )}
          </span>
        )}
      </span>
    </>
  );
}

/** The one line under a check: "Checking" while it runs, then why it passed or what went wrong. */
function Reason({ r }: { r: SixRow }) {
  if (r.state === "running") return <>Checking</>;
  if (r.state === "pass") {
    if (r.read) return <ReadOnTag read={r.read} className="text-text-2" />;
    return <>{r.because}</>;
  }
  if (r.read && !r.detail) return <ReadOnTag read={r.read} className="text-text" />;
  if (r.detail) return r.marks?.length ? <MonoWords words={r.marks}>{r.detail}</MonoWords> : <EvidenceText>{r.detail}</EvidenceText>;
  return null;
}

/**
 * A wrong code's lead, the refusal's designed moment: two lines read against each other, what the tag says and what it
 * should say, the characters that differ underlined in both (the tag's in red), and the difference in words under them.
 * The result's lead, and the checking screen's from the moment the code check fails, so nothing moves when the result
 * replaces it. `seen`: what the photo check read as the code (null when nothing was readable).
 */
export function CodeLead({ code, seen }: { code: string; seen?: string | null }) {
  const diff = codeDiff(code, seen);
  if (!diff.readable) {
    return (
      <>
        We couldn&rsquo;t read a code on the tag. Your claim&rsquo;s code is <span className="font-mono whitespace-nowrap">{code}</span>.
      </>
    );
  }
  const marked = (side: "seen" | "yours") =>
    diff.cells.map((c, i) =>
      c.same ? (
        c[side]
      ) : (
        <span key={i} className={clsx("underline decoration-2 underline-offset-[5px]", side === "seen" ? "text-stop decoration-stop" : "decoration-text-2")}>
          {c[side]}
        </span>
      ),
    );
  return (
    <>
      <span className="block">
        The tag in your photo reads <span className="font-mono whitespace-nowrap">{marked("seen")}</span>.
      </span>
      <span className="block">
        Your claim&rsquo;s code is <span className="font-mono whitespace-nowrap">{marked("yours")}</span>.
      </span>
      {/* The difference in words, so O and 0 (or a P and a Q) can't be mistaken: for everyone, not only a screen reader. */}
      <span className="mt-1 block text-ui text-muted">{diff.caption}</span>
    </>
  );
}

/** A line with the given words (a hand-written label, a code) each set in mono and never broken, as the code step sets them. */
export function MonoWords({ children, words }: { children: string; words: readonly (string | null | undefined)[] }) {
  const marks = words.filter((w): w is string => Boolean(w)).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!marks.length) return <>{children}</>;
  return (
    <>
      {children.split(new RegExp(`(${marks.join("|")})`)).map((part, i) =>
        i % 2 ? (
          <span key={i} className="font-mono whitespace-nowrap">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
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
        // Whether the row has a line to show: running, a pass's reason, what was read or went wrong, or why it never ran
        // (so a row that didn't run keeps the height it had while the checks ran).
        const said = r.state === "running" || Boolean(r.read || r.detail) || (r.state === "pass" && Boolean(r.because));
        const reason = r.state === "waiting" || !said ? null : <Reason r={r} />;
        return (
          <li key={r.key} data-row={r.key} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 border-b border-line py-3 [@media(max-height:600px)]:py-2">
            <span key={r.state} className={clsx("flex h-[1.55em] items-center text-body", live && !quiet && styles.settle)}>
              <Glyph state={r.state} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              {/* The failed check is the list's red thing, with its mark: its name in red, never just a 10px cross. */}
              <span className={clsx("text-body", quiet ? "text-faint" : r.state === "skipped" ? "text-muted" : failed ? "text-stop" : "text-text")}>
                {/* One run of text for a screen reader, "Sent in the camera session: passed", never the name and its state
                    as two pieces with a space between them. */}
                <span aria-hidden="true">{r.label}</span>
                <span className="sr-only">{`${r.name.charAt(0).toUpperCase()}${r.name.slice(1)}: ${outcomeWord(r).toLowerCase()}`}</span>
              </span>
              {/* While the checks run every row keeps the line, so the list never changes height as rows land. */}
              {(live || reason) && (
                // "Checking" only repeats the state the name's hidden word gives a screen reader: hidden from it.
                <span
                  key={`${r.state}-${r.read?.code ?? ""}`}
                  aria-hidden={r.state === "running" || undefined}
                  className={clsx("min-h-[1.45em] text-ui text-pretty", failed && !r.read ? "text-text" : r.unrun ? "text-faint" : "text-muted", live && reason && styles.swap)}
                >
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
