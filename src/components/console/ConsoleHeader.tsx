import { ThemeToggle, Wordmark } from "@/components/ui";
import type { Session } from "@/lib/session";
import { ConsoleNav } from "./ConsoleNav";

/**
 * App chrome: wordmark and the places on the left; who is signed in, the theme and sign out on the right. The site's one
 * header spec (DESIGN.md): the homepage's lockup, 64px bar and page frame, so the logo never moves from /signin in.
 */
export function ConsoleHeader({ session }: { session: Session | null }) {
  const who = session?.name ?? session?.email ?? null;
  return (
    <header data-console-header className="border-b border-line bg-bg print:hidden">
      <div className="page flex h-16 items-center gap-8">
        <Wordmark size="md" href="/console" />
        <ConsoleNav className="hidden self-stretch sm:flex" />
        <div className="ml-auto flex items-center gap-2">
          {who && (
            <span className="hidden max-w-[24ch] truncate text-ui text-muted md:inline" title={`Signed in with PayPal as ${who}`}>
              {who}
            </span>
          )}
          <ThemeToggle />
          {session && (
            <form action="/api/auth/signout" method="post">
              <input type="hidden" name="as" value="company" />
              <input type="hidden" name="next" value="/signin" />
              <button type="submit" className="inline-flex min-h-11 items-center rounded-control px-2 text-ui text-muted hover:text-text">
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
      <ConsoleNav className="page flex border-t border-line sm:hidden" />
    </header>
  );
}
