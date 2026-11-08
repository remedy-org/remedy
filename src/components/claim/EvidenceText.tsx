import type { Decision } from "@/lib/types";
import type { SixRow } from "./CheckList";

// Codes, claim ids and quoted text from the photos set in mono, so K7O and K7Q never look alike.
const TOKEN = /(\b[A-Z][0-9][A-Z]\b|\bRM-\d{4}\b|"[^"]+")/g;

/** "Couldn't confirm: The pillow is cut": lower case after a colon, as every line in the flow is written. */
export const afterColon = (s: string) => s.replace(/: ([A-Z])(?=[a-z])/g, (_, c: string) => `: ${c.toLowerCase()}`);

export function EvidenceText({ children }: { children: string }) {
  return (
    <>
      {afterColon(children).split(TOKEN).map((part, i) =>
        i % 2 ? (
          <span key={i} className="font-mono">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

// In the model's own words: a short code-like token in straight quotes ("K7O", "0").
const QUOTED_CODE = /"([A-Z0-9]{1,6})"/g;
// Unquoted: a code (K7O, K70) or a lone zero ("could also be 0"). Mono's slashed zero keeps 0 apart from O.
const BARE_CODE = /\b([A-Z][0-9][A-Z0-9]|0)\b/g;

const mono = (part: string, key: string) => (
  <span key={key} className="font-mono">
    {part}
  </span>
);

/**
 * The model's quoted evidence, inside the page's own curly quotes, word for word: a code drops its straight quotes and is
 * set in mono (K7O beside K7Q, a slashed 0), and any other straight quotes become single curly ones, so nothing reads as
 * raw output.
 */
export function ModelQuote({ children }: { children: string }) {
  return (
    <>
      {children.split(QUOTED_CODE).map((part, i) =>
        i % 2
          ? mono(part, String(i))
          : part
              .replace(/"([^"]*)"/g, "‘$1’")
              .replace(/"/g, "’")
              .split(BARE_CODE)
              .map((bit, j) => (j % 2 ? mono(bit, `${i}.${j}`) : bit)),
      )}
    </>
  );
}

// What failed, as a sentence an owner can read aloud.
const FAILED: Record<string, (cut: boolean) => string> = {
  session: () => "Not taken on the live camera",
  duplicate: () => "Photo used before",
  account: () => "This PayPal account has claimed already",
  code: () => "The tag doesn't match",
  destroyed: (cut) => (cut ? "Not cut in half" : "Not destroyed"),
};

/**
 * The evidence in one line, said as what happened rather than as a tally: "All 5 checks passed", "The tag doesn't
 * match.", "Not taken on the live camera. The photo check didn't run.", "Checks 4 and 5 need a person." The refund
 * isn't one of the five, so it never counts.
 */
export function evidenceSummary(six: Pick<SixRow, "key" | "state" | "unrun">[], { decision, cut, unanswered }: { decision: Decision; cut: boolean; unanswered: boolean }): string {
  if (decision === "paid") return "All 5 checks passed";
  if (unanswered) return "The photo check didn't answer";
  const checks = six.filter((r) => r.key !== "refund");
  const failed = checks.filter((r) => r.state === "reject" || r.state === "blocked");
  const review = checks.flatMap((r, i) => (r.state === "hold" ? [i + 1] : []));
  if (failed.length) {
    const what = failed.map((r) => `${FAILED[r.key](cut)}.`).join(" ");
    return checks.some((r) => r.unrun && (r.key === "code" || r.key === "destroyed")) ? `${what} The photo check didn't run.` : what;
  }
  if (review.length) return review.length === 1 ? `Check ${review[0]} needs a person.` : `Checks ${review.slice(0, -1).join(", ")} and ${review[review.length - 1]} need a person.`;
  return `${checks.filter((r) => r.state === "pass").length} of 5 passed`;
}
