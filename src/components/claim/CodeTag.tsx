import clsx from "clsx";
import type { ReactNode } from "react";
import { Paper } from "@/components/ui";

export interface CodeTagProps {
  code: string;
  /** Written on the tag above the code, as the owner should write it, e.g. a hand-written label "X-VESOLJE". */
  written?: string | null;
  /** The dashed foot, e.g. "Write it big, in marker." */
  foot?: ReactNode;
  /** The code ran out: the ink fades and the code is struck through. The headline says why. */
  expired?: boolean;
  className?: string;
}

/**
 * The paper evidence tag with the code on it: the object the owner should end up holding, and the same tag the homepage's
 * Chain of Custody writes. Upright and flat to the page, so the code reads at any zoom. Paper and ink keep their colours
 * in both themes, like the real thing.
 */
export function CodeTag({ code, written, foot, expired, className }: CodeTagProps) {
  // "Tag: X-VESOLJE, your code M 4 T": the code a letter at a time, as it is written.
  const spoken = `Tag: ${written ? `${written}, ` : ""}${expired ? "expired code" : "your code"} ${code.split("").join(" ")}`;
  return (
    <figure className={clsx("relative w-full max-w-[22.5rem]", className)} aria-label={spoken}>
      {/* An expired tag stays paper: only its ink fades and the code is struck through, as a used tag would be. */}
      <Paper variant="tag" hole padding="lg">
        {written && (
          <p aria-hidden="true" className={clsx("mt-4 text-center font-mono text-[1.75rem] leading-none font-medium tracking-[0.08em] whitespace-nowrap", expired ? "text-ink-muted" : "text-ink")}>
            {written}
          </p>
        )}
        <p
          aria-hidden="true"
          className={clsx("mt-4 text-center font-mono text-[4rem] leading-none font-medium tracking-[0.14em]", expired ? "text-ink-muted line-through decoration-ink decoration-2" : "text-ink")}
        >
          {code}
        </p>
        {foot && <p className="mt-6 border-t border-dashed border-paper-line pt-3 text-ui text-ink-muted">{foot}</p>}
      </Paper>
    </figure>
  );
}
