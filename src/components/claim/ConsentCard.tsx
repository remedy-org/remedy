import { Button, NoBreakHyphens } from "@/components/ui";
import type { JudgeLogin } from "@/lib/demo/judgeLogin";
import { sampleTitle } from "@/lib/demo/sampleCopy";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import type { Refusal } from "@/lib/limits";
import { CAPTURE_SESSION_MINUTES } from "@/lib/ids";
import type { Decision, Recall } from "@/lib/types";
import { StepTitle } from "./Exhibit";
import { JudgeLoginPanel } from "./JudgeLoginPanel";
import { LimitNextStep, LimitNotice } from "./LimitNotice";
import { companyName, cutInHalf, money, productNoun, taggedThing } from "./model";
import { Notice } from "./Notice";

export type AuthError = "denied" | "state" | "paypal" | "refused";

const AUTH_ERRORS: Record<AuthError, { title: string; description: string }> = {
  denied: { title: "The PayPal login was cancelled", description: "Remedy needs it to know which PayPal account to refund. Nothing was shared." },
  state: { title: "That login took too long", description: "The PayPal page was open for more than 10 minutes, or in another tab. Log in again." },
  paypal: { title: "PayPal didn’t answer", description: "Nothing was shared and no claim was started. Try again in a minute." },
  refused: { title: "PayPal wouldn’t share this account", description: "Nothing was shared and no claim was started. Log in with a different PayPal account, such as a personal one." },
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

/** What Remedy reads from a PayPal login, said once under every Log in with PayPal (here and on /signin). */
export const PAYPAL_CONSENT = "Remedy sees your PayPal name, email and account ID, never your password.";

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
  // How fast, in the real terms: an auto-paid claim pays the moment its checks pass (seconds after the photo).
  const how = `${cut ? `Cut the ${thing} in half` : `Destroy the ${thing} as the notice says`}, photograph it with the code we give you, and PayPal pays you ${recall.autoPay ? "in seconds" : `once ${company} approves it`}.`;
  // What the tap commits to: the code's clock starts on the next screen.
  const clock = `Your code is good for ${CAPTURE_SESSION_MINUTES} minutes, so ${cut ? `cut the ${thing} first` : `destroy the ${thing} first`}.`;
  // On the page, not in a box: the offer is the screen's headline, beside the recall it answers.
  const frame = "flex flex-col border-line max-lg:border-t max-lg:pt-8 lg:-ml-8 lg:self-stretch lg:border-l lg:pl-8";

  if (yourClaim) {
    return (
      <section aria-labelledby="consent-title" className={`${frame} gap-6`}>
        <ClaimStatus claim={yourClaim} company={company} action={action} />
        <p className="text-ui text-faint">{signedInAs ? `Logged in with PayPal as ${signedInAs}.` : "You log in on PayPal’s own page."}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="consent-title" className={`${frame} gap-7`}>
      <div className="flex flex-col gap-3">
        {/* The page's one headline: the brief beside it is the recall it answers, a step smaller. */}
        <StepTitle id="consent-title" className="text-pretty">
          <NoBreakHyphens>{demo ? "Try Remedy on a real recall" : `${money(recall.refund)} back for your ${productNoun(recall)}`}</NoBreakHyphens>
        </StepTitle>
        <p className="text-body text-pretty text-muted">
          {demo ? (
            <>
              Send four claims for the <NoBreakHyphens>{productNoun(recall)}</NoBreakHyphens>. Remedy pays the genuine one and stops the three that aren&rsquo;t.
            </>
          ) : (
            how
          )}
        </p>
      </div>

      {/* /try: the four claims about to be sent, so the page reads as the product, not a login form. A preview under its
          own label, not a menu: no ring or hover on the photos, the names in the second tone. They are picked after the
          login. */}
      {demo && !signedInAs && (
        <div className="flex flex-col gap-3">
          <p id="four-claims" className="text-ui text-muted">
            The four claims you&rsquo;ll send
          </p>
          <ul aria-labelledby="four-claims" className="grid grid-cols-2 gap-x-4 gap-y-3">
            {DEMO_SAMPLES.map((sample) => (
              <li key={sample.id} className="flex min-w-0 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sample.photos[0]} alt="" width={56} height={56} className="size-14 shrink-0 rounded-control bg-surface-2 object-cover object-[50%_65%]" />
                <span className="text-ui text-balance text-muted">{sampleTitle(sample.id, sample.title)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unverified && (
        <Notice title="This PayPal account isn’t verified">PayPal only lets us refund verified accounts. Verify yours with PayPal (a confirmed email and a linked bank or card), then log in again.</Notice>
      )}
      {error && <Notice title={error.title}>{error.description}</Notice>}
      {refusal && <LimitNotice refusal={refusal} demo={Boolean(demo)} notice={notice} />}

      <div className="flex flex-col gap-4">
        {/* Before the button, so the copy buttons come first in reading and Tab order. */}
        {demo && !signedInAs && judgeLogin && <JudgeLoginPanel id={JUDGE_LOGIN_ID} login={judgeLogin} />}
        {demo && !signedInAs && !judgeLogin && <p className="text-ui text-muted">Log in with a PayPal demo account. Your own PayPal login won&rsquo;t work here.</p>}
        {/* Refused by a limit: nothing starts until it resets, so the button is the notice's next step instead. */}
        {refusal ? (
          <LimitNextStep demo={Boolean(demo)} notice={notice} />
        ) : (
          <Button id="consent-cta" href={href} size="lg" block prefetch={false}>
            {action}
          </Button>
        )}
        {!demo && !refusal && !unverified && <p className="-mt-1 text-ui text-pretty text-muted">{clock}</p>}
        <p className="text-ui text-faint">{signedInAs ? `Logged in with PayPal as ${signedInAs}.` : PAYPAL_CONSENT}</p>
      </div>
    </section>
  );
}

const CLAIM_STATUS: Record<Decision, (company: string) => string> = {
  held: (company) => `A person at ${company} will check your claim`,
  paid: () => "Your refund was paid",
  pending: () => "Your claim is open",
  rejected: () => "We couldn’t pay your claim",
  blocked: () => "We couldn’t pay your claim",
};

/** A claim already under way: its number, where it stands, and the way back to it. Nothing new starts here. */
function ClaimStatus({ claim, company, action }: { claim: YourClaim; company: string; action: string }) {
  const checking = claim.decision === "pending" && claim.photos > 0;
  const title = checking ? "Your photos are being checked" : CLAIM_STATUS[claim.decision](company.replace(/ /g, " "));
  const line =
    claim.decision === "held"
      ? `They decide by ${claim.decideBy}.`
      : claim.decision === "paid"
        ? `Paid on ${claim.paidOn}. This account’s claim for this recall is done.`
        : checking
          ? "Your claim is saved. You can close this page."
          : claim.decision === "pending"
            ? "Your code is still running. Pick up where you left off."
            : "Each PayPal account can claim once per recall.";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <StepTitle id="consent-title" className="text-pretty">
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
