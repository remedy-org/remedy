import Link from "next/link";
import { Wordmark } from "@/components/ui";

const PRODUCT = [
  { href: "#how", label: "How it works" },
  { href: "#checks", label: "What stops a fake" },
  { href: "#proof", label: "Proof" },
  { href: "/r/kikea-x-vesolje/try", label: "See a claim" },
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

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-content grid-cols-2 gap-x-6 gap-y-12 px-4 pt-16 pb-12 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-16">
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
        <p className="border-t border-line py-6 text-ui text-faint">
          Built for the PayPal AI Hackathon, November 2026. Remedy is not made by PayPal; PayPal is a trademark of PayPal, Inc.
        </p>
      </div>
    </footer>
  );
}
