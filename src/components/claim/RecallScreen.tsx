import "server-only";
import { isSandboxBuild } from "@/lib/demo";
import { parseRefusal } from "@/lib/limits";
import { getSession, loginPath } from "@/lib/session";
import type { Recall } from "@/lib/types";
import { consentAction, ConsentCard, type AuthError, type ConsentCardProps } from "./ConsentCard";
import { FlowShell } from "./FlowShell";
import { WithJudges } from "./Judges";
import { MobileCta } from "./MobileCta";
import { companyName, maskPayer } from "./model";
import { RecallBrief } from "./RecallBrief";
import { DEMO_STEPS, REAL_STEPS, StepMeter } from "./StepMeter";

const AUTH_ERRORS = new Set<AuthError>(["denied", "state", "paypal", "refused"]);

/** Step 1: what was recalled and why, and the consent to log in with PayPal. Real and demo share it. */
export async function RecallScreen({ recall, demo, query }: { recall: Recall; demo: boolean; query: Record<string, string | string[] | undefined> }) {
  const session = await getSession("owner");
  const next = demo ? `/r/${recall.slug}/try/samples` : `/api/claims/start?recall=${recall.slug}`;
  const unverified = !demo && (query.account === "unverified" || (session !== null && !session.verified));
  const authError = typeof query.auth_error === "string" && AUTH_ERRORS.has(query.auth_error as AuthError) ? (query.auth_error as AuthError) : null;
  return (
    <RecallView
      recall={recall}
      demo={demo}
      href={session && !unverified ? next : loginPath("owner", next)}
      signedInAs={session ? (session.name ?? maskPayer(session.payerId)) : null}
      authError={authError}
      unverified={unverified}
      refusal={parseRefusal(query, new Date())}
      sandbox={isSandboxBuild()}
    />
  );
}

/**
 * The recall screen's layout: the step meter in the same place as on every step, then the brief beside the consent card
 * on a laptop, stacked on a phone. Logged in (and verified, for a real claim), the PayPal step is done and the judges'
 * rail moves on to the samples.
 */
export function RecallView({ sandbox, ...props }: ConsentCardProps & { sandbox?: boolean }) {
  const ready = Boolean(props.signedInAs) && !props.unverified;
  return (
    <FlowShell demo={props.demo} sandbox={sandbox} company={companyName(props.recall)}>
      <WithJudges demo={Boolean(props.demo)} step={ready ? "samples" : "consent"}>
        <div className="flex flex-col gap-6">
          <StepMeter current={ready ? 2 : 1} steps={props.demo ? DEMO_STEPS : REAL_STEPS} />
          <div className="grid gap-6 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_30rem] lg:gap-16">
            <RecallBrief recall={props.recall} sandbox={sandbox || props.demo} demo={props.demo} />
            <ConsentCard {...props} />
          </div>
        </div>
      </WithJudges>
      <MobileCta target="consent-cta" href={props.href} label={consentAction(props)} />
    </FlowShell>
  );
}
