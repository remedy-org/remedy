import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import styles from "./home.module.css";
import { Reveal } from "./Reveal";

export interface SectionProps {
  id: string;
  /** The eyebrow, e.g. "Problem". */
  exhibit: string;
  /** Two-tone heading: the claim, then the explanation in muted. */
  title: ReactNode;
  muted?: ReactNode;
  /** The section's intro, set beside the heading on laptops and under it on phones. */
  lead?: ReactNode;
  /** paper: the page's one light band (paper and ink), used once, for the problem. */
  tone?: "dark" | "paper";
  children: ReactNode;
  className?: string;
}

const line = (n: number) => ({ "--line": n }) as CSSProperties;

/**
 * A homepage section on the one 12-column grid. No rules between sections: each one opens with a fade from
 * --section-lift into the page over 288px (the paper band is its own boundary), then 128px of air on laptops (72px on
 * phones). The heading takes columns 1 to 7 and the lead columns 8 to 12, bottom-aligned, so every section's text
 * starts on the same two grid lines. The heading is 40px, two-tone, and focuses in: the promise in --text, the support in
 * --muted, each half its own block on the same column start and capped at the same 34ch, so both lines start and wrap alike.
 */
export function Section({ id, exhibit, title, muted, lead, tone = "dark", children, className }: SectionProps) {
  const headingId = `${id}-title`;
  const paper = tone === "paper";
  return (
    <section id={id} aria-labelledby={headingId} className={clsx("scroll-mt-16", paper ? "bg-band text-ink" : styles.fade, className)}>
      <div className="page py-18 lg:py-32">
        <Reveal as="header" className="grid-12 gap-y-5 lg:items-end">
          <div className="col-span-12 lg:col-span-7">
            <p className={clsx(styles.line, "micro", paper ? "text-ink-muted" : "text-muted")} style={line(0)}>
              {exhibit}
            </p>
            <h2 id={headingId} className="mt-5 text-title-lg font-medium text-balance">
              <span className={clsx(styles.line, "block max-w-[34ch]")} style={line(1)}>
                {title}
              </span>{" "}
              {muted && (
                <span className={clsx(styles.line, "block max-w-[34ch]", paper ? "text-ink-muted" : "text-muted")} style={line(2)}>
                  {muted}
                </span>
              )}
            </h2>
          </div>
          {lead && (
            <p
              className={clsx(styles.line, "col-span-12 max-w-[60ch] text-body text-pretty lg:col-span-5 lg:col-start-8 lg:pb-1", paper ? "text-ink-muted" : "text-text-2")}
              style={line(3)}
            >
              {lead}
            </p>
          )}
        </Reveal>
        <div className="mt-12 lg:mt-16">{children}</div>
      </div>
    </section>
  );
}
