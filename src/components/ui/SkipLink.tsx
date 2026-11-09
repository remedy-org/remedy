import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * A page-level skip link: hidden until the keyboard reaches it, then a quiet chip lying over the wordmark, on the
 * wordmark's own line (the page frame's first grid line, the console's too), with the ink focus ring. Its
 * target takes focus (tabIndex={-1}), so the next Tab goes on from there.
 */
export function SkipLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className={clsx(
        "sr-only rounded-control bg-surface-2 text-ui font-medium whitespace-nowrap text-text shadow-float",
        "focus:not-sr-only focus:fixed focus:top-2.5 focus:z-50 focus:inline-flex focus:h-11 focus:items-center focus:px-4",
        // .page's content edge: the gutter, or the centred frame's edge on a wide screen.
        "focus:left-[max(var(--gutter),calc((100%-var(--container-content))/2))]",
        // In the console, over the wordmark on a phone (the nav is a row of its own there); from 640px, where the nav
        // sits beside the wordmark, just under the 64px header, so the chip never covers "Claims".
        "sm:[body:has([data-console-header])_&]:focus:top-[calc(4rem+6px)]",
      )}
    >
      {children}
    </a>
  );
}
