import type { ReactNode } from "react";
import { ThemeToggle, Wordmark } from "@/components/ui";

export interface FlowShellProps {
  children: ReactNode;
  /** The company running the recall, for the footer. */
  company?: string;
}

/**
 * The claim flow's frame: a quiet header, the steps on graphite with the film grain, a one-line footer. The header's and
 * footer's edges are the steps' own (the 960px frame), so the wordmark, the step meter and every step share one left edge.
 */
export function FlowShell({ children, company }: FlowShellProps) {
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
        <div className="page">
          <p className="mx-auto max-w-[60rem] py-6 text-ui text-faint">{company ? `${company} · Remedy` : "Remedy"}</p>
        </div>
      </footer>
    </div>
  );
}
