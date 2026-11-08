import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle, Wordmark } from "@/components/ui";

const FOOT_LINK = "inline-flex min-h-6 items-center underline decoration-line-2 underline-offset-4 transition-colors duration-160 hover:text-text hover:decoration-text";

export interface FlowShellProps {
  children: ReactNode;
}

/**
 * The claim flow's frame: a quiet header, the steps on graphite with the film grain, a one-line footer. The header's and
 * footer's edges are the steps' own (the 960px frame), so the wordmark, the step meter and every step share one left edge.
 */
export function FlowShell({ children }: FlowShellProps) {
  return (
    // A phone's pinned action bar (MobileCta) never covers the end of the page: room for it under the footer.
    <div className="grain flex min-h-dvh flex-col max-sm:pointer-coarse:has-[[data-mobile-cta]]:pb-16">
      {/* A phone's camera step is the whole screen, with its own bar: the site's header and footer step aside. */}
      <header className="border-b border-line max-sm:[body:has([data-camera])_&]:hidden">
        <div className="page">
          <div className="mx-auto flex h-16 max-w-[60rem] items-center justify-between gap-4 [@media(max-height:600px)]:h-12">
            <Wordmark href="/" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="page flex-1 pt-8 pb-16 outline-none sm:pt-12 max-sm:[body:has([data-camera])_&]:pb-0 [@media(max-height:600px)]:pt-4">{children}</main>

      <footer className="border-t border-line max-sm:[body:has([data-camera])_&]:hidden">
        {/* One line on the steps' own edges. No company name: a recall's company never reads as Remedy's customer here. */}
        <div className="page">
          <p className="mx-auto flex max-w-[60rem] flex-wrap items-center gap-x-2 py-6 text-ui text-faint">
            <span>&copy; 2026 Remedy</span>
            <span aria-hidden="true">·</span>
            <Link href="/privacy" className={FOOT_LINK}>
              Privacy
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms" className={FOOT_LINK}>
              Terms
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
