import clsx from "clsx";
import type { ReactNode } from "react";
import { ExhibitLabel } from "@/components/ui";
import { Reveal } from "./Reveal";

export interface SectionProps {
  id: string;
  /** The exhibit letter and name, e.g. "A · The problem". */
  exhibit: string;
  /** Two-tone title: the claim, then the explanation in muted. */
  title: ReactNode;
  muted?: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A homepage section: hairline on top, 128px of air (72px on phones), an exhibit eyebrow and a two-tone title. */
export function Section({ id, exhibit, title, muted, lead, children, className }: SectionProps) {
  const headingId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className={clsx("scroll-mt-16 border-t border-line", className)}>
      <Reveal className="mx-auto max-w-content px-4 py-18 sm:px-8 lg:py-32">
        <ExhibitLabel leader="left" leaderLength={24}>
          Exhibit {exhibit}
        </ExhibitLabel>
        <h2 id={headingId} className="mt-6 max-w-[30ch] text-h2 font-semibold text-balance sm:text-h1">
          {title} {muted && <span className="text-muted sm:block">{muted}</span>}
        </h2>
        {lead && <p className="mt-6 max-w-read text-body text-muted sm:text-lead">{lead}</p>}
        <div className="mt-12 lg:mt-16">{children}</div>
      </Reveal>
    </section>
  );
}
