// The five checks every claim goes through, as the homepage's Fraud checks section names and numbers them. The pipeline
// records finer answers (the model reads the label, the code, each step the notice asks for and whether the photo is
// real); every count a person reads groups them under these five, so the homepage, the receipt and the console say one
// number. Wording and grouping only: the checks and the rule are untouched.

// Each one's short name heads its answers in a list (the evidence, the console's barcode hover).
export const FIVE_CHECKS = [
  { n: 1, short: "Live camera" },
  { n: 2, short: "Never seen before" },
  { n: 3, short: "One claim per account" },
  { n: 4, short: "Code and label" },
  { n: 5, short: "Really destroyed" },
] as const;

export type CheckNumber = (typeof FIVE_CHECKS)[number]["n"];

/** Which of the five a recorded check belongs to; null for a hold that comes from the process (the model down, PayPal). */
export function checkOf(id: string): CheckNumber | null {
  if (id === "session") return 1;
  if (id === "duplicate_photo") return 2;
  if (id === "account" || id === "payer" || id === "payer_verified" || id === "state") return 3;
  if (id === "label" || id === "code") return 4;
  if (/^step_\d+$/.test(id) || id === "same_item" || id === "screen") return 5;
  return null;
}

/** A recorded check's name in a sentence: "failed: the code". */
function nameOf(id: string): string {
  if (id === "session") return "the live camera";
  // Named by what went wrong: it only ever fails, and "failed: photo not seen before" reads as its opposite.
  if (id === "duplicate_photo") return "the photo was used before";
  if (id === "label") return "the label";
  if (id === "code") return "the code";
  if (id === "same_item") return "the same item";
  if (id === "screen") return "a real photo";
  if (/^step_\d+$/.test(id)) return "really destroyed";
  return "one claim per account";
}

type State = "pass" | "hold" | "reject" | "blocked" | "waiting" | "running" | "skipped";
export type Outcome = "pass" | "skipped" | "hold" | "fail" | "open";

/** Each of the five checks' outcome from its recorded answers: the worst of them; open when none was recorded. */
export function fiveOutcomes(items: { id: string; state: State }[]): { n: CheckNumber; outcome: Outcome; names: string[] }[] {
  return FIVE_CHECKS.map(({ n }) => {
    const of = items.filter((i) => checkOf(i.id) === n);
    const named = (states: State[]) => [...new Set(of.filter((i) => states.includes(i.state)).map((i) => nameOf(i.id)))];
    const failed = named(["reject", "blocked"]);
    if (failed.length) return { n, outcome: "fail", names: failed };
    const held = named(["hold"]);
    if (held.length) return { n, outcome: "hold", names: held };
    if (!of.length || of.some((i) => i.state === "waiting" || i.state === "running")) return { n, outcome: "open", names: [] };
    // A check passes only when all of it ran: one claim per account, skipped for a demo sample, isn't a pass.
    if (of.some((i) => i.state === "skipped")) return { n, outcome: "skipped", names: [] };
    return { n, outcome: "pass", names: [] };
  });
}

/**
 * The five checks in one line, in the words the check list uses: "5 of 5 checks passed", "1 of 5 failed: the code · 3
 * passed · 1 not run", "1 of 5 failed: the live camera · 1 passed · 3 not run". `open` names a check with nothing
 * recorded yet, `skipped` one that was skipped; the same word counts once.
 */
export function fiveSummary(items: { id: string; state: State }[], { open = "not run", skipped = "not run" }: { open?: string; skipped?: string } = {}): string {
  const outcomes = fiveOutcomes(items);
  const count = (o: Outcome) => outcomes.filter((x) => x.outcome === o);
  const total = FIVE_CHECKS.length;
  const passed = count("pass").length;
  if (passed === total) return `${total} of ${total} checks passed`;
  if (count("open").length === total) return `${total} checks ${open}`;
  // "the code", "the code and the label", "the code, the label and really destroyed".
  const names = (o: Outcome) => {
    const all = [...new Set(count(o).flatMap((x) => x.names))];
    return all.length > 1 ? `${all.slice(0, -1).join(", ")} and ${all.at(-1)}` : (all[0] ?? "");
  };
  const lead = count("fail").length ? `${count("fail").length} of ${total} failed: ${names("fail")}` : count("hold").length ? `${count("hold").length} of ${total} held: ${names("hold")}` : null;
  const parts = [
    lead,
    passed || !lead ? (lead ? `${passed} passed` : `${passed} of ${total} passed`) : null,
    lead && count("hold").length && count("fail").length ? `${count("hold").length} held: ${names("hold")}` : null,
    ...(skipped === open
      ? [count("skipped").length + count("open").length ? `${count("skipped").length + count("open").length} ${open}` : null]
      : [count("skipped").length ? `${count("skipped").length} ${skipped}` : null, count("open").length ? `${count("open").length} ${open}` : null]),
  ];
  return parts.filter(Boolean).join(" · ");
}
