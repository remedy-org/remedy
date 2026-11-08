import clsx from "clsx";
import type { ReactNode } from "react";
import { Paper, Stamp } from "@/components/ui";
import styles from "./home.module.css";
import { Enter } from "./Reveal";
import { Section } from "./Section";

// Facts from IDEA.md §2.2 (each marked VERIFIED there): the PIRG report, the CPSC recalls API pull for 1 Oct-5 Nov
// 2026, the Kikea notice itself, and the CPSC's request for information. Each is a numbered footnote at the foot of
// the band, the way a report cites.
const SOURCES = [
  { n: 1, label: "PIRG, Too Much to Recall, January 2024", href: "https://publicinterestnetwork.org/wp-content/uploads/2024/01/TOO-MUCH-TO-RECALL-FINAL-1-11-1.pdf" },
  {
    n: 2,
    label: "CPSC recalls API, 1 October to 5 November 2026, our count",
    href: "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2026-10-01&RecallDateEnd=2026-11-05",
  },
  {
    n: 3,
    label: "Kikea Store, CPSC recall 27-071",
    href: "https://www.cpsc.gov/Recalls/2027/Kikea-Store-Recalls-X-VESOLJE-Nursing-Pillows-Due-to-Risk-of-Serious-Injury-or-Death-from-Suffocation-Violate-Mandatory-Standards-for-Nursing-Pillows",
  },
  { n: 4, label: "CPSC request for information CPSC-2026-0067, 15 April 2026", href: "https://public-inspection.federalregister.gov/2026-07328.pdf" },
];

const STATS: { figure: string; text: string; note: number }[] = [
  { figure: "6–10%", text: "of recalled products are ever returned or destroyed. The rest stay in homes.", note: 1 },
  { figure: "20 of 27", text: "refund recalls that asked for a photo from 1 October to 5 November 2026 had owners email it to an inbox.", note: 2 },
];

const link = "underline decoration-paper-line underline-offset-4 transition-colors duration-160 hover:decoration-ink focus-visible:outline-ink";

function Note({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 font-mono text-micro">
      {/* A 24px hit area around the 12px figure, without moving the line. */}
      <a href={`#source-${n}`} aria-label={`Source ${n}`} className={clsx(link, "relative px-0.5 no-underline before:absolute before:-inset-x-1.5 before:-inset-y-1 before:content-['']")}>
        {n}
      </a>
    </sup>
  );
}

/** A document lying on the paper band: a mono metadata row, the excerpt, and its source. */
function Document({ meta, note, children, className, stamp }: { meta: string; note: number; children: ReactNode; className?: string; stamp?: ReactNode }) {
  return (
    <Paper as="figure" variant="notice" padding="none" className={clsx("m-0", className)}>
      <div className="flex items-center justify-between gap-4 border-b border-paper-line px-6 py-3 sm:px-8">
        <span className="micro text-ink-muted">{meta}</span>
        <Note n={note} />
      </div>
      <blockquote className="relative px-6 pt-6 pb-8 sm:px-8 sm:pt-8 sm:pb-10">
        <p className="text-body text-pretty sm:text-lead">{children}</p>
        {stamp}
      </blockquote>
    </Paper>
  );
}

export function Problem() {
  return (
    <Section
      id="problem"
      exhibit="The problem"
      tone="paper"
      title="Recall refunds run on an inbox."
      muted="AI broke the inbox."
      lead="To get a refund, owners destroy the product and email a photo. Someone at the company checks each one by hand, and an image model can now draw that photo."
    >
      {/* The stats on the heading's two grid lines (columns 1 and 8), so nothing floats between them. */}
      <dl className="grid-12 gap-y-10">
        {STATS.map((s, i) => (
          <div key={s.figure} className={clsx("col-span-12 border-t border-paper-line pt-6", i === 0 ? "md:col-span-6 lg:col-span-7" : "md:col-span-6 lg:col-span-5")}>
            <dt className="text-title-lg font-medium whitespace-nowrap">{s.figure}</dt>
            <dd className="mt-3 max-w-[40ch] text-body text-pretty text-ink-muted">
              {s.text}
              <Note n={s.note} />
            </dd>
          </div>
        ))}
      </dl>

      <Enter className="mt-14 grid-12 gap-y-8 lg:items-start" threshold={0.3}>
        <div className="col-span-12 flex flex-col gap-8 lg:col-span-7">
          <Document meta="CPSC 27-071 · Kikea Store · 19,596 units" note={3} className="lg:-rotate-[0.6deg]">
            &ldquo;&hellip;cut the pillow in half after confirming the recalled pillow with the firm and send a photo of the destroyed pillow to{" "}
            <span className={clsx(styles.highlight, "font-mono whitespace-nowrap")}>z•••••929@gmail.com</span>.&rdquo;
          </Document>
          <blockquote className="order-last max-w-[44ch] border-l-2 border-ink pl-6 text-head-sm font-medium text-balance lg:order-none">
            The same request warns that fraud controls can &ldquo;reduce recall participation&rdquo;.{" "}
            <span className="text-ink-muted">Remedy keeps the refund easy for a real owner and expensive for a fake.</span>
          </blockquote>
        </div>
        <Document
          meta="CPSC-2026-0067 · Request for information"
          note={4}
          className="col-span-12 lg:col-span-5 lg:mt-8 lg:rotate-[0.8deg]"
          stamp={
            <span className="pointer-events-none absolute right-6 -bottom-4 sm:right-8">
              <Stamp tone="stop" rotate={-6} className={clsx(styles.stamp, "bg-paper")}>
                Received
              </Stamp>
            </span>
          }
        >
          &ldquo;&hellip;altered, fabricated, or artificially generated images&hellip; purporting to demonstrate product destruction.&rdquo;
        </Document>
      </Enter>

      <ol aria-label="Sources" className="mt-14 grid-12 gap-y-1 border-t border-paper-line pt-6">
        {SOURCES.map((s) => (
          <li key={s.n} id={`source-${s.n}`} className="col-span-12 flex gap-3 font-mono text-micro text-ink-muted md:col-span-6 lg:col-span-3">
            <span className="w-4 shrink-0">{s.n}</span>
            <a href={s.href} target="_blank" rel="noopener noreferrer" className={clsx(link, "inline-flex min-h-6 items-center")}>
              {/* One flex item, so a wrapped label keeps the arrow at its end. */}
              <span>
                {s.label}
                <span aria-hidden="true">&nbsp;↗</span>
              </span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ol>
    </Section>
  );
}
