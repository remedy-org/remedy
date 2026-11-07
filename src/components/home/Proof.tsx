import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import styles from "./home.module.css";
import { Reveal } from "./Reveal";
import { Section } from "./Section";

// docs/EVAL.md, spike 2: 3 runs per model at high effort. Each pair is round 2 (31 claims), then the 5 held-out claims.
// "Decisions right" counts claims in one run; the paid columns add up all 3 runs (7 genuine claims x 3 = 21, the 2
// held-out genuine claims x 3 = 6).
type Pair = [string, string];
interface Row {
  model: string;
  chosen?: boolean;
  /** Shown on phones without opening "Compare all 4 models". */
  short?: boolean;
  decisions: Pair;
  genuinePaid: Pair;
  fakesPaid: Pair;
  answers: Pair;
  seconds: string;
  cost: string;
}

const ROWS: Row[] = [
  { model: "GPT-6.1 Sol", chosen: true, short: true, decisions: ["29–30 of 31", "5 of 5"], genuinePaid: ["21 of 21", "6 of 6"], fakesPaid: ["3, all c14", "0"], answers: ["91%", "96%"], seconds: "16 (max 40)", cost: "$0.011" },
  { model: "GPT-6 Astra", short: true, decisions: ["29–30 of 31", "5 of 5"], genuinePaid: ["21 of 21", "6 of 6"], fakesPaid: ["1, c14", "0"], answers: ["90%", "96%"], seconds: "26 (max 67)", cost: "$0.064" },
  { model: "GPT-6.1 Terra", decisions: ["29–30 of 31", "5 of 5"], genuinePaid: ["18 of 21", "6 of 6"], fakesPaid: ["2, c14", "0"], answers: ["93%", "96%"], seconds: "10 (max 19)", cost: "$0.005" },
  { model: "GPT-6 Luna", decisions: ["28–29 of 31", "4–5 of 5"], genuinePaid: ["16 of 21", "6 of 6"], fakesPaid: ["3, c14", "2, h03"], answers: ["93%", "96%"], seconds: "10 (max 27)", cost: "$0.0006" },
];

const COLUMNS: { key: keyof Row; label: string; pair: boolean }[] = [
  { key: "decisions", label: "Decisions right", pair: true },
  { key: "genuinePaid", label: "Genuine paid, 3 runs", pair: true },
  { key: "fakesPaid", label: "Fakes paid, 3 runs", pair: true },
  { key: "answers", label: "Answers right", pair: true },
  { key: "seconds", label: "Seconds a claim", pair: false },
  { key: "cost", label: "Cost a claim", pair: false },
];

// A model name never breaks at its hyphen.
const Model = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap">{children}</span>;

const FIGURES: { figure: string; text: ReactNode }[] = [
  { figure: "21 of 21", text: <>genuine claims paid by <Model>GPT-6.1 Sol</Model> across 3 runs, and 6 of 6 held out</> },
  { figure: "12 of 12", text: "wrong codes rejected by each of the four models: 4 codes, in all 3 runs" },
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
  if (!pair) return <span>{value as string}</span>;
  const [round, held] = value as Pair;
  return (
    <span className="flex flex-col">
      <span>{round}</span>
      <span className="text-faint">{held}</span>
    </span>
  );
}

/** Phones: the table turned on its side, one column per model, so two models compare at a glance. */
function SideTable({ rows, caption }: { rows: Row[]; caption: string }) {
  return (
    <table className="w-full border-t border-line text-left text-ui">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line">
          <td />
          {rows.map((r) => (
            <th key={r.model} scope="col" className={clsx("py-3 pl-3 text-right align-bottom", r.chosen ? "font-medium text-text" : "font-normal text-muted")}>
              <Model>{r.model}</Model>
              {r.chosen && <span className="micro mt-0.5 block text-accent-text">What we run</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {COLUMNS.map((c) => (
          <tr key={c.key} className="border-b border-line align-top last:border-b-0">
            <th scope="row" className="py-2.5 pr-3 font-normal text-muted">
              {c.label}
            </th>
            {rows.map((r) => (
              <td key={r.model} className={clsx("py-2.5 pl-3 text-right font-mono whitespace-nowrap tabular-nums", r.chosen ? "text-text" : "text-muted")}>
                <Cell value={r[c.key]} pair={c.pair} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Proof() {
  return (
    <Section
      id="proof"
      exhibit="C · Proof"
      title="Tested on 36 claims before we built."
      muted="Three runs per model."
      lead={
        <>
          36 claims &times; 4 models &times; 3 runs, scored against answer keys one person wrote. <span className="hidden sm:inline">Real owner photos from the web, official example
          photos, traps, and claims with a hand-written code.</span>
        </>
      }
    >
      {/* The one number that matters, at monument size. */}
      <Reveal className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-5 border-t border-line pt-8 sm:gap-x-10 sm:pt-10">
        <p aria-hidden="true" className={clsx(styles.line, "font-serif text-numeral leading-[0.8] font-normal italic tabular-nums")}>
          0
        </p>
        <p className={clsx(styles.line, "max-w-[26ch] pb-1 text-head-sm font-medium text-balance sm:pb-2")} style={{ "--line": 1 } as CSSProperties}>
          <span className="sr-only">0 </span>web photos paid with the code check on, by any model, in any run.
        </p>
      </Reveal>

      <dl className="mt-8 grid sm:mt-10 sm:grid-cols-3 sm:gap-x-10 lg:mt-12">
        {FIGURES.map((f) => (
          <div key={f.figure} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 border-t border-line py-4 sm:block sm:py-0 sm:pt-6">
            <dt className="text-head-sm font-semibold whitespace-nowrap tabular-nums sm:text-title-lg">{f.figure}</dt>
            <dd className="max-w-[32ch] text-ui text-pretty text-muted sm:mt-3">{f.text}</dd>
          </div>
        ))}
      </dl>

      {/* The eval table: a real table from md up, one card per model on phones. */}
      <div className="mt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h3 className="text-ui font-medium">Spike 2, 7 November 2026</h3>
          <p className="text-ui text-muted">
            Each cell: round 2 of 31 claims, then <span className="text-faint">the 5 held-out claims</span>. Paid counts add up all 3 runs.
          </p>
        </div>

        <table className="mt-4 hidden w-full border-t border-line text-left text-ui md:table">
          <caption className="sr-only">Results by model: round 2 of 31 claims, then 5 held-out claims, 3 runs each at high effort. Paid counts add up all 3 runs.</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="micro py-3 pr-4 pl-4 font-normal text-faint">
                Model
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="micro px-4 py-3 text-right font-normal text-faint last:pr-0">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.model} className="border-b border-line align-top">
                <th scope="row" className={clsx("py-4 pr-4 text-left", r.chosen ? "border-l-2 border-l-accent pl-[calc(1rem-2px)] font-medium text-text" : "pl-4 font-normal text-muted")}>
                  <span className="flex flex-col">
                    <Model>{r.model}</Model>
                    {r.chosen && <span className="micro mt-1 text-accent-text">What we run</span>}
                  </span>
                </th>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={clsx("px-4 py-4 text-right font-mono tabular-nums last:pr-0", r.chosen ? "text-text" : "text-muted")}>
                    <Cell value={r[c.key]} pair={c.pair} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 md:hidden">
          <div className="border-b border-line">
            <SideTable rows={ROWS.filter((r) => r.short)} caption="GPT-6.1 Sol, which we run, against GPT-6 Astra: round 2 of 31 claims, then 5 held-out claims." />
          </div>
          <details className="group border-b border-line">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-ui font-medium [&::-webkit-details-marker]:hidden">
              Compare all 4 models
              <span aria-hidden="true" className="font-mono text-faint transition-transform duration-160 group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="border-t border-line">
              <SideTable rows={ROWS.filter((r) => !r.short)} caption="GPT-6.1 Terra and GPT-6 Luna: round 2 of 31 claims, then 5 held-out claims." />
            </div>
            <div className="border-t border-line py-5">
              <h4 className="text-ui font-medium">
                Why <Model>GPT-6.1 Sol</Model>
              </h4>
              <ul className="mt-2 flex flex-col gap-2">
                {WHY.map((w) => (
                  <li key={w.model} className="text-ui text-muted">
                    <span className="font-medium text-text">{w.model}</span> {w.text}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </div>

      <div className="mt-12 grid gap-12 md:grid-cols-2 lg:gap-16">
        <div className="hidden md:block">
          <h3 className="text-ui font-medium">
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
          <h3 className="text-ui font-medium">What this can&rsquo;t show</h3>
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
