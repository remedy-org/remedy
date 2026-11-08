import clsx from "clsx";
import { Button, Card, ErrorState, NoBreakHyphens } from "@/components/ui";
import type { JudgeLogin } from "@/lib/demo/judgeLogin";
import type { Refusal } from "@/lib/limits";
import type { Decision, Recall } from "@/lib/types";
import { StepTitle } from "./Exhibit";
import { JudgeLoginPanel } from "./JudgeLoginPanel";
import { LimitNextStep, LimitNotice } from "./LimitNotice";
import { companyName, cutInHalf, money, productNoun, taggedThing } from "./model";

export type AuthError = "denied" | "state" | "paypal" | "refused";

const AUTH_ERRORS: Record<AuthError, { title: string; description: string }> = {
  denied: { title: "The PayPal login was cancelled", description: "Remedy needs it to know which PayPal account to refund. Nothing was shared." },
  state: { title: "That login took too long", description: "The PayPal page was open for more than 10 minutes, or in another tab. Log in again." },
  paypal: { title: "PayPal didn't answer", description: "Nothing was shared and no claim was started. Try again in a minute." },
  refused: { title: "PayPal wouldn't share this account", description: "Nothing was shared and no claim was started. Log in with a different PayPal account, such as a personal one." },
};

/** The owner's claim for this recall, already under way: the one Continue would lead back to. */
export interface YourClaim {
  id: string;
  href: string;
  decision: Decision;
  photos: number;
  /** Held: "Tue 10 Nov". */
  decideBy?: string;
  /** Paid: "7 Nov 2026". */
  paidOn?: string;
}

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
  /** Logged in with a claim for this recall already: the card leads with it. */
  yourClaim?: YourClaim | null;
  /** /try: the demo account's PayPal login, shown just before the login button. */
  judgeLogin?: JudgeLogin | null;
}

/** The demo account's login in the card: the phone's bar shows it before it offers the PayPal login. */
export const JUDGE_LOGIN_ID = "demo-account";

/** The primary button's words, shared with the phone's sticky bar. */
export function consentAction({ signedInAs, demo, unverified, yourClaim }: Pick<ConsentCardProps, "signedInAs" | "demo" | "unverified" | "yourClaim">): string {
  if (yourClaim) return yourClaim.decision === "pending" && !yourClaim.photos ? "Continue your claim" : "See your claim";
  if (unverified) return "Log in with a verified account";
  if (signedInAs) return demo ? "Choose a claim" : "Continue to your code";
  return "Log in with PayPal";
}

/** "cut pillow" -> "pillow": the thing the owner photographs, in one word. */
const thingOf = (recall: Recall) => (taggedThing(recall.spec)?.split(" ").pop() ?? productNoun(recall).split(" ").pop() ?? "product").toLowerCase();

/**
 * The consent card: what the owner gets back, in one headline, how in one line, then one action. A
 * returning owner sees only their claim and the way back to it.
 */
export function ConsentCard({ recall, href, signedInAs, demo, authError, unverified, refusal, yourClaim, judgeLogin }: ConsentCardProps) {
  const company = companyName(recall);
  const action = consentAction({ signedInAs, demo, unverified, yourClaim });
  // Refused by a limit, a real owner's way on is the company's recall notice.
  const notice = demo ? undefined : { company, url: recall.url };
  // A cancelled login means nothing once a later one worked.
  const error = authError && !signedInAs ? AUTH_ERRORS[authError] : null;
  const thing = thingOf(recall);
  const cut = cutInHalf(recall.spec);
  const how = `${cut ? `Cut the ${thing} in half first` : `Destroy the ${thing} first, as the notice says`}, then photograph it with a code we give you, and PayPal pays you${recall.autoPay ? "" : ` once ${company} approves it`}.`;
  // Phones: the offer is the page's headline, not a box inside it.
  const open = "max-sm:border-0 max-sm:bg-transparent max-sm:p-0";

  if (yourClaim) {
    return (
      <Card padding="lg" as="section" aria-labelledby="consent-title" className={clsx("flex flex-col gap-6", open)}>
        <ClaimStatus claim={yourClaim} company={company} action={action} />
        <p className="text-ui text-faint">{signedInAs ? `Logged in with PayPal as ${signedInAs}.` : "You log in on PayPal's own page."}</p>
      </Card>
    );
  }

  return (
    <Card padding="lg" as="section" aria-labelledby="consent-title" className={clsx("flex flex-col gap-7", open)}>
      <div className="flex flex-col gap-3">
        <StepTitle id="consent-title" as="h2" className="text-pretty">
          <NoBreakHyphens>{demo ? `Run a claim for the ${productNoun(recall)}` : `${money(recall.refund)} back for your ${productNoun(recall)}`}</NoBreakHyphens>
        </StepTitle>
        <p className="text-body text-pretty text-muted">{demo ? "Four claims. Remedy pays only the genuine one." : how}</p>
      </div>


      {unverified && (
        <ErrorState
          variant="inline"
          title="This PayPal account isn't verified"
          description="PayPal only lets us refund verified accounts. Verify yours with PayPal (a confirmed email and a linked bank or card), then log in again."
        />
      )}
      {error && <ErrorState variant="inline" title={error.title} description={error.description} />}
      {refusal && <LimitNotice refusal={refusal} demo={Boolean(demo)} notice={notice} />}

      <div className="flex flex-col gap-4">
        {/* Before the button, so the copy buttons come first in reading and Tab order. */}
        {demo && !signedInAs && judgeLogin && <JudgeLoginPanel id={JUDGE_LOGIN_ID} login={judgeLogin} />}
        {demo && !signedInAs && !judgeLogin && <p className="text-ui text-muted">Log in with a PayPal demo account. Your own PayPal login won&apos;t work here.</p>}
        {/* Refused by a limit: nothing starts until it resets, so the button is the notice's next step instead. */}
        {refusal ? (
          <LimitNextStep demo={Boolean(demo)} notice={notice} />
        ) : (
          <Button id="consent-cta" href={href} size="lg" block prefetch={false}>
            {action}
          </Button>
        )}
        <p className="text-ui text-faint">{signedInAs ? `Logged in with PayPal as ${signedInAs}.` : "Remedy sees your PayPal name, email and account ID, never your password."}</p>
      </div>
    </Card>
  );
}

const CLAIM_STATUS: Record<Decision, (company: string) => string> = {
  held: (company) => `A person at ${company} will check your claim`,
  paid: () => "Your refund was paid",
  pending: () => "Your claim is open",
  rejected: () => "We couldn't pay your claim",
  blocked: () => "We couldn't pay your claim",
};

/** A claim already under way: its number, where it stands, and the way back to it. Nothing new starts here. */
function ClaimStatus({ claim, company, action }: { claim: YourClaim; company: string; action: string }) {
  const checking = claim.decision === "pending" && claim.photos > 0;
  const title = checking ? "Your photos are being checked" : CLAIM_STATUS[claim.decision](company.replace(/ /g, " "));
  const line =
    claim.decision === "held"
      ? `They decide by ${claim.decideBy}.`
      : claim.decision === "paid"
        ? `Paid on ${claim.paidOn}. This account's claim for this recall is done.`
        : checking
          ? "Your claim is saved. You can close this page."
          : claim.decision === "pending"
            ? "Your code is still running. Pick up where you left off."
            : "Each PayPal account can claim once per recall.";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <StepTitle id="consent-title" as="h2" className="text-pretty">
          {title}
        </StepTitle>
        <p className="text-body text-muted">
          {line} Claim <span className="font-mono whitespace-nowrap">{claim.id}</span>.
        </p>
      </div>
      <Button id="consent-cta" href={claim.href} size="lg" block prefetch={false}>
        {action}
      </Button>
    </div>
  );
}
