import Link from "next/link";
import { ArrowRightIcon, Button, Paper, Wordmark } from "@/components/ui";
import styles from "./home.module.css";
import { Enter } from "./Reveal";

// In page order, in the nav's words, then the two pages, named as the nav names them.
const PRODUCT = [
  { href: "#how", label: "How it works" },
  { href: "#problem", label: "The problem" },
  { href: "#checks", label: "Stopping fakes" },
  { href: "#proof", label: "Test results" },
  { href: "#companies", label: "For companies" },
  { href: "/r/kikea-x-vesolje/try", label: "Try a sample claim" },
  { href: "/signin", label: "Company sign in" },
];

const SOURCES = [
  { href: "https://publicinterestnetwork.org/wp-content/uploads/2024/01/TOO-MUCH-TO-RECALL-FINAL-1-11-1.pdf", label: "PIRG, Too Much to Recall" },
  { href: "https://public-inspection.federalregister.gov/2026-07328.pdf", label: "CPSC request for information, 2026" },
  {
    href: "https://www.cpsc.gov/Recalls/2027/Kikea-Store-Recalls-X-VESOLJE-Nursing-Pillows-Due-to-Risk-of-Serious-Injury-or-Death-from-Suffocation-Violate-Mandatory-Standards-for-Nursing-Pillows",
    label: "CPSC recall 27-071",
  },
];

const linkClass = "inline-flex min-h-11 items-center text-ui text-muted transition-colors duration-160 hover:text-text";

/**
 * The closing call to action, as the brand's object: a large paper tag hanging on its string. As in the hero, the
 * owner's path is the amber action and companies get their sign-in, a quieter link, under it.
 */
function CtaTag() {
  return (
    <Enter className="relative pt-14" threshold={0.3}>
      <Paper variant="tag" hole padding="none" className="sm:-rotate-1">
        <div className="flex flex-col gap-8 px-6 pt-14 pb-8 sm:px-12 sm:pt-14 sm:pb-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div>
            <p className="micro text-ink-muted">Your turn</p>
            <h2 className="mt-4 text-title-lg font-medium text-balance">Run a claim yourself.</h2>
            <p className="mt-3 max-w-[40ch] text-body text-pretty text-ink-muted">
              Four sample claims with AI-made test photos go through the same five checks. Refunds are sandbox money.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3">
            {/* Below sm the label wraps inside the card (at 320px it is wider than the tag), its ring kept in view. */}
            <Button
              href="/r/kikea-x-vesolje/try"
              size="lg"
              data-try-cta=""
              className="shadow-[0_0_0_1px_var(--paper-line)] focus-visible:outline-ink max-sm:h-auto max-sm:min-h-12 max-sm:w-full max-sm:py-3 max-sm:text-center max-sm:whitespace-normal"
            >
              Try a claim with sample photos
            </Button>
            <Link
              href="/signin"
              className="group inline-flex min-h-11 items-center gap-2 rounded-control text-ui text-ink underline-offset-4 decoration-paper-line hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Company sign in
              <ArrowRightIcon className="shrink-0 transition-transform duration-160 ease-snap group-hover:translate-x-[3px]" />
            </Link>
          </div>
        </div>
      </Paper>
      {/* The string hangs from the footer's top rule and runs down over the paper into the tag's hole (19px below the
          tag's top edge, so the padding above plus 19px). Drawn in on enter. */}
      <svg
        aria-hidden="true"
        className="absolute top-0 left-1/2 z-10 h-[75px] w-24 -translate-x-1/2 overflow-visible"
        viewBox="0 0 96 136"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          className={styles.draw}
          pathLength={1}
          d="M30 0C34 40 70 58 62 96c-4 18-14 30-14 40"
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </Enter>
  );
}

export function Footer() {
  return (
    <footer className={styles.fade}>
      {/* The tag hangs on the grid: columns 2 to 11 on laptops. */}
      <div className="page grid-12">
        <div className="col-span-12 lg:col-span-10 lg:col-start-2">
          <CtaTag />
        </div>
      </div>
      {/* One row under the tag: the brand and its line, then the sitemap in the nav's order; the sources and the
          colophon on a hairline under them; then the disclaimer. */}
      <div className="page mt-24">
        <div className="grid-12 gap-y-6 md:items-start">
          <div className="col-span-12 md:col-span-6 lg:col-span-7">
            <Wordmark size="md" />
            <p className="mt-3 max-w-[44ch] text-ui text-muted">
              Recall refunds paid within a minute of a live photo. A fake has to beat a live camera, a photo fingerprint and a verified PayPal account before the model even looks.
            </p>
          </div>
          {/* #footer-nav: where the nav's Menu link goes without JS. */}
          <nav id="footer-nav" aria-label="Footer" className="col-span-12 md:col-span-6 lg:col-span-5 lg:col-start-8">
            <h2 className="sr-only">Remedy</h2>
            <ul className="flex flex-wrap gap-x-6 md:-mt-2.5">
              {PRODUCT.map((l) => (
                <li key={l.href}>
                  {l.href.startsWith("#") ? (
                    <a href={l.href} className={linkClass}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-x-6 md:flex-row md:flex-wrap md:items-center">
          <h2 className="micro pt-3 text-faint md:pt-0">Sources</h2>
          <ul className="flex flex-col md:flex-row md:flex-wrap md:gap-x-6">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  <span>
                    {s.label}
                    <span aria-hidden="true">&nbsp;↗</span>
                  </span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="py-3 font-mono text-micro text-faint md:ml-auto md:py-0">Case file: Remedy · PayPal AI Hackathon · Filed 13 Nov 2026</p>
        </div>
        <p className="pt-4 pb-10 text-ui text-faint">
          Built for the PayPal AI Hackathon, November 2026. Remedy is not made by PayPal; PayPal is a trademark of PayPal, Inc.
        </p>
      </div>
    </footer>
  );
}
