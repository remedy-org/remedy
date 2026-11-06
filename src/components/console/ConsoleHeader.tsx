import { ThemeToggle, Wordmark } from "@/components/ui";
import type { Session } from "@/lib/session";
import { ConsoleNav } from "./ConsoleNav";

/** App chrome: wordmark and the three places on the left; who is signed in, the theme and sign out on the right. */
export function ConsoleHeader({ session }: { session: Session | null }) {
  const who = session?.name ?? session?.email ?? null;
  return (
    <header className="border-b border-line bg-bg print:hidden">
      <div className="flex h-14 items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Wordmark href="/console" />
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
      <ConsoleNav className="flex border-t border-line px-4 sm:hidden" />
    </header>
  );
}
