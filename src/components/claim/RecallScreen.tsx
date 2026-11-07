import "server-only";
import { parseRefusal } from "@/lib/limits";
import { getSession, loginPath } from "@/lib/session";
import type { Recall } from "@/lib/types";
import { ConsentCard, type AuthError, type ConsentCardProps } from "./ConsentCard";
import { FlowShell } from "./FlowShell";
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
    />
  );
}

/** The recall screen's layout: the brief beside the consent card on a laptop, stacked on a phone. */
export function RecallView(props: ConsentCardProps) {
  return (
    <FlowShell wide demo={props.demo} company={companyName(props.recall)}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_30rem] lg:gap-20">
        <RecallBrief recall={props.recall} />
        <div className="flex flex-col gap-6">
          <StepMeter current={1} steps={props.demo ? DEMO_STEPS : REAL_STEPS} />
          <ConsentCard {...props} />
        </div>
      </div>
    </FlowShell>
  );
}
