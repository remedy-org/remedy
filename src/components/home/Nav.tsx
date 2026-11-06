import Link from "next/link";
import { Button, Wordmark } from "@/components/ui";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#proof", label: "Proof" },
  { href: "#companies", label: "For companies" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-content items-center gap-8 px-4 sm:px-8">
        <Wordmark size="md" href="/" />
        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="inline-flex min-h-11 items-center rounded-control text-ui text-muted transition-colors duration-160 hover:text-text">
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
    </header>
  );
}
