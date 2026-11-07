import "server-only";
import { claimPath, findOpenClaim } from "@/app/api/claims/_lib/pipeline";
import { getAppStore, isSandboxBuild } from "@/lib/demo";
import { judgeLogin } from "@/lib/demo/judgeLogin";
import { claimRefusal, limits, parseRefusal } from "@/lib/limits";
import { getSession, loginPath } from "@/lib/session";
import type { Claim, Recall } from "@/lib/types";
import { consentAction, ConsentCard, JUDGE_LOGIN_ID, SampleList, type AuthError, type ConsentCardProps, type YourClaim } from "./ConsentCard";
import { FlowShell } from "./FlowShell";
import { WithJudges } from "./Judges";
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
      sandbox={isSandboxBuild()}
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
 * on a laptop, stacked on a phone. Logged in (and verified, for a real claim), the PayPal step is done and the judges'
 * rail moves on to the samples.
 */
export function RecallView({ sandbox, ...props }: ConsentCardProps & { sandbox?: boolean }) {
  const ready = Boolean(props.signedInAs) && !props.unverified;
  const claim = props.yourClaim;
  return (
    <FlowShell demo={props.demo} sandbox={sandbox} company={companyName(props.recall)}>
      {/* The judges' sandbox login is in the card, just before its login button, at every width; from 1200px the four
          samples move to the rail to keep that button on a laptop's first screen (below, the card has them, so the notes'
          sheet doesn't repeat them). */}
      <WithJudges demo={Boolean(props.demo)} step={ready ? "samples" : "consent"} extra={props.demo ? <SampleList rail className="border-t border-line pt-4 max-[1199px]:hidden" /> : undefined}>
        <div className="flex flex-col gap-6">
          {/* Refused by a limit, the code step isn't next: the meter stays on the first step. It spans both columns, so
              its edges sit on theirs. */}
          <StepMeter {...(claim ? claimMeter(claim) : { current: ready && !props.refusal ? 2 : 1 })} steps={props.demo ? DEMO_STEPS : REAL_STEPS} span />
          {/* One bounded track on a phone, so the card's widest line can never widen the page. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_30rem] lg:gap-16">
            <RecallBrief recall={props.recall} sandbox={sandbox || props.demo} demo={props.demo} />
            <ConsentCard {...props} sandbox={sandbox} />
          </div>
        </div>
      </WithJudges>
      {/* Refused by a limit, there's nothing to tap until it resets: the notice in the card says when. On the demo, the
          judges' sandbox login sits under the four samples on a phone: the bar's first tap brings it up, so nobody reaches
          PayPal's page without the login it asks for. */}
      {!(props.refusal && !claim) && (
        <MobileCta
          target="consent-cta"
          href={claim?.href ?? props.href}
          label={consentAction(props)}
          first={props.demo && !props.signedInAs && props.judgeLogin && !claim ? { target: JUDGE_LOGIN_ID, label: "Show the sandbox login" } : undefined}
        />
      )}
    </FlowShell>
  );
}
