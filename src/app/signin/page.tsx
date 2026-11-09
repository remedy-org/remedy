import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PAYPAL_CONSENT } from "@/components/claim/ConsentCard";
import { JudgeLoginPanel } from "@/components/claim/JudgeLoginPanel";
import { previewProps } from "@/components/console/preview";
import { SigninPreview } from "@/components/console/SigninPreview";
import { Button, CheckIcon, ErrorState, ThemeToggle, Wordmark } from "@/components/ui";
import { judgeLogin } from "@/lib/demo/judgeLogin";
import { DEFAULT_NEXT, getSession, safeNext } from "@/lib/session";

export const metadata: Metadata = {
  title: "Log in",
  description: "Companies running a recall sign in to Remedy with PayPal.",
};

const ERRORS: Record<string, { title: string; description: string }> = {
  denied: { title: "PayPal login was cancelled", description: "Nothing was shared with Remedy. Log in again when you’re ready." },
  state: { title: "That login link expired", description: "Logins time out after 10 minutes, or the page was opened in another browser. Start again here." },
  paypal: { title: "PayPal didn’t confirm the login", description: "PayPal’s login service didn’t answer us. Try again in a minute." },
  refused: {
    title: "PayPal wouldn’t share this account",
    description: "Log in with a different PayPal account. The business account that owns the Remedy app can’t sign in to it.",
  },
};

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNext(one(params.next), DEFAULT_NEXT.company);
  if (await getSession("company")) redirect(next);

  const error = ERRORS[one(params.auth_error) ?? ""];
  const signedOut = !error && one(params.signedout) === "1";
  const start = `/api/auth/paypal/start?${new URLSearchParams({ as: "company", next })}`;
  // The demo business account. From a try result's "see this claim" link, it says why the console needs it.
  const login = judgeLogin("business");
  const fromClaim = new URL(next, "http://n").searchParams.has("claim");

  // The console it opens, drawn as the console draws it: the same verdicts, reasons, payout words and figures.
  const preview = previewProps(456, { asConsole: true });

  return (
    // On the homepage's page frame and 12-column grid: the wordmark on the gutter, the form in columns 1 to 4, and from
    // 1024px the console it opens, flat, from column 6 running off the right edge. Phones get the form alone.
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="page flex h-16 items-center justify-between gap-4">
        {/* The homepage's lockup: sign-in is on the homepage's frame, so the logo keeps its size from "Log in". */}
        <Wordmark size="md" href="/" />
        <div className="flex items-center gap-2 sm:gap-5">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-control text-ui whitespace-nowrap text-muted transition-colors duration-160 hover:text-text">
            <span aria-hidden="true">&larr;&nbsp;</span>Back to Remedy
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="page grid-12 flex-1 content-center items-center py-12 outline-none sm:py-16 sm:pb-28 lg:items-start">
        <div className="col-span-12 mx-auto flex w-full max-w-[400px] flex-col lg:col-span-4 lg:mx-0">
          <h1 className="text-h2 font-medium">Log in to Remedy</h1>
          <p className="mt-2 text-ui text-muted">Review recall claims and pay refunds through PayPal.</p>

          {error && <ErrorState variant="inline" className="mt-6" title={error.title} description={error.description} />}
          {signedOut && (
            <p role="status" className="mt-6 flex items-center gap-2.5 text-ui text-text-2">
              <CheckIcon className="shrink-0 text-pay" />
              You&rsquo;re signed out.
            </p>
          )}

          <Button href={start} size="lg" block className="mt-8" prefetch={false}>
            Log in with PayPal
          </Button>
          <p className="mt-3 text-ui text-muted">{PAYPAL_CONSENT}</p>

          {/* The shared login sits under the real way in, never in front of it (a company's own PayPal login is the door):
              one quiet line, "Use the demo account", that opens the same rows as /try's, under /try's name. Open from the
              start when a try result sent the visitor here for its claim. */}
          {login && (
            <details className="group mt-6" open={fromClaim || undefined}>
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-ui text-muted hover:text-text [&::-webkit-details-marker]:hidden">
                Use the demo account
                <svg aria-hidden="true" viewBox="0 0 10 6" className="h-1.5 w-2.5 transition-transform duration-160 group-open:rotate-180">
                  <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <JudgeLoginPanel
                login={login}
                heading="h2"
                title="Demo account"
                // The summary above already says it: no second "Demo account" right under "Use the demo account".
                quietTitle
                why={fromClaim ? "This claim is in the company console. Log in with the demo account to see it." : undefined}
                className="mt-3"
              />
            </details>
          )}

          {/* An owner's way in is the recall's own page, with its notice and PayPal login: never the demo. */}
          <p className="mt-6 border-t border-line pt-5 text-ui text-muted">
            Own a recalled product? Use the claim link on the recall notice, or{" "}
            <Link href="/r/kikea-x-vesolje" className="text-link text-text underline decoration-line-2 underline-offset-4 hover:decoration-text">
              file a claim
            </Link>
            .
          </p>
        </div>

        <div className="hidden lg:col-span-7 lg:col-start-6 lg:block">
          {/* Decided claims lead (the claims still waiting for photos at the foot), and no figure or count is drawn: the
              console a visitor opens has its own, live ones, so the picture never shows a number that then changes. */}
          <SigninPreview rows={[...preview.rows.filter((r) => r.decision !== "pending"), ...preview.rows.filter((r) => r.decision === "pending")]} height={preview.height} />
        </div>
      </main>
    </div>
  );
}
