import clsx from "clsx";
import type { ReactNode } from "react";

export interface ExhibitLabelProps {
  children: ReactNode;
  /** Which side the hairline leader runs from, towards what the label annotates. */
  leader?: "left" | "right" | "none";
  /** Leader length in px (default 32). */
  leaderLength?: number;
  /** Render as a different element, e.g. "p" or "figcaption". */
  as?: "span" | "p" | "div" | "figcaption" | "dt";
  className?: string;
}

/** Mono micro annotation in --faint (amber is only for what is happening now), e.g. "Exhibit A · Code K7M", with a hairline leader. */
export function ExhibitLabel({ children, leader = "left", leaderLength = 32, as: Tag = "span", className }: ExhibitLabelProps) {
  const line = <span className="h-px shrink-0 bg-line-2" style={{ width: leaderLength }} aria-hidden="true" />;
  return (
    <Tag className={clsx("micro inline-flex items-center gap-2 text-faint", className)}>
      {leader === "left" && line}
      <span>{children}</span>
      {leader === "right" && line}
    </Tag>
  );
}
