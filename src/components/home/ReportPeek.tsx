"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./home.module.css";

/**
 * The phone story's report: the draft's head and its units remedied, ending on that block's last row with the words
 * fading into the paper, and "Read the whole draft" to open the rest in place (no JS: the <details> alone lifts the
 * cap). The end is measured from the sheet ([data-peek-end]), so the cut never falls mid-row at any width. The draft
 * opens about 2,000px tall, so closing it again from its foot brings the reader back to its head, not to wherever the
 * shorter page leaves them.
 */
export function ReportPeek({ children }: { children: ReactNode }) {
  const clip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = clip.current;
    const end = el?.querySelector<HTMLElement>("[data-peek-end]");
    if (!el || !end) return;
    const place = () => {
      if (el.parentElement?.querySelector("details")?.open) return;
      el.style.setProperty("--peek-h", `${Math.ceil(end.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 28)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className={styles.peek}>
      <div ref={clip} className={styles.peekClip}>
        {children}
      </div>
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
