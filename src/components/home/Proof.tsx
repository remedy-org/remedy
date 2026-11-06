import clsx from "clsx";
import type { ReactNode } from "react";
import { Section } from "./Section";

// docs/EVAL.md, spike 2: 3 runs per model at high effort. Each pair is round 2 (31 claims), then the 5 held-out claims.
// "Decisions right" counts claims in one run; the paid columns add up all 3 runs (7 genuine claims x 3 = 21, the 2
// held-out genuine claims x 3 = 6).
type Pair = [string, string];
interface Row {
  model: string;
  chosen?: boolean;
  decisions: Pair;
  genuinePaid: Pair;
  fakesPaid: Pair;
  answers: Pair;
  seconds: string;
  cost: string;
}

const ROWS: Row[] = [
  { model: "GPT-6.1 Sol", chosen: true, decisions: ["29–30 of 31", "5 of 5"], genuinePaid: ["21 of 21", "6 of 6"], fakesPaid: ["3, all c14", "0"], answers: ["91%", "96%"], seconds: "16 (max 40)", cost: "$0.011" },
  { model: "GPT-6 Astra", decisions: ["29–30 of 31", "5 of 5"], genuinePaid: ["21 of 21", "6 of 6"], fakesPaid: ["1, c14", "0"], answers: ["90%", "96%"], seconds: "26 (max 67)", cost: "$0.064" },
  { model: "GPT-6.1 Terra", decisions: ["29–30 of 31", "5 of 5"], genuinePaid: ["18 of 21", "6 of 6"], fakesPaid: ["2, c14", "0"], answers: ["93%", "96%"], seconds: "10 (max 19)", cost: "$0.005" },
  { model: "GPT-6 Luna", decisions: ["28–29 of 31", "4–5 of 5"], genuinePaid: ["16 of 21", "6 of 6"], fakesPaid: ["3, c14", "2, h03"], answers: ["93%", "96%"], seconds: "10 (max 27)", cost: "$0.0006" },
];

const COLUMNS: { key: keyof Row; label: string; pair: boolean }[] = [
  { key: "decisions", label: "Decisions right", pair: true },
  { key: "genuinePaid", label: "Genuine claims paid, 3 runs", pair: true },
  { key: "fakesPaid", label: "Fakes paid, 3 runs", pair: true },
  { key: "answers", label: "Answers right", pair: true },
  { key: "seconds", label: "Seconds a claim", pair: false },
  { key: "cost", label: "Cost a claim", pair: false },
];

// A model name never breaks at its hyphen.
const Model = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap">{children}</span>;

const STATS: { figure: string; text: ReactNode }[] = [
  { figure: "7 of 7", text: <>genuine claims paid by <Model>GPT-6.1 Sol</Model> in all 3 runs, and 2 of 2 held out</> },
  { figure: "4 of 4", text: "wrong codes rejected by all four models, in all 3 runs: 12 of 12 attempts" },
  { figure: "0", text: "web photos paid with the code check on, by any model, in any run" },
  { figure: "1.1¢", text: <>and 16 seconds a claim with <Model>GPT-6.1 Sol</Model></> },
];

const WHY = [
  { model: "Sol", text: "paid every genuine claim in every run, held out or not, at about a cent and 16 seconds a claim." },
  { model: "Terra", text: "holds two-photo claims: it can't confirm both photos show the same pillow." },
  { model: "Luna", text: "reads “R8D” as “R&D” every time, and paid a misspelt X-VESOLIE label twice." },
  { model: "Astra", text: "catches the c14 flaw more often, but costs six times as much and is too slow to demo." },
];

const NOTES = [
  "Every photo with a code on it is AI-made: no web photo can carry a per-claim code. The first real one is our demo capture.",
  "Every model paid c14, an AI image with three cut ends on two pieces, at least once. That is why the model is not the defence against fakes.",
  "One person wrote the answer keys and checked every image by eye.",
];

function Cell({ value, pair }: { value: Row[keyof Row]; pair: boolean }) {
  if (!pair) return <span className="tabular-nums">{value as string}</span>;
  const [round, held] = value as Pair;
  return (
    <span className="flex flex-col tabular-nums">
      <span>{round}</span>
      <span className="text-faint">{held}</span>
    </span>
  );
}

export function Proof() {
  return (
    <Section
      id="proof"
      exhibit="D · Proof"
      title="Tested on 36 claims before we built."
      muted="Three runs per model."
      lead="Real owner photos from the web, official example photos, traps, and claims with a hand-written code. Every answer is scored, not just the decision."
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4 lg:gap-x-12">
        {STATS.map((s) => (
          <div key={s.figure} className="border-t border-line pt-6">
            <dt className="text-h2 font-semibold tabular-nums sm:text-h1">{s.figure}</dt>
            <dd className="mt-3 text-ui text-pretty text-muted">{s.text}</dd>
          </div>
        ))}
      </dl>

      {/* The eval table: a real table from md up, one card per model on phones. */}
      <div className="mt-16 rounded-card border border-line bg-surface">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-6 py-4">
          <h3 className="text-ui font-medium">Spike 2, 7 November 2026</h3>
          <p className="text-ui text-muted">
            Each cell: round 2 of 31 claims, then <span className="text-faint">the 5 held-out claims</span>. Paid counts add up all 3 runs.
          </p>
        </div>

        <table className="hidden w-full text-left text-ui md:table">
          <caption className="sr-only">Results by model: round 2 of 31 claims, then 5 held-out claims, 3 runs each at high effort. Paid counts add up all 3 runs.</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-6 py-3 font-medium text-muted">
                Model
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="px-4 py-3 font-medium text-muted last:pr-6">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.model} className={clsx("border-b border-line align-top last:border-b-0", r.chosen && "bg-accent-soft")}>
                <th scope="row" className="px-6 py-4 font-medium">
                  <span className="flex flex-col">
                    <Model>{r.model}</Model>
                    {r.chosen && <span className="micro mt-1 text-accent-text">What we run</span>}
                  </span>
                </th>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-4 py-4 last:pr-6">
                    <Cell value={r[c.key]} pair={c.pair} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="md:hidden">
          {ROWS.map((r) => (
            <li key={r.model} className={clsx("border-b border-line px-6 py-5 last:border-b-0", r.chosen && "bg-accent-soft")}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ui font-medium whitespace-nowrap">{r.model}</span>
                {r.chosen && <span className="micro text-accent-text">What we run</span>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-ui">
                {COLUMNS.map((c) => (
                  <div key={c.key}>
                    <dt className="text-muted">{c.label}</dt>
                    <dd className="mt-0.5">
                      <Cell value={r[c.key]} pair={c.pair} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12 grid gap-12 md:grid-cols-2 lg:mt-16 lg:gap-16">
        <div>
          <h3 className="text-body font-semibold">
            Why <Model>GPT-6.1 Sol</Model>
          </h3>
          <ul className="mt-4 flex flex-col">
            {WHY.map((w) => (
              <li key={w.model} className="border-t border-line py-4 text-ui text-muted">
                <span className="font-medium text-text">{w.model}</span> {w.text}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-body font-semibold">What this can&rsquo;t show</h3>
          <ul className="mt-4 flex flex-col">
            {NOTES.map((n) => (
              <li key={n} className="border-t border-line py-4 text-ui text-muted">
                {n}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
