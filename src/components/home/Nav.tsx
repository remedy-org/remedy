import Link from "next/link";
import { Button, Wordmark } from "@/components/ui";
import { ScrollProgress } from "./ScrollProgress";

// In page order. The exhibits carry their letter, as the sections do; How it works is the hero's own sequence.
const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#problem", exhibit: "A", label: "Problem" },
  { href: "#checks", exhibit: "B", label: "Checks" },
  { href: "#proof", exhibit: "C", label: "Proof" },
  { href: "#companies", exhibit: "D", label: "For companies" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-content items-center gap-8 px-4 sm:px-8">
        <Wordmark size="md" href="/" />
        <ul className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="group inline-flex min-h-11 items-center gap-1.5 rounded-control text-ui text-muted transition-colors duration-160 hover:text-text">
                {l.exhibit && (
                  <span aria-hidden="true" className="font-mono text-micro text-faint transition-colors duration-160 group-hover:text-accent-text">
                    {l.exhibit}
                  </span>
                )}
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-4 sm:gap-6">
          <Link href="/signin" className="inline-flex min-h-11 items-center rounded-control text-ui text-muted transition-colors duration-160 hover:text-text">
            Sign in
          </Link>
          <Button href="/signin" size="sm">
            Start a recall
          </Button>
        </div>
      </nav>
      <ScrollProgress />
    </header>
  );
}
