import "server-only";
import { claimPath, findOpenClaim } from "@/app/api/claims/_lib/pipeline";
import { askedSample, getAppStore, sampleLinkName, type DemoSampleId } from "@/lib/demo";
import { judgeLogin } from "@/lib/demo/judgeLogin";
import { claimRefusal, limits, parseRefusal } from "@/lib/limits";
import { getSession, loginPath } from "@/lib/session";
import type { Claim, Recall } from "@/lib/types";
import { consentAction, ConsentCard, JUDGE_LOGIN_ID, type AuthError, type ConsentCardProps, type YourClaim } from "./ConsentCard";
import { ClaimFrame, STEP_GRID } from "./Exhibit";
import { FlowShell, recallContext } from "./FlowShell";
import { MobileCta } from "./MobileCta";
import { businessDaysAfter, day, maskPayer } from "./model";
import { RecallBrief } from "./RecallBrief";

const AUTH_ERRORS = new Set<AuthError>(["denied", "state", "paypal", "refused"]);

/** /try?claim=web-photo (the homepage's "Try to fool it"): the page says the attempt it was opened for. The web photo
 * is stopped by the first check, Taken in Remedy's camera, one of the three that run before any AI. */
const ATTEMPTS: Partial<Record<DemoSampleId, { title: string; lede: string }>> = {
  "ai-no-session": { title: "Try to fool it: send a photo from the web", lede: "Remedy refuses it at the first check, before any AI sees the photo." },
};

/** Step 1: what was recalled and why, and the consent to log in with PayPal. Real and demo share it. */
export async function RecallScreen({ recall, demo, query }: { recall: Recall; demo: boolean; query: Record<string, string | string[] | undefined> }) {
  const session = await getSession("owner");
  // /try?claim=<name> (the homepage's "Try to fool it"; ?sample=<id> too): the picker opens on that claim once PayPal returns.
  const sample = demo ? askedSample(query) : null;
  const next = demo ? `/r/${recall.slug}/try/samples${sample ? `?claim=${sampleLinkName(sample)}` : ""}` : `/api/claims/start?recall=${recall.slug}`;
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
      sample={sample}
      heading={sample ? ATTEMPTS[sample] : null}
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

/**
 * The recall screen's layout: the brief beside the consent on a laptop, stacked on a phone, on the same 960px frame as
 * every step after it.
 */
export function RecallView(props: ConsentCardProps) {
  const claim = props.yourClaim;
  return (
    // The header names the recall here too, as on every step after it (and on /try), so the bar never changes under the owner.
    <FlowShell context={recallContext(props.recall)}>
      <ClaimFrame>
        {/* One bounded track on a phone, so the card's widest line can never widen the page. */}
        <div className={STEP_GRID}>
          {/* The offer is the page's h1; the recall it answers is the brief's h2. */}
          <RecallBrief recall={props.recall} heading="h2" />
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
