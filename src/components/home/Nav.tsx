import Link from "next/link";
import { Button, ThemeToggle, Wordmark } from "@/components/ui";

// In page order. The exhibits carry their letter, as the sections do; How it works is the hero's own sequence.
const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#problem", exhibit: "A", label: "Problem" },
  { href: "#checks", exhibit: "B", label: "Checks" },
  { href: "#proof", exhibit: "C", label: "Proof" },
  { href: "#companies", exhibit: "D", label: "For companies" },
];

/**
 * The homepage nav on the page frame: the wordmark on the first grid line, the exhibits beside it, then the theme,
 * the companies' sign-in as quiet text and "Try a claim" as the quiet button (the hero's amber button is the screen's one
 * action, the same owner path).
 * No rule under it, and a solid page tone: a translucent bar turned grey-brown over the cream paper band.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-30 bg-bg">
      <nav aria-label="Main" className="page flex h-16 items-center gap-10">
        <Wordmark size="md" href="/" />
        <ul className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-ui text-muted transition-colors duration-160 hover:text-text">
                {l.exhibit && (
                  <span aria-hidden="true" className="font-mono text-micro text-faint">
                    {l.exhibit}
                  </span>
                )}
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <ThemeToggle />
          <Link href="/signin" className="hidden min-h-11 items-center rounded-control text-ui text-muted transition-colors duration-160 hover:text-text sm:inline-flex">
            Company sign in
          </Link>
          <Button href="/r/kikea-x-vesolje/try" variant="secondary" size="sm">
            Try a claim
          </Button>
        </div>
      </nav>
    </header>
  );
}
