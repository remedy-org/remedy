import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import styles from "./home.module.css";
import { Reveal } from "./Reveal";

export interface SectionProps {
  id: string;
  /** The section's name, e.g. "Problem": the eyebrow, in the nav's words, so a nav link lands on its own name. */
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
  /** Laptop columns for the heading: 7 (with a lead beside it), 9 (no lead, a longer two-tone line) or 12 (each tone
   * on one line). */
  headingSpan?: 7 | 9 | 12;
  /** The space between the heading and the section's content, replacing 48px (64px on laptops). */
  bodyClassName?: string;
  /** The section's padding, replacing 72px (128px on laptops) above and below. */
  padClassName?: string;
  /** How the heading enters: focus-in (blur to sharp, 900ms), or a plain rise (fade and 8px up, 360ms, no blur). */
  reveal?: "focus" | "rise";
}

const line = (n: number) => ({ "--line": n }) as CSSProperties;

/**
 * A homepage section on the one 12-column grid. No rules between sections: each one opens with a fade from
 * --section-lift into the page over 288px (the paper band is its own boundary: a large sheet lying on the room, inset
 * from the screen's edges with rounded corners, never a full-bleed jump from graphite to cream), then 128px of air on
 * laptops (72px on phones). The heading takes columns 1 to 7 and the lead columns 8 to 12, bottom-aligned, so every section's text
 * starts on the same two grid lines. The heading is 40px, two-tone, and focuses in: the promise in --text, the support in
 * --muted, each half its own block on the same column start and capped at the same 34ch, so both lines start and wrap alike.
 */
export function Section({
  id,
  exhibit,
  title,
  muted,
  lead,
  tone = "dark",
  children,
  className,
  headingSpan = 7,
  bodyClassName = "mt-12 lg:mt-16",
  padClassName = "py-18 lg:py-32",
  reveal = "focus",
}: SectionProps) {
  const headingId = `${id}-title`;
  const enter = reveal === "rise" ? styles.rise : styles.line;
  const paper = tone === "paper";
  // Beside a lead, both halves cap at 34ch so they start and wrap alike; a wider heading keeps its span.
  const cap = headingSpan === 7 && "max-w-[34ch]";
  return (
    <section id={id} aria-labelledby={headingId} className={clsx(paper ? styles.band : styles.fade, className)}>
      <div className={clsx("page", padClassName)}>
        <Reveal as="header" className="grid-12 gap-y-5 lg:items-end">
          <div className={clsx("col-span-12", headingSpan === 12 ? "" : headingSpan === 9 ? "lg:col-span-9" : "lg:col-span-7")}>
            <p className={clsx(enter, "eyebrow", paper ? "text-ink-muted" : "text-muted")} style={line(0)}>
              {exhibit}
            </p>
            {/* tabIndex -1: the nav's links focus the heading after the jump, so the next Tab goes on from here; a keyboard
                user sees the ring on it (focus-visible), a mouse user does not. */}
            <h2 id={headingId} tabIndex={-1} className="mt-5 text-title-lg font-medium text-balance">
              <span className={clsx(enter, "block", cap)} style={line(1)}>
                {title}
              </span>{" "}
              {muted && (
                <span className={clsx(enter, "block", cap, paper ? "text-ink-muted" : "text-muted")} style={line(2)}>
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
