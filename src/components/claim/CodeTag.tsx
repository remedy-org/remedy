import clsx from "clsx";
import type { ReactNode } from "react";
import { Paper, Stamp } from "@/components/ui";

export interface CodeTagProps {
  code: string;
  /** The micro line along the top, e.g. "Your one-time code". */
  label?: string;
  /** The dashed foot, e.g. "Write it big, in marker." */
  foot?: ReactNode;
  /** A string from the punched hole, up and off to the left: the tag hangs from the card. */
  string?: boolean;
  /** The code ran out: the tag fades and takes an EXPIRED stamp. */
  expired?: boolean;
  className?: string;
}

/**
 * The paper evidence tag with the code on it: the object the owner should end up holding, and the same tag the homepage's
 * Chain of Custody writes. Paper and ink keep their colours in both themes, like the real thing.
 */
export function CodeTag({ code, label = "Your one-time code", foot, string, expired, className }: CodeTagProps) {
  return (
    <figure className={clsx("relative mx-auto w-full max-w-[22.5rem]", className)} aria-label={`${expired ? "Expired code" : "Your code"}: ${code.split("").join(" ")}`}>
      {string && (
        <svg aria-hidden="true" className="pointer-events-none absolute right-1/2 bottom-[calc(100%-19px)] h-16 w-[28rem] overflow-visible" viewBox="0 0 448 64" preserveAspectRatio="xMaxYMax meet">
          <path d="M448 64 C 420 30, 360 8, 0 2" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      <Paper variant="tag" hole padding="lg" tilt={-2} className={clsx(expired && "opacity-60")}>
        <p className="micro text-ink-muted">{label}</p>
        <p aria-hidden="true" className="mt-4 text-center font-mono text-[4rem] leading-none font-semibold tracking-[0.14em] text-ink">
          {code}
        </p>
        {foot && <p className="mt-6 border-t border-dashed border-paper-line pt-3 text-ui text-ink-muted">{foot}</p>}
        {expired && (
          <span className="absolute top-12 right-5">
            <Stamp tone="neutral">Expired</Stamp>
          </span>
        )}
      </Paper>
    </figure>
  );
}
