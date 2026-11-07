import type { ReactNode } from "react";
import { Button, Card, ClockIcon, ErrorState } from "@/components/ui";
import type { Recall } from "@/lib/types";
import { CameraIcon, EyeIcon } from "./icons";
import { companyName, money, SANDBOX_ACCOUNTS_URL } from "./model";

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
}

/** Stripe Identity's consent pattern: the company and Remedy side by side, three bullets, one full-width action. */
export function ConsentCard({ recall, href, signedInAs, demo, authError, unverified }: ConsentCardProps) {
  const company = companyName(recall);
  const amount = money(recall.refund);
  const error = authError ? AUTH_ERRORS[authError] : null;
  return (
    <Card padding="lg" as="section" aria-labelledby="consent-title" className="flex flex-col gap-8">
      <Parties company={company} />

      <div className="flex flex-col gap-3">
        <h2 id="consent-title" className="text-h2 font-semibold text-balance">
          {demo ? `Try a claim with sample photos` : `${company} refunds this recall through Remedy`}
        </h2>
        <p className="text-body text-muted">
          {demo
            ? `The real checks and a real PayPal sandbox payout of ${amount}, on photos we provide. About 2 minutes.`
            : `Get ${amount} back in your PayPal account once your photos are checked. It takes about 5 minutes.`}
        </p>
      </div>

      <ul className="flex flex-col gap-5">
        <Bullet icon={<CameraIcon />} title="What you'll do">
          {demo
            ? "Pick a sample claim: a genuine one, a wrong code, an AI image, or a reposted photo. Each runs the same checks as a real one."
            : "Destroy the product as the notice says, write the code we give you on a tag, and photograph it on this page's camera."}
        </Bullet>
        <Bullet icon={<EyeIcon />} title="What we see">
          Your PayPal account ID, whether it&apos;s verified, and the photos {demo ? "you send" : "you take here"}. Never your password, balance or cards.
        </Bullet>
        <Bullet icon={<ClockIcon />} title="When you're paid">
          {demo
            ? `Seconds after the checks pass, ${amount} in sandbox money goes to the PayPal sandbox account you log in with.`
            : "Usually within a minute of your photos, straight to your PayPal account through PayPal Payouts."}
        </Bullet>
      </ul>

      {unverified && (
        <ErrorState
          variant="inline"
          title="This PayPal account isn't verified"
          description="PayPal only lets us refund verified accounts. Verify yours with PayPal (a confirmed email and a linked bank or card), then log in again."
        />
      )}
      {error && <ErrorState variant="inline" title={error.title} description={error.description} />}

      <div className="flex flex-col gap-3">
        <Button href={href} size="lg" block prefetch={false}>
          {unverified ? "Log in with a verified account" : signedInAs ? (demo ? "Choose a sample claim" : "Continue to your code") : demo ? "Log in with PayPal sandbox" : "Log in with PayPal"}
        </Button>
        {demo && !signedInAs ? (
          <p className="text-center text-ui text-faint">
            Needs a PayPal sandbox personal account, not your real PayPal login. Use the judges&apos; test login in the submission notes, or{" "}
            <a href={SANDBOX_ACCOUNTS_URL} className="text-muted underline underline-offset-4 hover:text-text">
              make one at developer.paypal.com
            </a>
            .
          </p>
        ) : (
          <p className="text-center text-ui text-faint">
            {signedInAs ? `Logged in with PayPal as ${signedInAs}.` : "You log in on PayPal's own page. Remedy never sees your password."}
          </p>
        )}
      </div>
    </Card>
  );
}

function Parties({ company }: { company: string }) {
  const initials = company
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-3" aria-label={`${company} and Remedy`}>
      <Party label={company}>
        <span className="font-mono text-ui font-medium text-text">{initials}</span>
      </Party>
      <span className="h-px w-8 shrink-0 bg-line-strong" aria-hidden="true" />
      <Party label="Remedy">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6 2.5h8.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6L2.5 13.5v-7z" fill="var(--accent)" />
          <circle cx="7" cy="10" r="1.6" fill="var(--surface-2)" />
          <path d="M10.5 7.5h3M10.5 10h3M10.5 12.5h2" stroke="var(--accent-ink)" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </Party>
    </div>
  );
}

function Party({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-card border border-line bg-surface-2">{children}</span>
      <span className="truncate text-ui font-medium text-text">{label}</span>
    </div>
  );
}

function Bullet({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-2 text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-ui font-medium text-text">{title}</p>
        <p className="mt-0.5 text-ui text-muted">{children}</p>
      </div>
    </li>
  );
}
