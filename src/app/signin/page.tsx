import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, CheckIcon, ErrorState, ExhibitLabel, Wordmark } from "@/components/ui";
import { DEFAULT_NEXT, getSession, safeNext } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Companies running a recall sign in to Remedy with their PayPal business account.",
};

const ERRORS: Record<string, { title: string; description: string }> = {
  denied: { title: "PayPal login was cancelled", description: "Nothing was shared with Remedy. Log in again when you're ready." },
  state: { title: "That login link expired", description: "Logins time out after 10 minutes, or the page was opened in another browser. Start again here." },
  paypal: { title: "PayPal didn't confirm the login", description: "PayPal's login service didn't answer us. Try again in a minute." },
};

const FACTS = [
  "Your workspace opens with the Kikea X-VESOLJE demo recall and 40 sample claims to explore.",
  "Refunds go from your PayPal business account straight to each owner's PayPal account. Remedy never holds the money.",
  "Remedy reads your PayPal name, email and account id to open your workspace. Nothing else.",
];

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNext(one(params.next), DEFAULT_NEXT.company);
  if (await getSession("company")) redirect(next);

  const error = ERRORS[one(params.auth_error) ?? ""];
  const start = `/api/auth/paypal/start?${new URLSearchParams({ as: "company", next })}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center px-4 sm:px-6 lg:px-8">
        <Wordmark href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
        <Card padding="lg" className="w-full max-w-claim">
          <ExhibitLabel leader="right" leaderLength={24}>
            For companies running a recall
          </ExhibitLabel>
          <h1 className="mt-4 text-h2 font-semibold">Sign in to your recall console</h1>
          <p className="mt-3 text-body text-muted">Use the PayPal business account that will send the refunds. Your claims, payouts and CPSC report are there.</p>

          {error && <ErrorState variant="inline" className="mt-6" title={error.title} description={error.description} />}

          <Button href={start} size="lg" block className="mt-8" prefetch={false}>
            Log in with PayPal
          </Button>
          <p className="mt-3 text-center text-ui text-muted">You&apos;ll confirm on PayPal&apos;s own page, then come back here.</p>

          <ul className="mt-8 flex flex-col border-t border-line">
            {FACTS.map((f) => (
              <li key={f} className="flex gap-3 border-b border-line py-3 text-ui text-muted last:border-b-0 last:pb-0">
                <CheckIcon className="mt-0.5 shrink-0 text-pay" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-8 flex w-full max-w-claim flex-col items-center gap-2 text-center text-ui text-muted">
          <Button href="/" variant="tertiary" size="sm" arrow={false}>
            Back to Remedy
          </Button>
          <p className="text-balance">
            Own a recalled product? Use the claim link on the recall notice, or{" "}
            <Link href="/r/kikea-x-vesolje/try" className="text-text underline underline-offset-4 hover:text-accent-text">
              see a claim
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
