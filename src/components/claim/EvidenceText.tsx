import type { Decision } from "@/lib/types";
import type { CheckRow } from "./model";

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

/** A recorded check's name in an owner's sentence: "the code", "whether it's cut in half". */
export function checkName(id: string, cut: boolean): string {
  if (id === "session") return "the live camera";
  if (id === "duplicate_photo") return "a photo used before";
  if (id === "label") return "the label";
  if (id === "code") return "the code";
  if (id === "same_item") return "whether it's the same item";
  if (id === "screen") return "whether it's a real photo";
  if (/^step_\d+$/.test(id)) return cut ? "whether it's cut in half" : "whether it's destroyed";
  return "one claim per account";
}

/** "the label, the code and whether it's cut in half". */
export const listOf = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? ""));

/** The names of the recorded checks in these states, once each, in the order they ran. */
export const namesIn = (rows: CheckRow[], states: CheckRow["state"][], cut: boolean) => [...new Set(rows.filter((r) => states.includes(r.state)).map((r) => checkName(r.id, cut)))];

/**
 * The evidence in one line, beside its photo: "All 5 checks passed", "3 of 5 passed. Kikea Store will check the label
 * and the code.", "1 of 5 failed: the code. 4 passed.", "Failed: the live camera. The checks after it didn't run."
 */
export function evidenceSummary(rows: CheckRow[], { decision, company, cut, passed, failed: n }: { decision: Decision; company: string; cut: boolean; passed: number; failed: number }): string {
  if (decision === "paid") return "All 5 checks passed";
  if (rows.some((r) => r.id === "model")) return "The photo check didn't answer";
  const failed = namesIn(rows, ["reject", "blocked"], cut);
  const held = namesIn(rows, ["hold"], cut);
  if (decision === "held" && held.length) return `${passed} of 5 passed. ${company} will check ${listOf(held)}.`;
  // A refusal that stopped the claim early: the checks after it never ran, so a count would mislead.
  if (failed.length && passed + n < 5) return `Failed: ${listOf(failed)}. The checks after it didn't run.`;
  if (failed.length) return `${n} of 5 failed: ${listOf(failed)}.${passed ? ` ${passed} passed.` : ""}`;
  return `${passed} of 5 passed`;
}
