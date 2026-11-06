"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/console", label: "Claims", match: (p: string) => p === "/console" },
  { href: "/console/recalls/new", label: "New recall", match: (p: string) => p === "/console/recalls/new" },
  { href: "/console/report", label: "Report", match: (p: string) => p.startsWith("/console/report") },
] as const;

/** The console's three places. The current one is full text colour with a hairline underline; the rest are muted. */
export function ConsoleNav({ className }: { className?: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Console" className={className}>
      <ul className="flex items-stretch gap-6">
        {LINKS.map((l) => {
          const active = l.match(path);
          return (
            <li key={l.href} className="flex">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative inline-flex min-h-11 items-center text-ui font-medium transition-colors",
                  active ? "text-text after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-text" : "text-muted hover:text-text",
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
