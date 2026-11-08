import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle, Wordmark } from "@/components/ui";

export interface LegalSection {
  title: string;
  body: ReactNode;
}

/**
 * Privacy and Terms, on the sign-in page's frame: the wordmark, the way back and the theme toggle in the header, then
 * one 68ch column with an h2 per section and the copyright at the foot.
 */
export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="page flex h-16 items-center justify-between gap-4">
        <Wordmark href="/" />
        <div className="flex items-center gap-2 sm:gap-5">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-control text-ui whitespace-nowrap text-muted transition-colors duration-160 hover:text-text">
            <span aria-hidden="true">&larr;&nbsp;</span>Back to Remedy
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="page flex-1 py-12 outline-none sm:py-20">
        <article className="max-w-[68ch]">
          <h1 className="text-h2 font-medium">{title}</h1>
          <p className="mt-3 text-ui text-faint">Last updated {updated}.</p>
          {sections.map((s) => (
            <section key={s.title} className="mt-10">
              <h2 className="text-body font-medium text-text">{s.title}</h2>
              <p className="mt-2 text-body text-pretty text-text-2">{s.body}</p>
            </section>
          ))}
        </article>
      </main>
      <footer className="border-t border-line">
        <div className="page flex flex-wrap items-center gap-x-2 py-6 text-ui text-faint">
          <span>&copy; 2026 Remedy</span>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="underline decoration-line-2 underline-offset-4 transition-colors duration-160 hover:text-text hover:decoration-text">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="underline decoration-line-2 underline-offset-4 transition-colors duration-160 hover:text-text hover:decoration-text">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
