import clsx from "clsx";
import type { ReactNode } from "react";
import { Paper } from "@/components/ui";

export interface CodeTagProps {
  code: string;
  /** Written on the tag above the code, as the owner should write it, e.g. a hand-written label "X-VESOLJE". */
  written?: string | null;
  /** The line along the top, e.g. "Write this on your tag". */
  label?: string;
  /** The dashed foot, e.g. "Write it big, in marker." */
  foot?: ReactNode;
  /** A string from the punched hole, up and off to the left: the tag hangs from the card. */
  string?: boolean;
  /** The code ran out: the tag fades. The headline says why. */
  expired?: boolean;
  className?: string;
}

/**
 * The paper evidence tag with the code on it: the object the owner should end up holding, and the same tag the homepage's
 * Chain of Custody writes. Paper and ink keep their colours in both themes, like the real thing.
 */
export function CodeTag({ code, written, label = "Your one-time code", foot, string, expired, className }: CodeTagProps) {
  const spoken = `${expired ? "Expired code" : "Your code"}: ${code.split("").join(" ")}`;
  return (
    <figure className={clsx("relative mx-auto w-full max-w-[22.5rem]", className)} aria-label={written ? `The tag reads ${written}, then ${spoken}` : spoken}>
      {string && (
        <svg aria-hidden="true" className="pointer-events-none absolute right-1/2 bottom-[calc(100%-19px)] h-16 w-[28rem] overflow-visible [@media(max-height:600px)]:hidden" viewBox="0 0 448 64" preserveAspectRatio="xMaxYMax meet">
          <path d="M448 64 C 420 30, 360 8, 0 2" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      <Paper variant="tag" hole padding="lg" tilt={-2} className={clsx(expired && "opacity-60")}>
        <p className="text-ui text-ink-muted">{label}</p>
        {written && (
          <p aria-hidden="true" className="mt-4 text-center font-mono text-[1.75rem] leading-none font-medium tracking-[0.08em] whitespace-nowrap text-ink">
            {written}
          </p>
        )}
        <p aria-hidden="true" className="mt-4 text-center font-mono text-[4rem] leading-none font-medium tracking-[0.14em] text-ink">
          {code}
        </p>
        {foot && <p className="mt-6 border-t border-dashed border-paper-line pt-3 text-ui text-ink-muted">{foot}</p>}
      </Paper>
    </figure>
  );
}
