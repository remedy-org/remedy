"use client";

import { Button, NoBreakHyphens } from "@/components/ui";
import { TimerPill } from "./CodeStep";
import { StepTitle } from "./Exhibit";
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
  // Only a live code carries over; with none (a claim already sent, or decided) there is nothing to say about one.
  const live = Boolean(expiresAt) && !ended;
  const carry = live ? " Your code and its 10 minutes carry over." : ended ? " Its code's 10 minutes are up, so you can get a new code there." : "";
  // A link's id is only echoed back when it has a claim number's shape.
  const claim = /^RM-\d{4,}$/.test(id) ? <span className="font-mono whitespace-nowrap">{id}</span> : null;
  return (
    // On the page, not in a box: on a phone it's the screen the QR opens, and the PayPal login is its one object.
    <section aria-labelledby="continue-title" className="flex w-full flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <StepTitle id="continue-title">
            {signedInAs ? (
              `This claim belongs to another ${account}`
            ) : expiresAt ? (
              "Continue your claim on this device"
            ) : (
              <>Log in to see {claim ? <>claim {claim}</> : "your claim"}</>
            )}
          </StepTitle>
          {expiresAt && <TimerPill left={left} className="mt-2" />}
        </div>
        {signedInAs ? (
          <p className="text-body text-pretty text-muted">
            You&apos;re logged in as <span className="text-text">{signedInAs}</span>. Log in with the {account} that started {claim ? <>claim {claim}</> : "this claim"} to see it.{carry}
          </p>
        ) : (
          <p className="text-body text-pretty text-muted">
            Your refund for the <NoBreakHyphens>{product}</NoBreakHyphens>, from {company} through Remedy. Log in with the same {account} you started it with.{carry}
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
      <p className="-mt-3 text-ui text-faint">You log in on PayPal&apos;s own page, then come straight back here. Remedy never sees your password.</p>
    </section>
  );
}
