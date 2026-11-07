import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { ExhibitLabel } from "@/components/ui";
import styles from "./home.module.css";
import { Reveal } from "./Reveal";

export interface SectionProps {
  id: string;
  /** The exhibit letter and name, e.g. "A · The problem". */
  exhibit: string;
  /** Two-tone heading: the claim, then the explanation in muted. */
  title: ReactNode;
  muted?: ReactNode;
  /**
   * statement: a title-lg heading (64px), for at most two sections on the page. small: a 20px two-tone head with the
   * lead set beside it on laptops (Raycast's small heads, so the big ones mean something).
   */
  head?: "statement" | "small";
  lead?: ReactNode;
  /** paper: the page's one light band (paper and ink), used once, for the problem. */
  tone?: "dark" | "paper";
  children: ReactNode;
  className?: string;
}

const line = (n: number) => ({ "--line": n }) as CSSProperties;

/**
 * A homepage section: a hairline on top that runs to the rails, 72px of air on laptops (64px on phones), an exhibit eyebrow
 * and a heading that focuses in. Leads stop at 60ch.
 */
export function Section({ id, exhibit, title, muted, head = "small", lead, tone = "dark", children, className }: SectionProps) {
  const headingId = `${id}-title`;
  const paper = tone === "paper";
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={clsx("scroll-mt-16", paper ? "bg-paper text-ink" : "border-t border-line", className)}
    >
      <div className="mx-auto max-w-content px-4 py-16 sm:px-8 lg:py-18">
        <Reveal
          as="header"
          className={clsx(head === "small" && lead && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-x-16")}
        >
          <div>
            <ExhibitLabel leader="left" leaderLength={24} className={clsx(paper && "text-ink-muted [&>span:first-child]:bg-ink-muted/50")}>
              Exhibit {exhibit}
            </ExhibitLabel>
            {head === "statement" ? (
              <h2 id={headingId} className="mt-6 text-title-lg font-semibold text-balance">
                <span className={clsx(styles.line, "block")} style={line(0)}>
                  {title}
                </span>{" "}
                {muted && (
                  <span className={clsx(styles.line, "block", paper ? "text-ink-muted" : "text-muted")} style={line(1)}>
                    {muted}
                  </span>
                )}
              </h2>
            ) : (
              <h2 id={headingId} className="mt-6 max-w-[34ch] text-head-sm font-medium text-balance">
                <span className={clsx(styles.line, "inline-block")} style={line(0)}>
                  {title}
                </span>{" "}
                {muted && (
                  <span className={clsx(styles.line, "inline-block", paper ? "text-ink-muted" : "text-muted")} style={line(1)}>
                    {muted}
                  </span>
                )}
              </h2>
            )}
          </div>
          {lead && (
            <p
              className={clsx(
                styles.line,
                "max-w-[60ch] text-pretty",
                head === "statement" ? "mt-6 text-body sm:text-lead" : "mt-4 text-body lg:mt-0",
                paper ? "text-ink-muted" : "text-muted",
              )}
              style={line(2)}
            >
              {lead}
            </p>
          )}
        </Reveal>
        <div className="mt-10 lg:mt-12">{children}</div>
      </div>
    </section>
  );
}
