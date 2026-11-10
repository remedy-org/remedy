"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  // A recall's settings page is reached from the claims queue's heading, and its Claims button goes back there.
  { href: "/console", label: "Claims", match: (p: string) => p === "/console" || (p.startsWith("/console/recalls/") && p !== "/console/recalls/new") },
  { href: "/console/insights", label: "Insights", match: (p: string) => p.startsWith("/console/insights") },
  { href: "/console/recalls/new", label: "New recall", match: (p: string) => p === "/console/recalls/new" },
  { href: "/console/report", label: "Report", match: (p: string) => p.startsWith("/console/report") },
] as const;

/** The current workspace has a violet tint and a persistent bottom marker. */
export function ConsoleNav({ className }: { className?: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Console" className={className}>
      <ul className="flex items-stretch gap-1 sm:gap-1.5">
        {LINKS.map((l) => {
          const active = l.match(path);
          return (
            <li key={l.href} className="flex">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative my-2 inline-flex min-h-10 items-center rounded-control px-3 font-display text-ui font-medium transition-colors",
                  active ? "bg-accent-soft text-accent-text after:absolute after:inset-x-3 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-accent" : "text-muted hover:bg-surface hover:text-text",
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
