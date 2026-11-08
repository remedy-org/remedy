import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import styles from "./home.module.css";
import { Reveal } from "./Reveal";

export interface SectionProps {
  id: string;
  /** The exhibit letter and name, e.g. "A · The problem". Without it the heading opens the section on its own. */
  exhibit?: string;
  /** Two-tone heading: the claim, then the explanation in muted. */
  title: ReactNode;
  muted?: ReactNode;
  /** The section's intro, set beside the heading on laptops and under it on phones. */
  lead?: ReactNode;
  /** paper: the page's one light band (paper and ink), used once, for the problem. */
  tone?: "dark" | "paper";
  children: ReactNode;
  className?: string;
  /** Laptop columns for the heading: 7 (with a lead beside it) or 9 (no lead, a longer two-tone line). */
  headingSpan?: 7 | 9;
  /** The space between the heading and the section's content, replacing 48px (64px on laptops). */
  bodyClassName?: string;
  /** How the heading enters: focus-in (blur to sharp, 900ms), or a plain rise (fade and 8px up, 360ms, no blur). */
  reveal?: "focus" | "rise";
}

const line = (n: number) => ({ "--line": n }) as CSSProperties;

/**
 * A homepage section on the one 12-column grid. No rules between sections: each one opens with a fade from
 * --section-lift into the page over 288px (the paper band is its own boundary), then 128px of air on laptops (72px on
 * phones). The heading takes columns 1 to 7 and the lead columns 8 to 12, bottom-aligned, so every section's text
 * starts on the same two grid lines. The heading is 40px, two-tone, and focuses in.
 */
export function Section({ id, exhibit, title, muted, lead, tone = "dark", children, className, headingSpan = 7, bodyClassName = "mt-12 lg:mt-16", reveal = "focus" }: SectionProps) {
  const headingId = `${id}-title`;
  const enter = reveal === "rise" ? styles.rise : styles.line;
  const paper = tone === "paper";
  const [letter, name] = exhibit?.split(" · ") ?? [];
  return (
    <section id={id} aria-labelledby={headingId} className={clsx("scroll-mt-16", paper ? "bg-band text-ink" : styles.fade, className)}>
      <div className="page py-18 lg:py-32">
        <Reveal as="header" className="grid-12 gap-y-5 lg:items-end">
          <div className={clsx("col-span-12", headingSpan === 9 ? "lg:col-span-9" : "lg:col-span-7")}>
            {exhibit && (
              <p className={clsx(enter, "mb-5 micro", paper ? "text-ink-muted" : "text-faint")} style={line(0)}>
                Exhibit <span className={paper ? "text-ink" : "text-text-2"}>{letter}</span>
                {name && <> · {name}</>}
              </p>
            )}
            <h2 id={headingId} className="text-title-lg font-medium text-balance">
              <span className={clsx(enter, "block")} style={line(1)}>
                {title}
              </span>{" "}
              {muted && (
                <span className={clsx(enter, "block", paper ? "text-ink-muted" : "text-muted")} style={line(2)}>
                  {muted}
                </span>
              )}
            </h2>
          </div>
          {lead && (
            <p
              className={clsx(enter, "col-span-12 max-w-[60ch] text-body text-pretty lg:col-span-5 lg:col-start-8 lg:pb-1", paper ? "text-ink-muted" : "text-text-2")}
              style={line(3)}
            >
              {lead}
            </p>
          )}
        </Reveal>
        <div className={bodyClassName}>{children}</div>
      </div>
    </section>
  );
}
