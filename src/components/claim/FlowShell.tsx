import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle, Wordmark } from "@/components/ui";
import { JUDGES_DOCK_ID } from "./JudgesSheet";

export interface FlowShellProps {
  children: ReactNode;
  /** The demo (/try): the Guide pill docks in the header. No label: the Demo account panel and the guide say the rest. */
  demo?: boolean;
  /** The company running the recall, for the footer. */
  company?: string;
  /** No claim on the page (not found, an error): the footer keeps only the copyright row. */
  bare?: boolean;
}

/**
 * The claim flow's frame, on the homepage's own page frame (.page: the same gutter, so the wordmark never moves between
 * them): a quiet header, the steps on graphite with the film grain, a plain footer. Each step sets its own width (480px for a card, 640px for the camera and the samples, 960px for the checks).
 */
export function FlowShell({ children, demo, company, bare }: FlowShellProps) {
  return (
    // A phone's pinned action bar (MobileCta) never covers the end of the page: room for it under the footer.
    <div className="grain flex min-h-dvh flex-col max-sm:has-[[data-mobile-cta]]:pb-24">
      <header className="border-b border-line">
        <div className="page flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Below 360px the demo's header holds the mark, the Guide pill and the theme toggle: the name gives way. */}
            <Wordmark href="/" nameClassName={demo ? "max-[359px]:sr-only" : undefined} />
            {/* The Guide pill docks here below 1200px (JudgesSheet). */}
            {demo && <div id={JUDGES_DOCK_ID} className="flex min-[1200px]:hidden" />}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="page flex-1 outline-none pt-8 pb-16 sm:pt-12 max-sm:[body:has([data-camera])_&]:pb-6">{children}</main>

      {/* A phone's camera step fills the screen; the footer would only sit under it. */}
      <footer className="border-t border-line max-sm:[body:has([data-camera])_&]:hidden">
        {!bare && (
          <div className="page flex flex-col gap-1 pt-6 text-ui text-faint sm:flex-row sm:justify-between">
            <p>{company ? `Refunds for ${company}'s recall are sent through PayPal Payouts.` : "Refunds are sent through PayPal Payouts."}</p>
            <p>Your photos are used only to check this claim. Besides Remedy&rsquo;s checks, only the company running the recall sees them.</p>
          </div>
        )}
        <div className="page flex flex-wrap items-center gap-x-2 pt-6 pb-6 text-ui text-faint">
          <span>&copy; 2026 Remedy</span>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="inline-flex min-h-6 items-center underline decoration-line-2 underline-offset-4 transition-colors duration-160 hover:text-text hover:decoration-text">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="inline-flex min-h-6 items-center underline decoration-line-2 underline-offset-4 transition-colors duration-160 hover:text-text hover:decoration-text">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
