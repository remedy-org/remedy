import clsx from "clsx";
import type { CSSProperties } from "react";
import styles from "./home.module.css";
import { Reveal } from "./Reveal";
import { Section } from "./Section";

// Figures: docs/EVAL.md (7 Nov 2026), GPT-6.1 Sol, the model Remedy runs. Full table and method in public/llms-full.txt.
// short: the same fact in fewer words, for a phone's three narrow columns.
const FIGURES: { figure: string; text: string; short: string }[] = [
  { figure: "100%", text: "of wrong codes and wrong products rejected", short: "wrong codes rejected" },
  { figure: "16 s", text: "to check a claim", short: "to check a claim" },
  { figure: "1.1¢", text: "Remedy's cost to check a claim", short: "cost per claim" },
];

/** The footnote mark: a 24px hit area around the small figure, jumping to the method line at the section's foot. */
function Note() {
  return (
    <sup className="ml-0.5 font-mono text-micro">
      <a
        href="#proof-note"
        aria-label="Note 1"
        className="relative px-0.5 text-faint no-underline transition-colors duration-160 before:absolute before:-inset-x-1.5 before:-inset-y-1 before:content-[''] hover:text-text-2"
      >
        1
      </a>
    </sup>
  );
}

export function Proof() {
  return (
    <Section
      id="proof"
      exhibit="Results"
      title="Every genuine claim paid."
      muted="Every stolen photo stopped."
      lead="Remedy was tested against real owner photos, official recall photos, wrong codes and deliberate fakes. Photos get in only through the claim's live camera, and a fixed rule, never the model, moves the money."
    >
      {/* The one number that matters, at the section's title size and the only full-contrast figure, on the heading's
          grid line; the three supporting figures sit on the lead's (column 8), smaller and muted. */}
      <div className="grid-12 gap-y-8 border-t border-line pt-8 lg:items-end">
        <Reveal className="col-span-12 flex items-baseline gap-x-5 lg:col-span-7">
          <p aria-hidden="true" className={clsx(styles.line, "text-display leading-none font-medium")}>
            0
          </p>
          <p className={clsx(styles.line, "max-w-[24ch] text-head-sm font-medium text-balance")} style={{ "--line": 1 } as CSSProperties}>
            <span className="sr-only">0 </span>stolen web photos paid out.
            <Note />
          </p>
        </Reveal>

        <dl className="col-span-12 grid grid-cols-3 gap-x-4 sm:gap-x-[var(--col-gap)] lg:col-span-5">
          {FIGURES.map((f, i) => (
            <div key={f.figure} className="flex flex-col">
              <dt className="text-body font-medium whitespace-nowrap text-text-2 sm:text-head-sm">{f.figure}</dt>
              <dd className="mt-1.5 max-w-[28ch] text-[0.75rem]/[1.4] text-pretty text-faint sm:mt-2 sm:text-ui sm:text-muted">
                <span className="sm:hidden">{f.short}</span>
                <span className="hidden sm:inline">{f.text}</span>
                {i === FIGURES.length - 1 && <Note />}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <p id="proof-note" className="mt-12 max-w-[68ch] scroll-mt-24 text-[0.75rem]/[1.5] text-pretty text-faint sm:mt-16">
        ¹ Remedy fraud benchmark, 7 Nov 2026: real owner photos, official recall photos, wrong codes, photos of screens and
        deliberate fakes.
      </p>
    </Section>
  );
}
