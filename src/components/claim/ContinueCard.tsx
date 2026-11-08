"use client";

import { Button, Card, NoBreakHyphens } from "@/components/ui";
import { TimerPill } from "./CodeStep";
import { StepTitle } from "./Exhibit";
import { LockIcon } from "./icons";
import { useCountdown } from "./useCountdown";

export interface ContinueCardProps {
  id: string;
  product: string;
  company: string;
  loginHref: string;
  /** The code's camera session, while it is still the next step: the time left shows beside the title. */
  expiresAt?: string;
  /** The server's clock at render, for the countdown's first paint. */
  startNow: number;
  /** Logged in already, with a PayPal account other than the claim's: who, so the owner can switch. */
  signedInAs?: string;
}

/**
 * A claim link opened with no owner session (most often the phone that scanned the laptop's QR), or with another PayPal
 * account's: a Remedy screen first, so the PayPal login that follows never looks like it came from nowhere. Nothing
 * about the claim's owner is shown; only the code's time left.
 */
export function ContinueCard({ id, product, company, loginHref, expiresAt, startNow, signedInAs }: ContinueCardProps) {
  const account = "PayPal account";
  // Frozen at zero when there is no session to count down: nothing shows then.
  const left = useCountdown(expiresAt ?? new Date(0).toISOString(), startNow, !expiresAt);
  const ended = Boolean(expiresAt) && left <= 0;
  const carry = ended ? "its code's 10 minutes are up, so you can get a new code there." : "your code and its 10 minutes carry over.";
  return (
    <Card padding="lg" as="section" aria-labelledby="continue-title" className="mx-auto flex w-full max-w-claim flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <span className="micro text-faint">
            Claim <span className="font-mono whitespace-nowrap">{id}</span>
          </span>
          {expiresAt && <TimerPill left={left} />}
        </div>
        <StepTitle id="continue-title">{signedInAs ? `Started with another ${account}` : "Continue your claim on this device"}</StepTitle>
        {signedInAs ? (
          <p className="text-body text-pretty text-muted">
            You&apos;re logged in as <span className="text-text">{signedInAs}</span>. Log in with the {account} this claim was started with: {carry}
          </p>
        ) : (
          <p className="text-body text-pretty text-muted">
            Your refund for the <NoBreakHyphens>{product}</NoBreakHyphens>, from {company} through Remedy. Log in with the same {account} you started it with: {carry}
          </p>
        )}
      </div>
      {signedInAs ? (
        // Logs this account out, then straight on to the PayPal login, which returns here.
        <form action="/api/auth/signout" method="post">
          <input type="hidden" name="as" value="owner" />
          <input type="hidden" name="next" value={loginHref} />
          <Button type="submit" size="lg" block>
            Log in with another account
          </Button>
        </form>
      ) : (
        <Button href={loginHref} size="lg" block prefetch={false}>
          Log in with PayPal
        </Button>
      )}
      <p className="-mt-3 flex gap-2.5 text-ui text-faint">
        <LockIcon className="mt-0.5 shrink-0" />
        <span>You log in on PayPal&apos;s own page, then come straight back here. Remedy never sees your password.</span>
      </p>
    </Card>
  );
}
