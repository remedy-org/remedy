import { Button, Card, NoBreakHyphens } from "@/components/ui";
import { StepTitle } from "./Exhibit";
import { LockIcon } from "./icons";

/**
 * A claim link opened with no owner session, most often the phone that scanned the laptop's QR: a Remedy screen first,
 * so the PayPal login that follows never looks like it came from nowhere. Nothing about the claim is read until login.
 */
export function ContinueCard({ id, product, company, loginHref, demo }: { id: string; product: string; company: string; loginHref: string; demo?: boolean }) {
  return (
    <Card padding="lg" as="section" aria-labelledby="continue-title" className="mx-auto flex w-full max-w-claim flex-col gap-7">
      <div className="flex flex-col gap-3">
        <span className="micro text-faint">
          Claim <span className="font-mono whitespace-nowrap">{id}</span>
        </span>
        <StepTitle id="continue-title">Continue your claim on this device</StepTitle>
        <p className="text-body text-pretty text-muted">
          Your refund for the <NoBreakHyphens>{product}</NoBreakHyphens>, from {company} through Remedy. Log in with the same PayPal {demo ? "sandbox " : ""}account you started it
          with: your code and its 10 minutes carry over.
        </p>
      </div>
      <Button href={loginHref} size="lg" block prefetch={false}>
        {demo ? "Log in with PayPal sandbox" : "Log in with PayPal"}
      </Button>
      <p className="-mt-3 flex gap-2.5 text-ui text-faint">
        <LockIcon className="mt-0.5 shrink-0" />
        <span>You log in on PayPal&apos;s own page, then come straight back here. Remedy never sees your password.</span>
      </p>
    </Card>
  );
}
