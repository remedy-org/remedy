import clsx from "clsx";
import { Button, Card, ErrorState, Money, NoBreakHyphens, Paper, StatusPill, statusLabel } from "@/components/ui";
import { DEMO_SAMPLES } from "@/lib/demo";
import type { Refusal } from "@/lib/limits";
import type { Recall } from "@/lib/types";
import { StepTitle } from "./Exhibit";
import { InfoIcon, LockIcon } from "./icons";
import { LimitNotice } from "./LimitNotice";
import { companyName, cutInHalf, money, productNoun, SANDBOX_ACCOUNTS_URL } from "./model";

export type AuthError = "denied" | "state" | "paypal" | "refused";

const AUTH_ERRORS: Record<AuthError, { title: string; description: string }> = {
  denied: { title: "The PayPal login was cancelled", description: "Remedy needs it to know which PayPal account to refund. Nothing was shared." },
  state: { title: "That login took too long", description: "The PayPal page was open for more than 10 minutes, or in another tab. Log in again." },
  paypal: { title: "PayPal didn't answer", description: "Nothing was shared and no claim was started. Try again in a minute." },
  refused: { title: "PayPal wouldn't share this account", description: "Nothing was shared and no claim was started. Log in with a different PayPal account, such as a personal one." },
};

export interface ConsentCardProps {
  recall: Recall;
  /** Where the primary button goes: PayPal login, or straight on when already logged in. */
  href: string;
  /** Logged in already: the button continues instead of logging in. */
  signedInAs?: string | null;
  demo?: boolean;
  authError?: AuthError | null;
  unverified?: boolean;
  /** The last start was refused by a spending limit. */
  refusal?: Refusal | null;
}

/** The primary button's words, shared with the phone's sticky bar. */
export function consentAction({ signedInAs, demo, unverified }: Pick<ConsentCardProps, "signedInAs" | "demo" | "unverified">): string {
  if (unverified) return "Log in with a verified account";
  if (signedInAs) return demo ? "Choose a sample claim" : "Continue to your code";
  return demo ? "Log in with PayPal sandbox" : "Log in with PayPal";
}

/**
 * The consent card, after Stripe Identity and Plaid: the refund first, a two-tone promise, the two parties as
 * overlapping marks, three numbered steps (the four samples in the demo), one full-width action and a privacy line.
 */
export function ConsentCard({ recall, href, signedInAs, demo, authError, unverified, refusal }: ConsentCardProps) {
  const company = companyName(recall);
  const amount = money(recall.refund);
  const error = authError ? AUTH_ERRORS[authError] : null;
  const steps = [
    cutInHalf(recall.spec) ? "Cut it in half, as the notice says" : "Destroy it, as the notice says",
    "Write your one-time code on a tag and photograph it here",
    recall.autoPay ? "Paid to your PayPal, usually within a minute" : `Paid to your PayPal once ${company} approves it`,
  ];
  return (
    <Card padding="lg" as="section" aria-labelledby="consent-title" className="flex flex-col gap-7">
      {/* On a phone the recall row above already shows the refund. */}
      <div className="flex flex-col gap-2 max-sm:hidden">
        <span className="micro text-faint">{demo ? "Refund · sandbox money" : "Your refund"}</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Money value={Number(recall.refund.value)} currency={recall.refund.currency} size="amount" className="text-text" />
          <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 font-mono text-micro whitespace-nowrap text-muted">
            {demo ? "About 2 min" : "About 5 min"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <StepTitle id="consent-title" className="text-pretty">
            {demo ? "Try a claim with sample photos" : <NoBreakHyphens>{`Get ${amount} back for your ${productNoun(recall)}.`}</NoBreakHyphens>}
          </StepTitle>
          <p className="text-body text-pretty text-muted">
            {demo
              ? `Real checks, a real PayPal sandbox payout of ${amount}, on photos we provide. About 2 minutes.`
              : recall.autoPay
                ? `Remedy sends it through PayPal for ${company} once your photo shows it's destroyed.`
                : `Remedy sends it through PayPal for ${company} once your photo is checked and ${company} approves it.`}
          </p>
        </div>
        <Parties company={company} />
      </div>

      {demo ? (
        <div className="flex flex-col gap-3 max-sm:order-last">
          <h3 className="micro text-faint">Four sample claims you&apos;ll run</h3>
          <ul className="grid gap-x-4 gap-y-3 sm:grid-cols-2 sm:gap-y-4">
            {DEMO_SAMPLES.map((s) => (
              <li key={s.id} className="flex min-w-0 items-start gap-3">
                <SampleTag src={s.photos[0]} />
                <span className="flex min-w-0 flex-col items-start gap-1.5">
                  <span className="text-ui leading-tight font-medium text-text">{s.title}</span>
                  <StatusPill status={s.expect} label={`Should be ${statusLabel(s.expect).toLowerCase()}`} />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-ui text-faint">The photos are AI-made samples, labelled on every screen.</p>
        </div>
      ) : (
        <ol className="relative flex flex-col gap-3 before:absolute before:top-1.5 before:bottom-1.5 before:left-[7px] before:w-px before:bg-line max-sm:order-last">
          {steps.map((s, i) => (
            <li key={s} className="relative grid grid-cols-[2rem_minmax(0,1fr)] items-baseline text-ui font-medium text-text">
              <span className="relative bg-surface py-0.5 font-mono text-micro text-faint">{String(i + 1).padStart(2, "0")}</span>
              {s}
            </li>
          ))}
        </ol>
      )}

      {unverified && (
        <ErrorState
          variant="inline"
          title="This PayPal account isn't verified"
          description="PayPal only lets us refund verified accounts. Verify yours with PayPal (a confirmed email and a linked bank or card), then log in again."
        />
      )}
      {error && <ErrorState variant="inline" title={error.title} description={error.description} />}
      {refusal && <LimitNotice refusal={refusal} demo={Boolean(demo)} />}

      <div className="flex flex-col gap-4">
        {demo && !signedInAs && (
          <div className="flex gap-3 rounded-card bg-hold-soft p-4 text-ui">
            <InfoIcon className="mt-0.5 shrink-0 text-hold" />
            <div className="flex flex-col gap-1">
              <p className="font-medium text-text">
                Log in with a PayPal <strong className="font-semibold">sandbox</strong> personal account.
              </p>
              <p className="text-muted">
                The judges&apos; test login is in the submission notes. Your real PayPal login won&apos;t work here. No login?{" "}
                <a href={SANDBOX_ACCOUNTS_URL} className="text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">
                  Make one at developer.paypal.com
                </a>
                .
              </p>
            </div>
          </div>
        )}
        <Button id="consent-cta" href={href} size="lg" block prefetch={false}>
          {consentAction({ signedInAs, demo, unverified })}
        </Button>
      </div>
      {/* Under the button on a laptop; on a phone after the steps, which follow the button there. */}
      <p className="-mt-3 flex gap-2.5 text-ui text-faint max-sm:order-last max-sm:mt-0">
        <LockIcon className="mt-0.5 shrink-0" />
        <span>
          {signedInAs ? `Logged in with PayPal as ${signedInAs}. ` : "You log in on PayPal's own page. "}
          Remedy sees your PayPal account ID, whether it&apos;s verified, and {demo ? "the photos you send" : "your photos"}. Never your password, balance or cards.
        </span>
      </p>
    </Card>
  );
}

/** The company and Remedy as two overlapping 44px marks (Plaid's squares), then who works with whom. */
function Parties({ company }: { company: string }) {
  const initials = company
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <span className="flex shrink-0" aria-hidden="true">
        <span className="flex size-11 items-center justify-center rounded-card border border-line bg-surface-2 text-ui font-semibold text-text">{initials}</span>
        <span className="-ml-2.5 flex size-11 items-center justify-center rounded-card bg-bg ring-2 ring-surface">
          <TagGlyph />
        </span>
      </span>
      <span className="text-ui text-muted">{company} works with Remedy to pay this recall.</span>
    </div>
  );
}

/** Remedy's tag mark (the Wordmark glyph without its string), for the overlapping marks. */
function TagGlyph() {
  return (
    <svg width="22" height="22" viewBox="5 7 14 18" aria-hidden="true">
      <g transform="rotate(-8 12 15)">
        <path
          fillRule="evenodd"
          fill="var(--accent)"
          d="M9.5 8.5h5l3.5 3.5v9.25c0 .97-.78 1.75-1.75 1.75h-8.5c-.97 0-1.75-.78-1.75-1.75V12zM13.5 12a1.5 1.5 0 1 0-3 0a1.5 1.5 0 1 0 3 0z"
        />
        <path d="M9 16.25h6M9 19.25h3.5" stroke="var(--accent-ink)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** A sample's photo as a small paper tag: what the judge will run. */
export function SampleTag({ src, className }: { src: string; className?: string }) {
  return (
    <Paper variant="tag" padding="none" className={clsx("w-10 shrink-0 [--tag-cut:6px]", className)}>
      <div className="p-[3px] pt-[8px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="aspect-[3/4] w-full rounded-[2px] object-cover" />
      </div>
    </Paper>
  );
}
