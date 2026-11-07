import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JudgeLoginPanel } from "@/components/claim/JudgeLoginPanel";
import { ConsoleReplica, PREVIEW_ROWS } from "@/components/home/ConsoleReplica";
import { Button, Card, CheckIcon, ErrorState, ExhibitLabel, ThemeToggle, Wordmark } from "@/components/ui";
import { judgeLogin } from "@/lib/demo/judgeLogin";
import { DEFAULT_NEXT, getSession, safeNext } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Companies running a recall sign in to Remedy with PayPal.",
};

const ERRORS: Record<string, { title: string; description: string }> = {
  denied: { title: "PayPal login was cancelled", description: "Nothing was shared with Remedy. Log in again when you're ready." },
  state: { title: "That login link expired", description: "Logins time out after 10 minutes, or the page was opened in another browser. Start again here." },
  paypal: { title: "PayPal didn't confirm the login", description: "PayPal's login service didn't answer us. Try again in a minute." },
  refused: {
    title: "PayPal wouldn't share this account",
    description: "Log in with a different PayPal account. The business account that owns the Remedy app can't sign in to it.",
  },
};

const FACTS = [
  <>
    Your workspace opens with the Kikea <span className="whitespace-nowrap">X-VESOLJE</span> demo recall and 40 sample claims to explore.
  </>,
  "In this build, refunds are sent from Remedy's PayPal sandbox business account. At launch each company connects its own through PayPal.",
  "Remedy reads your PayPal name, email and account id to open your workspace. Nothing else.",
];

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNext(one(params.next), DEFAULT_NEXT.company);
  if (await getSession("company")) redirect(next);

  const error = ERRORS[one(params.auth_error) ?? ""];
  const signedOut = !error && one(params.signedout) === "1";
  const start = `/api/auth/paypal/start?${new URLSearchParams({ as: "company", next })}`;
  // The judges' business sandbox login. From a try result's "see this claim" link, it says why the console needs it.
  const login = judgeLogin("business");
  const fromClaim = new URL(next, "http://n").searchParams.has("claim");

  return (
    // On the homepage's page frame and 12-column grid: the wordmark on the gutter, the card in columns 1 to 5, and the
    // console still from column 7, running off the right edge like the hero's laptop.
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      {/* The way back and the theme stay in reach above the fold, as on every page. */}
      <header className="page flex h-16 items-center justify-between gap-4">
        <Wordmark href="/" />
        <div className="flex items-center gap-2 sm:gap-5">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-control text-ui whitespace-nowrap text-muted transition-colors duration-160 hover:text-text">
            <span aria-hidden="true">&larr;&nbsp;</span>Back to Remedy
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="page grid-12 flex-1 content-center items-center py-12 outline-none sm:py-16">
        <div className="col-span-12 flex flex-col items-center lg:col-span-5 lg:items-stretch">
          <Card padding="lg" className="w-full max-w-claim">
            <ExhibitLabel leader="right" leaderLength={24}>
              For companies running a recall
            </ExhibitLabel>
            <h1 className="mt-4 text-h2 font-medium">Sign in to your recall console</h1>
            <p className="mt-3 text-body text-muted">Log in with PayPal. Your claims, payouts and CPSC report are there.</p>

            {error && <ErrorState variant="inline" className="mt-6" title={error.title} description={error.description} />}
            {signedOut && (
              <p role="status" className="mt-6 flex items-center gap-2.5 rounded-control border border-line bg-surface-2 px-4 py-3 text-ui text-text-2">
                <CheckIcon className="shrink-0 text-pay" />
                You&apos;re signed out. Log in again to open your console.
              </p>
            )}

            {login && (
              <JudgeLoginPanel
                login={login}
                className="mt-6"
                why={fromClaim ? "The console is the company's side. Log in with the business sandbox account to see this claim." : undefined}
              />
            )}

            <Button href={start} size="lg" block className="mt-8" prefetch={false}>
              Log in with PayPal
            </Button>
            <p className="mt-3 text-center text-ui text-muted">You&apos;ll confirm on PayPal&apos;s own page, then come back here.</p>

            <ol className="mt-8 flex flex-col border-t border-line">
              {FACTS.map((f, i) => (
                <li key={i} className="flex gap-3 border-b border-line py-3 text-ui text-muted last:border-b-0 last:pb-0">
                  <span className="mt-px w-5 shrink-0 font-mono text-micro leading-[1.45rem] text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span>{f}</span>
                </li>
              ))}
            </ol>
          </Card>

          <div className="mt-8 flex w-full max-w-claim flex-col items-center text-center text-ui text-muted">
            <p className="text-balance">
              Own a recalled product? Use the claim link on the recall notice, or{" "}
              <Link href="/r/kikea-x-vesolje/try" className="text-text underline decoration-line-2 underline-offset-4 hover:decoration-text">
                see a claim
              </Link>
              .
            </p>
          </div>
        </div>

        {/* What you're signing in to: the console on the demo recall, as a still. Decorative; the card says it in words.
            It keeps its 48rem layout and is zoomed to fit columns 7 to 12 (tilt included), so no word is cut at the
            viewport's edge: each step fits the narrowest screen it covers. */}
        <aside aria-hidden="true" inert className="hidden lg:col-span-6 lg:col-start-7 lg:block">
          <div className="w-[48rem] rotate-2 lg:[zoom:0.57] xl:[zoom:0.71] min-[85rem]:[zoom:0.76] min-[90rem]:[zoom:0.8]">
            <ExhibitLabel leader="right" leaderLength={48} className="mb-5 ml-8">
              40 sample claims waiting
            </ExhibitLabel>
            <ConsoleReplica rows={PREVIEW_ROWS.slice(0, 8)} className="opacity-80" />
          </div>
        </aside>
      </main>
    </div>
  );
}
