import "server-only";
import { claimPath, findOpenClaim } from "@/app/api/claims/_lib/pipeline";
import { getAppStore } from "@/lib/demo";
import { judgeLogin } from "@/lib/demo/judgeLogin";
import { claimRefusal, limits, parseRefusal } from "@/lib/limits";
import { getSession, loginPath } from "@/lib/session";
import type { Claim, Recall } from "@/lib/types";
import { consentAction, ConsentCard, JUDGE_LOGIN_ID, type AuthError, type ConsentCardProps, type YourClaim } from "./ConsentCard";
import { ClaimFrame, STEP_GRID } from "./Exhibit";
import { FlowShell } from "./FlowShell";
import { MobileCta } from "./MobileCta";
import { businessDaysAfter, companyName, day, maskPayer } from "./model";
import { RecallBrief } from "./RecallBrief";
import { DEMO_STEPS, REAL_STEPS, resultMeter, StepMeter, type StepMeterProps } from "./StepMeter";

const AUTH_ERRORS = new Set<AuthError>(["denied", "state", "paypal", "refused"]);

/** Step 1: what was recalled and why, and the consent to log in with PayPal. Real and demo share it. */
export async function RecallScreen({ recall, demo, query }: { recall: Recall; demo: boolean; query: Record<string, string | string[] | undefined> }) {
  const session = await getSession("owner");
  const next = demo ? `/r/${recall.slug}/try/samples` : `/api/claims/start?recall=${recall.slug}`;
  const unverified = !demo && (query.account === "unverified" || (session !== null && !session.verified));
  const authError = typeof query.auth_error === "string" && AUTH_ERRORS.has(query.auth_error as AuthError) ? (query.auth_error as AuthError) : null;
  // Back from the recall notice with a claim already paid, held, being checked or holding a live code: the same one
  // /api/claims/start would continue, so the screen leads with it instead of offering to start again.
  const now = new Date();
  const store = session && !demo ? await getAppStore() : null;
  const rows = store ? await store.listClaims() : null;
  const open = session && store && rows ? await findOpenClaim({ store, now: () => now }, recall, session.payerId, rows) : null;
  // A start the claim limits would refuse is never offered: the notice and the muted button show before the tap, from
  // the same index.json read. /api/claims/start still counts on its own write, and redirects here with ?limit= if a
  // start in between filled the day.
  const refused = session && rows && !open && !unverified ? claimRefusal(rows, { payerId: session.payerId, demo: false, now, limits: limits() }) : null;
  return (
    <RecallView
      recall={recall}
      demo={demo}
      yourClaim={open ? yourClaim(recall, open) : null}
      href={session && !unverified ? next : loginPath("owner", next)}
      signedInAs={session ? (session.name ?? maskPayer(session.payerId)) : null}
      authError={authError}
      unverified={unverified}
      refusal={parseRefusal(query, now) ?? refused}
      judgeLogin={demo ? judgeLogin("personal") : null}
    />
  );
}

function yourClaim(recall: Recall, claim: Claim): YourClaim {
  const at = (type: string) => claim.events.find((e) => e.type === type)?.at;
  return {
    id: claim.id,
    href: claimPath(recall.slug, claim),
    decision: claim.decision,
    photos: claim.photos.length,
    // As the held result says it: two business days from the photos.
    decideBy: claim.decision === "held" ? businessDaysAfter(at("photos_received") ?? claim.createdAt, 2) : undefined,
    paidOn: claim.decision === "paid" ? day(at("payout_sent") ?? claim.payout?.updatedAt ?? claim.createdAt) : undefined,
  };
}

/** Where the landing's meter stands for a claim already under way. */
function claimMeter(c: YourClaim): Pick<StepMeterProps, "current" | "outcome"> {
  if (c.decision !== "pending") return resultMeter(c.decision, REAL_STEPS);
  return { current: c.photos > 0 ? 4 : 2 };
}

/**
 * The recall screen's layout: the step meter in the same place as on every step, then the brief beside the consent card
 * on a laptop, stacked on a phone. Logged in (and verified, for a real claim), the PayPal step is done and the next one
 * waits until it opens.
 */
export function RecallView(props: ConsentCardProps) {
  const ready = Boolean(props.signedInAs) && !props.unverified;
  const claim = props.yourClaim;
  return (
    <FlowShell>
      <ClaimFrame>
        {/* Refused by a limit, the next step isn't open: the meter stays on the first step. */}
        <StepMeter {...(claim ? claimMeter(claim) : ready && !props.refusal ? { current: 2, upcoming: true } : { current: 1 })} steps={props.demo ? DEMO_STEPS : REAL_STEPS} />
        {/* One bounded track on a phone, so the card's widest line can never widen the page. */}
        <div className={STEP_GRID}>
          <RecallBrief recall={props.recall} />
          <ConsentCard {...props} />
        </div>
      </ClaimFrame>
      {/* Refused by a limit, there's nothing to tap until it resets: the notice in the card says when. On /try, the bar's
          first tap brings the demo account into view, so nobody reaches PayPal's page without the login it asks for. */}
      {!(props.refusal && !claim) && (
        <MobileCta
          target="consent-cta"
          href={claim?.href ?? props.href}
          label={consentAction(props)}
          first={props.demo && !props.signedInAs && props.judgeLogin && !claim ? { target: JUDGE_LOGIN_ID, label: "Show the demo account" } : undefined}
        />
      )}
    </FlowShell>
  );
}
