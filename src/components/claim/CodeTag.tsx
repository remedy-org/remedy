import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./flow.module.css";

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
    <figure className={clsx(styles.codeTag, "relative w-full max-w-[27rem]", className)} aria-label={spoken}>
      <p className="mb-5 text-ui text-muted">Your one-time photo code</p>
      <div className={styles.codePaper}>
        {written && (
          <p aria-hidden="true" className={clsx("text-center font-mono text-[1.4rem] leading-none font-medium tracking-[0.04em] [overflow-wrap:anywhere]", expired && "opacity-50")}>
            {written}
          </p>
        )}
        <p
          aria-hidden="true"
          className={clsx("mt-5 text-center font-mono text-[4rem] leading-none font-medium tracking-[0.14em]", expired && "line-through decoration-2 opacity-50")}
        >
          {code}
        </p>
      </div>
      {foot && <p className="mt-5 text-ui text-muted">{foot}</p>}
    </figure>
  );
}
