import Link from "next/link";
import { Button, Paper, Wordmark } from "@/components/ui";
import styles from "./home.module.css";
import { Enter } from "./Reveal";

// The sitemap in three columns; the section names match the nav and the section eyebrows.
const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "#how", label: "How it works" },
      { href: "#problem", label: "Why recalls stall" },
      { href: "#checks", label: "Fraud checks" },
      { href: "#proof", label: "Results" },
      { href: "/r/kikea-x-vesolje/try", label: "Try a claim" },
    ],
  },
  {
    title: "For companies",
    links: [
      { href: "#companies", label: "Overview" },
      { href: "/signin", label: "Log in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

const linkClass = "inline-flex min-h-11 items-center text-ui text-muted transition-colors duration-160 hover:text-text";

/**
 * The closing call to action, as the brand's object: a large paper tag hanging on its string, on the page grid: its copy
 * on column 1 (48px in from the tag's edge), its button on column 8, where every section's second text line starts.
 * The owner's path is the one amber; companies have their Log in with PayPal a screen above, at the end of For
 * companies, and in the sitemap below.
 */
function CtaTag() {
  return (
    <Enter className="relative pt-14" threshold={0.3}>
      <Paper variant="tag" hole padding="none">
        <div className="flex flex-col gap-8 px-6 pt-14 pb-8 sm:px-12 sm:pt-14 sm:pb-10 lg:grid lg:grid-cols-12 lg:items-end lg:gap-x-(--col-gap) lg:px-0">
          <div className="lg:col-span-7 lg:pl-12">
            <p className="eyebrow text-ink-muted">Try it</p>
            <h2 className="mt-4 text-title-lg font-medium text-balance">See a refund land in a minute.</h2>
            <p className="mt-3 max-w-[40ch] text-body text-pretty text-ink-muted">
              Run four claims, one of them genuine. Remedy pays it through PayPal and stops the three fakes.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 lg:col-span-5 lg:col-start-8 lg:pr-12">
            {/* Below sm the button spans the tag with tighter padding, so the label fits on one line at 375px; at 320px it
                is wider than the tag and wraps, balanced, its ring kept in view. */}
            <Button
              href="/r/kikea-x-vesolje/try"
              size="lg"
              data-try-cta=""
              className="shadow-[0_0_0_1px_var(--paper-line)] focus-visible:outline-ink max-sm:h-auto max-sm:min-h-12 max-sm:w-full max-sm:px-3 max-sm:py-3 max-sm:text-center max-sm:text-balance max-sm:whitespace-normal"
            >
              Try a claim
            </Button>
          </div>
        </div>
      </Paper>
      {/* The string hangs from a pin at the top of the tag's padding and runs down over the paper to the top rim of the
          tag's hole (19px below the tag's top edge, so the padding above plus 19px), where it goes through: it ends at the
          rim, so the hole reads as a dark hole, never a dial with a hand in it. The tag hangs from something, as the code
          tag in How it works does. Pin and string come in together on enter, in one ink move. The pin is graphite with a brass
          cast, so the button stays the frame's one amber. */}
      <span
        aria-hidden="true"
        className={`${styles.pin} absolute top-0 left-[calc(50%-16px)] z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_oklch,var(--accent-edge)_40%,var(--text-2))] shadow-[0_0_0_1px_oklch(0_0_0/0.35),0_2px_3px_-1px_oklch(0_0_0/0.4)]`}
      />
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
          d="M32 0C34 40 70 58 62 96c-4 16-12 22-13.5 30"
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
    <footer>
      {/* The tag hangs on the grid, columns 1 to 12, so its copy and its button sit on the page's two text lines. */}
      <div className="page grid-12">
        <div className="col-span-12">
          <CtaTag />
        </div>
      </div>
      {/* Under the tag: the brand and its line, then the sitemap in three columns; the copyright on a hairline under
          them. */}
      <div className="page mt-24">
        <div className="grid-12 gap-y-10 md:items-start">
          <div className="col-span-12 md:col-span-5 lg:col-span-6">
            <Wordmark size="md" />
            <p className="mt-3 max-w-[44ch] text-ui text-muted">
              Recall refunds, proven and paid. Remedy gives any US product recall its own claim link and pays owners through PayPal within a minute.
            </p>
          </div>
          {/* #footer-nav: where the nav's Menu link goes without JS. */}
          <nav id="footer-nav" aria-label="Footer" className="col-span-12 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:col-span-7 lg:col-span-5 lg:col-start-8">
            {COLUMNS.map((c) => (
              <div key={c.title}>
                <h2 className="eyebrow text-faint">{c.title}</h2>
                <ul className="mt-2 flex flex-col">
                  {c.links.map((l) => (
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
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-1 border-t border-line pt-5 pb-10 text-ui text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 Remedy</p>
          <p>Started at the PayPal AI Hackathon. The console runs on AG Grid and AG Studio.</p>
        </div>
      </div>
    </footer>
  );
}
