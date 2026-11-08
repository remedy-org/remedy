"use client";

import type { ReactNode } from "react";
import styles from "./home.module.css";

/**
 * The phone story's report: the draft's head, fading out, and "Read the whole draft" to open the rest in place (no JS:
 * the <details> alone lifts the cap). The draft opens about 2,000px tall, so closing it again from its foot brings the
 * reader back to its head, not to wherever the shorter page leaves them.
 */
export function ReportPeek({ children }: { children: ReactNode }) {
  return (
    <div className={styles.peek}>
      <div className={styles.peekClip}>{children}</div>
      <details
        className="mt-4"
        onToggle={(e) => {
          const peek = e.currentTarget.parentElement;
          if (e.currentTarget.open || !peek || peek.getBoundingClientRect().top >= 0) return;
          const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollTo({ top: window.scrollY + peek.getBoundingClientRect().top - 88, behavior: smooth ? "smooth" : "auto" });
        }}
      >
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control text-ui font-medium text-text underline decoration-line-2 underline-offset-4 hover:decoration-current">
          <span className={styles.peekMore}>Read the whole draft</span>
          <span className={styles.peekLess}>Show less of the draft</span>
        </summary>
      </details>
    </div>
  );
}
