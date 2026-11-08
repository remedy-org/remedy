import clsx from "clsx";
import type { ReactNode } from "react";
import { Paper } from "@/components/ui";

export interface CodeTagProps {
  code: string;
  /** Written on the tag above the code, as the owner should write it, e.g. a hand-written label "X-VESOLJE". */
  written?: string | null;
  /** The dashed foot, e.g. "Write it big, in marker." */
  foot?: ReactNode;
  /** The code ran out: the tag fades and the code is struck through. The headline says why. */
  expired?: boolean;
  className?: string;
}

/**
 * The paper evidence tag with the code on it: the object the owner should end up holding, and the same tag the homepage's
 * Chain of Custody writes. Upright and flat to the page, so the code reads at any zoom. Paper and ink keep their colours
 * in both themes, like the real thing.
 */
export function CodeTag({ code, written, foot, expired, className }: CodeTagProps) {
  const spoken = `${expired ? "Expired code" : "Your code"}: ${code.split("").join(" ")}`;
  return (
    <figure className={clsx("relative mx-auto w-full max-w-[22.5rem]", className)} aria-label={written ? `The tag reads ${written}, then ${spoken}` : spoken}>
      <Paper variant="tag" hole padding="lg" className={clsx(expired && "opacity-60")}>
        {written && (
          <p aria-hidden="true" className="mt-4 text-center font-mono text-[1.75rem] leading-none font-medium tracking-[0.08em] whitespace-nowrap text-ink">
            {written}
          </p>
        )}
        <p aria-hidden="true" className={clsx("mt-4 text-center font-mono text-[4rem] leading-none font-medium tracking-[0.14em] text-ink", expired && "line-through decoration-2")}>
          {code}
        </p>
        {foot && <p className="mt-6 border-t border-dashed border-paper-line pt-3 text-ui text-ink-muted">{foot}</p>}
      </Paper>
    </figure>
  );
}
