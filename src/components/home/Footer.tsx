import clsx from "clsx";
import Link from "next/link";
import { Button, Paper, Wordmark } from "@/components/ui";
import styles from "./home.module.css";
import { Enter } from "./Reveal";

const PRODUCT = [
  { href: "#how", label: "How it works" },
  { href: "#checks", label: "What stops a fake" },
  { href: "#proof", label: "Proof" },
  { href: "/r/kikea-x-vesolje/try", label: "Try a demo claim" },
  { href: "/signin", label: "Sign in" },
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

/** The closing call to action, as the brand's object: a large paper tag hanging on its string. */
function CtaTag() {
  return (
    <Enter className="relative mx-auto max-w-[65rem] pt-24 sm:pt-28" threshold={0.3}>
      <Paper variant="tag" hole padding="none" className="sm:-rotate-1">
        <div className="flex flex-col gap-8 px-6 pt-14 pb-8 sm:px-12 sm:pt-16 sm:pb-12 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div>
            <p className="micro text-ink-muted">Exhibit E · Your recall</p>
            <h2 className="mt-4 text-title-lg font-semibold text-balance">Running a recall?</h2>
            <p className="mt-4 max-w-[36ch] text-body text-pretty text-ink-muted sm:text-lead">Log in with PayPal and import it from CPSC in a minute.</p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3">
            <Button href="/signin" size="lg" className="shadow-[0_0_0_1px_var(--paper-line)] focus-visible:outline-ink">
              Log in with PayPal
            </Button>
            <p className="font-mono text-micro text-ink-muted">Refunds in PayPal&rsquo;s sandbox until launch</p>
          </div>
        </div>
      </Paper>
      {/* The string hangs from the footer's top rule and runs down over the paper into the tag's hole (19px below the
          tag's top edge). Drawn in on enter. */}
      <svg
        aria-hidden="true"
        className="absolute top-0 left-1/2 z-10 h-[115px] w-24 -translate-x-1/2 overflow-visible sm:h-[131px]"
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
    <footer className="border-t border-line">
      <div className="px-4 sm:px-8">
        <CtaTag />
      </div>
      <div className="mx-auto mt-20 grid max-w-content grid-cols-2 gap-x-6 gap-y-12 px-4 pb-12 sm:mt-24 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-16">
        <div className="col-span-2 md:col-span-1">
          <Wordmark size="md" />
          <p className="mt-4 max-w-[36ch] text-ui text-muted">
            Recall refunds in a minute for people who really destroyed the product, and never for a faked photo.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="micro text-faint">Remedy</h2>
          <ul className="mt-3">
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
        <div>
          <h2 className="micro text-faint">Sources</h2>
          <ul className="mt-3">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a href={s.href} className={linkClass}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-content px-4 sm:px-8">
        <div className={clsx("flex flex-col gap-2 border-t border-line py-6 md:flex-row md:items-baseline md:justify-between md:gap-8")}>
          <p className="text-ui text-faint">
            Built for the PayPal AI Hackathon, November 2026. Remedy is not made by PayPal; PayPal is a trademark of PayPal, Inc.
          </p>
          <p className="shrink-0 font-mono text-micro text-faint">Case file: Remedy · PayPal AI Hackathon · Filed 13 Nov 2026</p>
        </div>
      </div>
    </footer>
  );
}
