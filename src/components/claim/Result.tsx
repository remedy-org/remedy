import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { Button, CheckIcon, CrossIcon, Money, NoBreakHyphens, Paper, Stamp, StatusPill, statusLabel } from "@/components/ui";
import { canAskForReview, reviewAsked } from "@/lib/appeal";
import type { DemoSample } from "@/lib/demo";
import type { Claim, Recall } from "@/lib/types";
import { CheckList } from "./CheckList";
import { EvidenceText, ModelQuote } from "./EvidenceText";
import { ExhibitPhoto, SampleChip, StepTitle } from "./Exhibit";
import styles from "./flow.module.css";
import { FocusTitle } from "./FocusTitle";
import { WithJudges } from "./Judges";
import { LocalTime } from "./LocalTime";
import {
  adviceFor,
  businessDaysAfter,
  canRetry,
  codeDiff,
  misreadOf,
  companyName,
  decidingReasons,
  maskPayer,
  money,
  noModelAnswer,
  readableReasons,
  refusalHeadline,
  secondsBetween,
  type CheckRow,
} from "./model";
import { ReceiptLive } from "./ReceiptLive";
import { RevealDetails } from "./RevealDetails";
import { nextSample, roundLine, runMark, Scoreboard, type RoundRun } from "./Scoreboard";

export interface PayoutLive {
  /** PayPal's status: live from getPayoutStatus, or the last one stored if PayPal couldn't be reached. */
  status: string | null;
  /** false: PayPal didn't answer just now; the status shown is the stored one. */
  fresh: boolean;
  /** The receipt keeps asking (a payout sent in the last 10 minutes that hasn't settled). */
  live?: boolean;
}

/** A refused repost: which of this claim's photos it was, and the earlier claim that has it (null: another account's). */
export interface Duplicate {
  /** This claim's photo (1-based), as the camera numbered it. */
  photo: number;
  /** The earlier claim and its matching photo (n, 1-based, as its camera numbered it). */
  earlier: { id: string; src: string; n: number } | null;
}

/** A demo claim's place in this browser's demo round: what ran, and what to run next. */
export interface DemoRound {
  runs: RoundRun[];
}

export interface ResultProps {
  claim: Pick<Claim, "id" | "decision" | "reasons" | "payout" | "events" | "payerId" | "payerVerified" | "createdAt" | "code" | "verdict" | "photos" | "demo" | "seeded">;
  recall: Recall;
  rows: CheckRow[];
  photoUrls: string[];
  payout?: PayoutLive;
  /** Starts over: a new real claim, or the demo's sample picker. */
  againHref: string;
  sample?: DemoSample | null;
  /** Demo: this round's runs, for the scoreboard and "Next sample". */
  round?: DemoRound | null;
  /** A refused repost's earlier claim, for the side by side. */
  duplicate?: Duplicate | null;
  /** The server's clock at render (ms): the receipt prints only for a claim decided under a minute ago. */
  now?: number;
  /** The step meter, above the result. */
  meter?: ReactNode;
  /** Payouts go to PayPal's sandbox in this build: every amount is labelled sandbox money, sample or not. */
  sandbox?: boolean;
  /** The PayPal login the owner recognises, masked ("p••@owner.test"); the receipt falls back to the payer ID's tail. */
  account?: string | null;
}

// The judges' rail on a result, one note per outcome: what the rule did with this claim and whether money moved.
const RESULT_NOTES: Partial<Record<Claim["decision"], string>> = {
  paid: "Every check passed, so the rule paid it: PayPal Payouts sent the refund in sandbox money.",
  held: "The rule held it for a person at the company. No payout is sent unless they approve it.",
  rejected: "The rule refused it on the model's quoted reading. No payout was attempted.",
  blocked: "A check with no AI stopped it before the model saw the photo. No payout was attempted.",
};
// A hold because the model never answered: the designed fallback, not the rule's verdict on the photo.
const UNANSWERED_NOTE =
  "The photo model didn't respond, so Remedy's safe fallback held it for a person instead of guessing. That's the designed outcome when the model is down: nothing is paid without its answer. Run it again for the model's answer.";

/** The end of a claim, as a paper object: a receipt when paid; a sheet with the evidence when held or refused. */
export function Result(props: ResultProps) {
  const { sample } = props;
  const body = props.claim.decision === "paid" ? <Paid {...props} /> : props.claim.decision === "held" ? <Held {...props} /> : <Refused {...props} />;
  const unanswered = noModelAnswer(props.claim.decision, props.claim.reasons);
  return (
    <WithJudges
      demo={Boolean(sample)}
      step="result"
      note={unanswered ? UNANSWERED_NOTE : RESULT_NOTES[props.claim.decision]}
      extra={
        sample && (
          <JudgeVerdict sample={sample} run={{ sample: sample.id, decision: props.claim.decision, unanswered }} round={props.round} claimId={props.claim.id} slug={props.recall.slug} againHref={props.againHref} />
        )
      }
    >
      <FocusTitle id="result-title" />
      {props.meter && <div className="mb-6">{props.meter}</div>}
      {body}
    </WithJudges>
  );
}

/* ------------------------------------------------------------------------------------------------ Paid */

function Paid({ claim, recall, rows, photoUrls, payout, againHref, sample, round, now, sandbox, account }: ResultProps) {
  const sb = Boolean(sample) || Boolean(sandbox);
  const amount = claim.payout?.amount ?? recall.refund;
  const sentAt = claim.events.find((e) => e.type === "payout_sent")?.at ?? claim.payout?.updatedAt;
  const decidedAt = claim.events.find((e) => e.type === "decided")?.at;
  const took = secondsBetween(claim.events, "photos_received", "payout_sent");
  // The one arrival moment: it prints only when it's news. A reload, or a later visit, shows it at rest.
  const arrive = Boolean(now && decidedAt && now - Date.parse(decidedAt) < 60_000);
  const company = companyName(recall);
  return (
    <section aria-labelledby="result-title" className="mx-auto flex w-full max-w-claim flex-col gap-8">
      <h2 id="result-title" tabIndex={-1} className="sr-only">
        Refund receipt: {money(amount)} paid{sb ? " in PayPal sandbox money" : ""}
      </h2>
      <Paper variant="receipt" perforated padding="lg" className={clsx(arrive && styles.print)}>
        <div className="flex items-baseline justify-between gap-4 font-mono text-micro tracking-[0.06em] text-ink-muted uppercase">
          <span>Refund receipt</span>
          <span>Claim {claim.id}</span>
        </div>

        <div className="relative mt-8 flex flex-col gap-4">
          <span className="flex size-10 items-center justify-center rounded-full bg-pay-ink" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 10.5l3.25 3.25L15 7"
                stroke="oklch(1 0 0)"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                className={styles.draw}
                style={{ "--draw-delay": arrive ? "420ms" : "0ms" } as CSSProperties}
              />
            </svg>
          </span>
          <Money value={Number(amount.value)} currency={amount.currency} size="amount" className="text-ink" />
          <p className="text-body text-ink-muted">
            Refunded to your PayPal account through Remedy for {company}
            {sb ? ", in PayPal sandbox money" : ""}.
          </p>
          {took !== null && (
            <span className="inline-flex h-7 items-center self-start rounded-control bg-paper-2 px-2.5 font-mono text-ui text-ink tabular-nums">
              Paid {took}s after your photo
            </span>
          )}
          <span className="absolute top-1 right-0">
            <Stamp tone="pay" land={arrive ? 1060 : undefined}>
              {sb ? "Paid · sandbox" : "Paid"}
            </Stamp>
          </span>
        </div>

        <dl className="mt-8 border-t border-dashed border-paper-line">
          <ReceiptLive
            claimId={claim.id}
            status={payout?.status ?? claim.payout?.status ?? null}
            live={Boolean(payout?.live)}
            amount={money(amount)}
            sandbox={sb}
          />
          {sentAt && (
            <ReceiptRow label="Sent">
              <LocalTime iso={sentAt} format="stamp" />
            </ReceiptRow>
          )}
          {/* The PayPal login the owner knows, masked; without one, the payer ID's tail, with "Verified" in the label so the
              ID never wraps on a narrow receipt. */}
          {account ? (
            <ReceiptRow label="Paid to">{account}</ReceiptRow>
          ) : (
            <ReceiptRow label={claim.payerVerified ? "Verified PayPal account" : "PayPal account"} mono>
              {maskPayer(claim.payerId)}
            </ReceiptRow>
          )}
          {claim.payout && (
            <ReceiptRow label="PayPal reference" mono>
              {claim.payout.batchId}
            </ReceiptRow>
          )}
          <ReceiptRow label="Recall">CPSC {recall.id}</ReceiptRow>
        </dl>
        {payout && !payout.fresh && <p className="mt-3 text-ui text-ink-muted">PayPal didn&apos;t answer just now, so this is the last status we saved.</p>}
        {!sb && <p className="mt-3 text-ui text-ink-muted">PayPal emails you a receipt too.</p>}
      </Paper>

      {sample && <DemoActions sample={sample} slug={recall.slug} againHref={againHref} claimId={claim.id} decision={claim.decision} round={round} />}
      <Evidence rows={rows} photoUrls={photoUrls} sample={Boolean(sample)} summary={passedSummary(rows)} open={false} code={claim.code} />
    </section>
  );
}

function ReceiptRow({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-paper-line py-3 text-ui last:border-b-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className={clsx("min-w-0 text-right text-ink [overflow-wrap:anywhere]", mono && "font-mono")}>{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ Held */

function Held({ claim, recall, rows, photoUrls, againHref, sample, round, sandbox }: ResultProps) {
  const sb = Boolean(sample) || Boolean(sandbox);
  const reasons = decidingReasons(claim);
  const submitted = claim.events.find((e) => e.type === "photos_received")?.at ?? claim.createdAt;
  const checked = claim.events.find((e) => e.type === "decided")?.at ?? claim.events.find((e) => e.type === "checked")?.at;
  const company = companyName(recall);
  // The owner asked a person to look at a claim the rule refused: this sheet is the confirmation.
  const asked = reviewAsked(claim) ? (claim.events.find((e) => e.type === "review_requested")?.at ?? submitted) : null;
  return (
    <section aria-labelledby="result-title" className="mx-auto flex w-full max-w-claim flex-col gap-6">
      <Top status={<StatusPill status="held" label={sb ? "Held · sandbox" : "Held"} />} id={claim.id} />
      <StepTitle id="result-title">A person at {company.replace(/ /g, "\u00a0")} will look at this</StepTitle>

      <Paper variant="sheet" padding="lg">
        {/* The stamp in the header row with the ID, as on the refused sheet, so it never crowds the ID or the text under it. */}
        <div className="flex items-start justify-between gap-4">
          <p className="pt-1 font-mono text-micro tracking-[0.06em] whitespace-nowrap text-ink-muted uppercase">Claim {claim.id}</p>
          <Stamp tone="hold" land={0}>
            Held for review
          </Stamp>
        </div>
        <p className="mt-6 text-body font-medium text-ink">{asked ? "You asked for a review." : "Nothing is lost."}</p>
        <p className="mt-1 max-w-[34ch] text-body text-ink-muted">
          {asked ? `A person at ${company} will look at your photos themselves. ` : "Your claim is saved. "}
          If {company} approves it, {money(recall.refund)} goes to your PayPal account{sb ? " in sandbox money" : " and PayPal emails you"}.
          {asked ? " If they refuse it, their reason shows here." : ""}
        </p>
        <p className="mt-3 max-w-[34ch] text-ui text-ink-muted">The decision shows on this page, so keep its link or bookmark it to check back.</p>

        <ol aria-label="What happens next" className="relative mt-6 flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[3.5px] before:w-px before:bg-paper-line">
          <TimelineRow state="done" label="Photos received" time={submitted} />
          {checked && <TimelineRow state="done" label={asked ? "Refused by the rule" : "Checks run"} time={checked} />}
          {asked && <TimelineRow state="done" label="You asked for a review" time={asked} />}
          <TimelineRow state="now" label="Waiting for a person" />
          <TimelineRow state="next" label={`Decision by ${businessDaysAfter(asked ?? submitted, 2)}`} />
        </ol>

        {reasons.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 border-t border-dashed border-paper-line pt-4">
            <h3 className="font-mono text-micro tracking-[0.06em] text-ink-muted uppercase">{asked ? "What the photo check said" : "What they'll look at"}</h3>
            <Reasons reasons={reasons} rows={rows} summary={claim.verdict?.summary} />
            {asked && <p className="text-ui text-ink-muted">This answer stays on record. The person decides from your photos.</p>}
          </div>
        )}

        <dl className="mt-6 border-t border-dashed border-paper-line">
          <ReceiptRow label="Refund if approved">
            {money(recall.refund)}
            {sb ? " sandbox" : ""}
          </ReceiptRow>
          <ReceiptRow label="Photos sent">
            <LocalTime iso={submitted} format="stamp" />
          </ReceiptRow>
          <ReceiptRow label="Your code" mono>
            {claim.code}
          </ReceiptRow>
        </dl>
      </Paper>

      {sample && (
        <DemoActions sample={sample} slug={recall.slug} againHref={againHref} claimId={claim.id} decision={claim.decision} round={round} unanswered={noModelAnswer(claim.decision, claim.reasons)} />
      )}
      <Evidence rows={rows} photoUrls={photoUrls} sample={Boolean(sample)} summary={`Every check, and the ${photoUrls.length === 1 ? "photo" : "photos"} you sent`} open={Boolean(sample)} code={claim.code} />
    </section>
  );
}

/** `time`: an ISO time, shown to the minute in the viewer's zone. */
function TimelineRow({ state, label, time }: { state: "done" | "now" | "next"; label: string; time?: string }) {
  return (
    <li className="relative grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center text-ui">
      <span
        aria-hidden="true"
        className={clsx("relative size-2 rounded-full", state === "done" ? "bg-pay-ink" : state === "now" ? clsx("bg-hold-ink text-hold-ink", styles.pulse) : "border border-ink-muted bg-paper")}
      />
      <span className={state === "next" ? "font-medium text-ink" : state === "now" ? "text-ink" : "text-ink-muted"}>{label}</span>
      {time && (
        <span className="pl-3 font-mono text-micro text-ink-muted tabular-nums">
          <LocalTime iso={time} format="clock" />
        </span>
      )}
    </li>
  );
}

// Checks the model answers yes/no/unclear without its own evidence line: its one-line summary is the words it gave.
const SUMMARY_CHECKS = new Set(["same_item", "screen"]);

/**
 * The reasons that decided it, numbered, each with the model's own words where it gave them (its summary for the checks
 * it answers without evidence). On paper.
 */
function Reasons({ reasons, rows, summary }: { reasons: Claim["reasons"]; rows: CheckRow[]; summary?: string }) {
  return (
    <ol className="flex flex-col gap-3">
      {reasons.map((r, i) => {
        const quote = rows.find((row) => row.id === r.check)?.quote ?? (summary && SUMMARY_CHECKS.has(r.check) ? summary : undefined);
        return (
          <li key={`${r.check}-${i}`} className="grid grid-cols-[2rem_minmax(0,1fr)] text-ui">
            <span className="font-mono text-micro leading-[1.45rem] text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex flex-col gap-1.5">
              <span className="text-ink">
                <EvidenceText>{r.text}</EvidenceText>
              </span>
              {quote && (
                <span className="border-l border-paper-line pl-3 text-ui leading-[1.55] text-ink-muted">
                  &ldquo;<ModelQuote>{quote}</ModelQuote>&rdquo;
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------------------------------------- Refused */

function Refused({ claim, recall, rows, photoUrls, againHref, sample, round, duplicate }: ResultProps) {
  const blocked = claim.decision === "blocked";
  const reasons = readableReasons(decidingReasons(claim), claim.photos.length);
  const retry = canRetry(reasons);
  const company = companyName(recall);
  const lead = reasons[0]?.check;
  const reviewed = lead === "review";
  const asked = reviewAsked(claim);
  // The model wasn't sure of what it read: the owner may ask a person to look, once (src/lib/appeal.ts).
  const appeal = !sample && canAskForReview(claim);
  // When starting over can't help (a second claim from one account), only that reason's advice applies: advice to
  // start a new claim would lead to the same refusal.
  const advice = reviewed ? [] : [...new Set((retry ? reasons : reasons.filter((r) => !canRetry([r]))).map((r) => adviceFor(r.check)))];
  const one = photoUrls.length === 1;
  // A misread the owner can contest: say what was read against what they wrote, not that their code is wrong.
  const misread = appeal && lead === "code" ? misreadOf(claim.code, claim.verdict?.challenge_code.text_seen) : null;
  const headline = reviewed ? `A person at ${company} looked at this and refused it` : (misread?.headline ?? refusalHeadline(claim, recall.spec));
  // Each PayPal account claims once per recall: the way forward is the claim that counts (same account, so it's theirs).
  const earlier = !sample ? /\((RM-\d+)\)/.exec(reasons.find((r) => r.check === "payer")?.text ?? "")?.[1] : undefined;
  const steps = appeal
    ? [
        misread?.ask ?? "If your photo does show what's asked, ask a person to look. They decide from your photos, and you can ask once.",
        `Or start a new claim for a new code, and ${lead === "code" ? "write it large and clear, in marker" : "take new photos"}.`,
      ]
    : advice;
  return (
    <section aria-labelledby="result-title" className="mx-auto flex w-full max-w-claim flex-col gap-6">
      <Top status={<StatusPill status={blocked ? "blocked" : "rejected"} />} id={claim.id} />
      <div className="flex flex-col gap-3">
        <StepTitle id="result-title">{headline}</StepTitle>
        <p className="text-body text-muted">
          {blocked
            ? "Some claims are refused before any photo reaches the model. No refund was sent."
            : appeal
              ? "The photo check wasn't sure of what it read, so this may be a misread. No refund was sent."
              : reviewed
              ? `${asked ? "You asked for a review, and a person" : "Your claim was held for a person, who"} refused it for the reason below. No refund was sent.`
              : `The photo check read your ${one ? "photo" : "photos"} and one of its answers rules the claim out. No refund was sent.`}
        </p>
      </div>

      {lead === "code" && <CodeDiff code={claim.code} seen={claim.verdict?.challenge_code.text_seen} />}
      {lead === "session" && <Provenance claim={claim} />}
      {lead === "duplicate_photo" && photoUrls[0] && <DuplicatePair claimId={claim.id} photoUrls={photoUrls} duplicate={duplicate ?? null} sample={Boolean(sample)} />}

      <Paper variant="sheet" padding="lg">
        <div className="flex items-start justify-between gap-4">
          <p className="font-mono text-micro tracking-[0.06em] whitespace-nowrap text-ink-muted uppercase">Verdict · {claim.id}</p>
          <Stamp tone="neutral" land={0}>
            Not paid
          </Stamp>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          {photoUrls[0] && lead !== "duplicate_photo" && (
            <ExhibitPhoto src={photoUrls[0]} alt={`Photo 1: the ${sample ? "sample" : "first"} photo of claim ${claim.id}`} sample={false} frame="aspect-[3/4]" className="w-32 self-start sm:w-auto" />
          )}
          <div className={clsx("flex min-w-0 flex-col gap-3", (lead === "duplicate_photo" || !photoUrls[0]) && "sm:col-span-2")}>
            <h3 className="font-mono text-micro tracking-[0.06em] text-ink-muted uppercase">{reasons.length > 1 ? "The reasons" : "The reason"}</h3>
            <Reasons reasons={reasons} rows={rows} />
            {/* Every sample photo is AI-made, the paid one too: the live-camera refusal is about how it was sent. */}
            {sample && photoUrls[0] && lead !== "duplicate_photo" && (
              <p className="text-ui text-ink-muted">{lead === "session" ? "Photo 1 is an AI-made sample like all four; only this one was sent from outside the camera." : "Photo 1 is an AI-made sample photo."}</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-1.5 border-t border-dashed border-paper-line pt-4">
          <h3 className="font-mono text-micro tracking-[0.06em] text-ink-muted uppercase">How this was decided</h3>
          <p className="text-ui text-ink">
            {reviewed
              ? asked
                ? `The rule refused this claim, you asked for a review, and a person at ${company} refused it too.`
                : `The photo check held this claim for a person, and a person at ${company} refused it.`
              : `${blocked ? "These checks need no AI and run before the model sees anything." : "The model only describes the photo."} A fixed rule, the same for every claim, made this call. Nobody at ${company} chose it.`}
          </p>
        </div>
      </Paper>

      {!sample && steps.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="micro text-faint">What to do</h3>
          <ol className="flex flex-col gap-2">
            {steps.map((a, i) => (
              <li key={a} className="grid grid-cols-[2rem_minmax(0,1fr)] text-body text-text">
                <span className="font-mono text-micro leading-[1.6rem] text-faint">{String(i + 1).padStart(2, "0")}</span>
                {a}
              </li>
            ))}
          </ol>
        </div>
      )}
      {earlier && (
        <Button href={`/r/${recall.slug}/claim/${earlier}`} size="lg" block prefetch={false}>
          See your claim {earlier}
        </Button>
      )}
      {/* An uncertain read: asking a person leads, since starting over means a new tag and new photos. */}
      {appeal && (
        <form action={`/api/claims/${claim.id}/review`} method="post" className="flex flex-col gap-2">
          <Button type="submit" size="lg" block>
            Ask a person to look
          </Button>
          <p className="text-ui text-muted">A person at {company} looks at your photos instead of the photo check. You can ask once, and their decision shows on this page.</p>
        </form>
      )}
      {!sample && retry && !reviewed && (
        <Button href={againHref} variant={appeal ? "secondary" : "primary"} size={appeal ? "md" : "lg"} block prefetch={false}>
          Start a new claim (new code)
        </Button>
      )}

      {sample && <DemoActions sample={sample} slug={recall.slug} againHref={againHref} claimId={claim.id} decision={claim.decision} round={round} />}
      {/* The verdict sheet above already shows photo 1 and the deciding quote; the rest of the checks wait folded. */}
      <Evidence rows={rows} photoUrls={photoUrls} sample={Boolean(sample)} summary={otherSummary(rows, blocked)} open={false} code={claim.code} />
    </section>
  );
}

/** The signature refusal: the claim's code beside what the model read on the tag, the differing cell in --stop. */
function CodeDiff({ code, seen }: { code: string; seen: string | null | undefined }) {
  const { cells, caption, readable } = codeDiff(code, seen);
  const spoken = `Your code ${code.split("").join(", ")}. ${readable ? `Read on the tag ${cells.map((c) => c.seen || "nothing").join(", ")}.` : "Nothing readable on the tag."} ${caption}`;
  const cell = "flex h-13 w-11 items-center justify-center rounded-control font-mono text-[1.75rem] leading-none font-medium";
  return (
    <figure className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
      <p className="sr-only">{spoken}</p>
      <div aria-hidden="true" className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2">
        <span className="micro text-faint">Your code</span>
        <span className="flex gap-2">
          {cells.map((c, i) => (
            <span key={i} className={clsx(cell, "border border-line text-muted")}>
              {c.yours}
            </span>
          ))}
        </span>
        <span />
        <span className="flex gap-2">
          {cells.map((c, i) => (
            <span key={i} className="w-11 text-center font-mono text-ui text-faint">
              {readable ? (c.same ? "=" : "≠") : ""}
            </span>
          ))}
        </span>
        <span className="micro text-faint">Read on the tag</span>
        <span className="flex gap-2">
          {cells.map((c, i) => (
            <span key={i} className={clsx(cell, !readable ? "border border-dashed border-line-strong text-faint" : c.same ? "border border-line text-muted" : "border-2 border-stop bg-stop-soft text-text")}>
              {readable ? c.seen || "·" : "?"}
            </span>
          ))}
        </span>
      </div>
      <figcaption className="flex gap-2.5 text-ui text-text">
        <CrossIcon size={16} className="mt-0.5 shrink-0 text-stop" />
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

/** The live-camera rule made visible: the code was issued here, the photo came from somewhere else. */
function Provenance({ claim }: { claim: Pick<Claim, "code" | "events"> }) {
  const issued = claim.events.find((e) => e.type === "code_issued")?.at;
  return (
    <figure className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-ui">
        <span className="flex flex-col gap-1">
          <span className="micro text-faint">This page</span>
          <span className="text-text">
            Code <span className="font-mono">{claim.code}</span> issued
            {issued ? (
              <span className="font-mono whitespace-nowrap">
                {" "}
                <LocalTime iso={issued} format="clock" />
              </span>
            ) : null}
          </span>
        </span>
        <span aria-hidden="true" className="flex items-center gap-1">
          <span className="w-6 border-t border-dashed border-line-strong sm:w-10" />
          <span className="flex size-4 items-center justify-center text-stop">
            <CrossIcon size={16} />
          </span>
          <span className="w-6 border-t border-dashed border-line-strong sm:w-10" />
        </span>
        <span className="flex flex-col gap-1 text-right">
          <span className="micro text-faint">The photo</span>
          <span className="text-text">Arrived from outside this page</span>
        </span>
      </div>
      <figcaption className="text-ui text-muted">Photos only count when they&apos;re taken on this page&apos;s camera, inside the code&apos;s 10 minutes.</figcaption>
    </figure>
  );
}

/**
 * A repost: this claim's photo beside the earlier claim's matching photo, each with its own claim id. Another
 * account's claim shows neither its photo nor its id: only that it exists.
 */
function DuplicatePair({ claimId, photoUrls, duplicate, sample }: { claimId: string; photoUrls: string[]; duplicate: Duplicate | null; sample: boolean }) {
  const n = duplicate?.photo ?? 1;
  const earlier = duplicate?.earlier;
  return (
    <figure className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-center gap-6">
        <div className="flex flex-col items-center gap-2.5">
          <ExhibitPhoto src={photoUrls[n - 1] ?? photoUrls[0]} alt={`Photo ${n} of this claim, ${claimId}`} n={n} frame="aspect-[3/4]" className="w-30" />
          <span className="flex flex-col items-center gap-0.5 text-center">
            <span className="micro text-faint">Your photo</span>
            <span className="font-mono text-micro whitespace-nowrap text-muted">{claimId}</span>
          </span>
        </div>
        <div className="flex flex-col items-center gap-2.5">
          {earlier ? (
            <ExhibitPhoto src={earlier.src} alt={`Photo ${earlier.n} of the earlier claim ${earlier.id}, the same picture`} n={earlier.n} frame="aspect-[3/4]" className="w-30" />
          ) : (
            <span className="flex aspect-[3/4] w-30 items-center justify-center rounded-control border border-dashed border-line-strong px-3 text-center text-ui text-muted">Another account&apos;s photo</span>
          )}
          <span className="flex flex-col items-center gap-0.5 text-center">
            <span className="micro text-faint">Already claimed</span>
            <span className="font-mono text-micro whitespace-nowrap text-muted">{earlier ? earlier.id : "Not shown"}</span>
          </span>
        </div>
      </div>
      <figcaption className="flex flex-col gap-2 text-ui text-muted">
        <span>
          {earlier ? `Photo ${n} is the same picture as one in claim ${earlier.id}` : `Photo ${n} is the same picture as one in another claim`}, so a second refund can&apos;t be paid for it.
        </span>
        {sample && <SampleChip className="self-start" />}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------------------------------ Shared parts */

// The receipt counts decision checks only, by group, the way the checklist and the judges' rail name them: the refund
// row is the outcome, not a check.
const count = (rows: CheckRow[], group: CheckRow["group"]) => rows.filter((r) => r.group === group).length;

function passedSummary(rows: CheckRow[]): string {
  // One number for the owner; the split (no AI, then the photo check's answers, one per row) is in the evidence below.
  return `All ${count(rows, "pre") + count(rows, "model")} checks passed`;
}

// The folded evidence under a refusal: blocked claims never reached the model, so nothing is said to have passed there.
function otherSummary(rows: CheckRow[], blocked: boolean): string {
  if (blocked || !rows.some((r) => r.group === "model" && r.state !== "waiting")) return "The photo check didn't run";
  const others = rows.filter((r) => r.group !== "pay" && r.state !== "reject" && r.state !== "blocked");
  return others.length && others.every((r) => r.state === "pass") ? "Every other check passed" : "Every check";
}

function Top({ status, id }: { status: ReactNode; id: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {status}
      <span className="font-mono text-ui text-faint">Claim {id}</span>
    </div>
  );
}

/** The photos and every check: open beside a refusal or a demo result, folded on a real owner's receipt. */
function Evidence({ rows, photoUrls, sample, summary, open = false, code }: { rows: CheckRow[]; photoUrls: string[]; sample: boolean; summary: string; open?: boolean; code: string }) {
  return (
    <RevealDetails className="group rounded-card border border-line bg-surface" open={open}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 px-4 py-3 text-ui font-medium text-text sm:px-5 [&::-webkit-details-marker]:hidden">
        {photoUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrls[0]} alt="" className="size-16 shrink-0 rounded-[4px] bg-paper object-cover p-[2px]" />
        )}
        {/* Below 480px the toggle stacks under the summary, so the summary keeps the width and wraps to two lines. */}
        <span className="flex min-w-0 flex-1 flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-4">
          <span className="min-[480px]:flex-1">{summary}</span>
          <span className="micro text-faint group-open:hidden">Show evidence</span>
          <span className="micro hidden text-faint group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="flex flex-col gap-6 border-t border-line p-4 sm:p-5">
        {photoUrls.length > 0 && (
          <div className={clsx("grid gap-5", photoUrls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {photoUrls.map((src, i) => (
              // /demo holds only AI-made samples (a dev preview's stand-ins too): any photo from there carries the label.
              // Numbered as the camera numbers them: letters are the judges' samples (A to D).
              <ExhibitPhoto key={`${src}-${i}`} src={src} alt={`Photo ${i + 1} of this claim`} n={i + 1} sample={sample || src.startsWith("/demo/")} />
            ))}
          </div>
        )}
        <CheckList rows={rows} code={code} />
      </div>
    </RevealDetails>
  );
}

/** A form that files a demo claim for one sample and lands on its photo step (POST /api/claims, as the picker does). */
function RunSample({ slug, sample, children, rail, secondary }: { slug: string; sample: string; children: ReactNode; rail?: boolean; secondary?: boolean }) {
  return (
    <form action="/api/claims" method="post">
      <input type="hidden" name="recall" value={slug} />
      <input type="hidden" name="sample" value={sample} />
      <Button type="submit" variant={secondary ? "secondary" : "primary"} size={rail || secondary ? "md" : "lg"} block className={clsx(rail && "h-auto min-h-11 py-2.5 whitespace-normal")}>
        {children}
      </Button>
    </form>
  );
}

interface DemoActionsProps {
  sample: DemoSample;
  slug: string;
  againHref: string;
  claimId: string;
  decision: Claim["decision"];
  round?: DemoRound | null;
  /** The model never answered: running this sample again is the primary action. */
  unanswered?: boolean;
  /** In the judges' rail (1200px and up). Otherwise under the result, which hides them there; on a phone the primary
   * action waits in a bar at the bottom of the screen until the page reaches it. */
  rail?: boolean;
}

const consoleHref = (claimId: string) => `/console?claim=${claimId}`;

/** The round is over: every sample has run and this one got the model's answer, so the console is what's left to see. */
const roundOver = (runs: RoundRun[], sample: DemoSample, unanswered?: boolean) => !unanswered && !nextSample(runs, sample.id);

/** What the sample should have done beside what it did: in the judges' rail, and under the result below 1200px. */
function ExpectedGot({ sample, run }: { sample: DemoSample; run: RoundRun }) {
  const mark = runMark(sample, run);
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-ui">
      <dt className="micro text-faint">Expected</dt>
      <dd>
        <StatusPill status={sample.expect} label={statusLabel(sample.expect)} />
      </dd>
      <dt className="micro text-faint">Got</dt>
      <dd className="flex items-center gap-2 whitespace-nowrap">
        <StatusPill status={run.decision} />
        {/* A model outage is the fallback working, so it's neutral: never the red of a wrong outcome. */}
        <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap", mark === "expected" ? "text-pay" : mark === "missed" ? "text-stop" : "text-muted")}>
          {mark === "expected" ? <CheckIcon size={14} /> : mark === "missed" ? <CrossIcon size={14} /> : null}
          {mark === "expected" ? "As expected" : mark === "missed" ? "Not as expected" : "Model unavailable"}
        </span>
      </dd>
    </dl>
  );
}

/**
 * Demo results: the next sample in the guided order is the primary action, straight to its photo; after a model outage,
 * running this one again; once the round is over, this claim in the company's console.
 */
function DemoActions({ sample, slug, againHref, claimId, decision, round, unanswered, rail }: DemoActionsProps) {
  const runs = round?.runs ?? [];
  const next = nextSample(runs, sample.id);
  const over = roundOver(runs, sample, unanswered);
  const primary = unanswered ? (
    <RunSample slug={slug} sample={sample.id} rail={rail}>
      Run this sample again
    </RunSample>
  ) : next ? (
    <RunSample slug={slug} sample={next.id} rail={rail}>
      Next sample: {next.title}
    </RunSample>
  ) : (
    <Button href={consoleHref(claimId)} size={rail ? "md" : "lg"} block prefetch={false} className={clsx("h-auto! py-2.5 text-center whitespace-normal!", rail ? "min-h-11" : "min-h-12")}>
      {rail ? (
        "Sign in as Kikea Store to see this claim"
      ) : (
        // One line in the phone's pinned bar.
        <>
          <span className="sm:hidden">See it in the console</span>
          <span className="max-sm:hidden">Sign in as Kikea Store to see this claim</span>
        </>
      )}
    </Button>
  );
  // The round's end, said once in plain words above its one action: no fanfare, just the score.
  const done = over && <p className="text-ui font-medium text-text">{roundLine(runs)}</p>;
  // After an outage the next sample stays one click away, so a judge can carry on while the model is down.
  const secondary =
    unanswered && next ? (
      <RunSample slug={slug} sample={next.id} rail={rail} secondary>
        Next sample: {next.title}
      </RunSample>
    ) : (
      <Button href={againHref} variant="secondary" size={rail ? "sm" : "md"} block prefetch={false}>
        {next ? "Choose another sample" : "Back to the samples"}
      </Button>
    );
  if (rail) {
    return (
      <div className="flex flex-col gap-3">
        {done}
        {primary}
        {secondary}
      </div>
    );
  }
  // Direct children of the result's column, so the sticky bar can travel the column's height on a phone. The rail's
  // verdict and console link are repeated here, since below 1200px the rail is a sheet behind the header's pill. The
  // round's end rides in the bar with its console link, so a phone sees both on the first screen.
  return (
    <>
      <div className="flex flex-col gap-3 min-[1200px]:hidden">
        <ExpectedGot sample={sample} run={{ sample: sample.id, decision, unanswered }} />
      </div>
      <div
        data-action-bar=""
        className="z-10 -mt-3 flex flex-col gap-2.5 max-sm:sticky max-sm:bottom-0 max-sm:mx-[calc(var(--gutter)*-1)] max-sm:border-t max-sm:border-line max-sm:bg-bg/92 max-sm:px-(--gutter) max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:backdrop-blur-md min-[1200px]:hidden"
      >
        {done}
        {primary}
      </div>
      <div className="-mt-3 flex flex-col gap-3 min-[1200px]:hidden">
        {secondary}
        {!over && (
          <Button href={consoleHref(claimId)} variant="tertiary" size="sm" prefetch={false} className="self-start">
            Sign in as Kikea Store to see this claim
          </Button>
        )}
      </div>
    </>
  );
}

/** The judges' rail on a demo result: what should have happened, what did, the next action, this round's score, the console. */
function JudgeVerdict({ sample, run, round, claimId, slug, againHref }: { sample: DemoSample; run: RoundRun; round?: DemoRound | null; claimId: string; slug: string; againHref: string }) {
  const over = roundOver(round?.runs ?? [], sample, run.unanswered);
  return (
    <div className="flex flex-col gap-4">
      <ExpectedGot sample={sample} run={run} />
      <DemoActions sample={sample} slug={slug} againHref={againHref} claimId={claimId} decision={run.decision} round={round} unanswered={run.unanswered} rail />
      <p className="text-ui text-muted">
        <NoBreakHyphens>{sample.description}</NoBreakHyphens>
      </p>
      {round && <Scoreboard runs={round.runs} complete={over} />}
      {/* Once the round is over the console is the primary action above. */}
      {!over && (
        <Button href={consoleHref(claimId)} variant="tertiary" size="sm" prefetch={false} className="self-start">
          Sign in as Kikea Store to see this claim
        </Button>
      )}
    </div>
  );
}
