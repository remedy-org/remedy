import clsx from "clsx";
import type { ReactNode } from "react";
import { Button, Card, Money, Paper } from "@/components/ui";
import { canAskForReview, reviewAsked } from "@/lib/appeal";
import type { DemoSample } from "@/lib/demo";
import { sampleTitle } from "@/lib/demo/sampleCopy";
import type { Claim, Recall } from "@/lib/types";
import { CheckList, sixRows } from "./CheckList";
import { EvidenceText, evidenceSummary } from "./EvidenceText";
import { ClaimFrame, ExhibitPhoto, StepTitle } from "./Exhibit";
import styles from "./flow.module.css";
import { FocusTitle } from "./FocusTitle";
import { ClaimTime } from "./LocalTime";
import {
  adviceFor,
  businessDaysAfter,
  canRetry,
  codeDiff,
  companyName,
  cutInHalf,
  decidingReasons,
  handWrittenLabel,
  maskPayer,
  misreadOf,
  money,
  noModelAnswer,
  nounOf,
  payoutHold,
  readableReasons,
  refusalHeadline,
  secondsBetween,
  type CheckRow,
} from "./model";
import { PaidTitle, PayoutLive, PayoutRow } from "./ReceiptLive";
import { RevealDetails } from "./RevealDetails";
import { nextSample, type RoundRun } from "./Scoreboard";

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
  /** Starts over: a new real claim, or the demo's claim picker. */
  againHref: string;
  sample?: DemoSample | null;
  /** Demo: this round's runs, for "Next claim". */
  round?: DemoRound | null;
  /** A refused repost's earlier claim, for the side by side. */
  duplicate?: Duplicate | null;
  /** The server's clock at render (ms): the receipt prints only for a claim decided under a minute ago. */
  now?: number;
  /** The step meter, above the result. */
  meter?: ReactNode;
  /** Payouts go to PayPal's sandbox in this build: the receipt's foot says so, once. */
  sandbox?: boolean;
  /** A sandbox build's paid receipt: PayPal's activity page, where the payout shows. */
  activityUrl?: string;
  /** The PayPal login the owner recognises, masked ("p••@owner.test"); the receipt falls back to the payer ID's tail. */
  account?: string | null;
}

// The result keeps the checking screen's layout (CheckingStep): on a tall laptop the evidence on the left, where the photo
// was, and the headline and the checks on the right, so the outcome lands in place. Phones and short screens stack it,
// with the photos and the checks folded under the outcome. The classes are spelled out so Tailwind finds them.
const WIDE_GRID = "lg:[@media(min-height:601px)]:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:[@media(min-height:601px)]:gap-14";
const WIDE_ONLY = "hidden lg:[@media(min-height:601px)]:flex";
const NARROW_ONLY = "lg:[@media(min-height:601px)]:hidden";

/** What each outcome puts where: the headline, the evidence beside it on a laptop, and what follows the checks. */
interface Parts {
  title: ReactNode;
  lead?: ReactNode;
  /** A laptop's left column, where the checking screen's photo was. */
  side: ReactNode;
  /** Phones: what comes straight under the headline (the receipt, a refusal's comparison). */
  under?: ReactNode;
  /** After the checks on a laptop, after the headline on a phone. */
  next?: ReactNode;
  /** The claim's number as metadata, when nothing else on the screen carries it. */
  meta?: boolean;
  /** The photos are on screen already (a repost's comparison): the folded evidence doesn't repeat them. */
  photosShown?: boolean;
}

/**
 * The end of a claim: the outcome said once, in the headline, beside its evidence. Paid is the printed receipt; held and
 * refused say what happens next.
 */
export function Result(props: ResultProps) {
  const { claim, recall, rows } = props;
  const cut = cutInHalf(recall.spec);
  const read = claim.verdict ? { label: claim.verdict.label.text_seen, code: claim.verdict.challenge_code.text_seen } : undefined;
  const paid = claim.decision === "paid";
  // On a paid result the receipt carries the amount and PayPal's reference: the refund row only says it went.
  const six = sixRows(rows, { code: claim.code, noun: nounOf(recall.spec), cut, decided: true, held: claim.decision === "held", demo: Boolean(claim.demo), written: handWrittenLabel(recall.spec), read }).map((r) =>
    paid && r.key === "refund" ? { ...r, reference: undefined } : r,
  );
  const summary = evidenceSummary(six, { decision: claim.decision, cut, unanswered: noModelAnswer(claim.decision, claim.reasons) });
  const parts = paid ? paidParts(props) : claim.decision === "held" ? heldParts(props) : refusedParts(props);
  const amount = money(claim.payout?.amount ?? recall.refund);
  const checks = <CheckList rows={six} label={`Checks for this claim: ${summary}`} amount={paid ? undefined : amount} />;
  const page = (
    <div className={clsx("grid items-start gap-8", WIDE_GRID)}>
      <div className={clsx(WIDE_ONLY, "min-w-0 flex-col gap-3")}>{parts.side}</div>
      <section aria-labelledby="result-title" className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <StepTitle id="result-title">{parts.title}</StepTitle>
          {parts.lead && <p className="text-body text-pretty text-muted">{parts.lead}</p>}
        </div>
        <div className={clsx(WIDE_ONLY, "flex-col")}>{checks}</div>
        {parts.under && <div className={clsx(NARROW_ONLY, "flex flex-col gap-6")}>{parts.under}</div>}
        {parts.next}
        <FoldedEvidence summary={summary} photoUrls={parts.photosShown ? [] : props.photoUrls} checks={checks} />
        {parts.meta && (
          <p className="text-ui text-faint">
            Claim <span className="font-mono whitespace-nowrap">{claim.id}</span>
          </p>
        )}
      </section>
    </div>
  );
  return (
    <ClaimFrame>
      <FocusTitle id="result-title" />
      {props.meter}
      {paid ? (
        <PayoutLive claimId={claim.id} status={props.payout?.status ?? claim.payout?.status ?? null} live={Boolean(props.payout?.live)} amount={amount}>
          {page}
        </PayoutLive>
      ) : (
        page
      )}
    </ClaimFrame>
  );
}

/** A claim's photos, whole: the first as large as the checking screen showed it, the rest numbered under it. */
function Photos({ urls, claimId }: { urls: string[]; claimId: string }) {
  if (!urls.length) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls[0]} alt={`Photo 1 of claim ${claimId}`} className="aspect-[4/5] w-full rounded-card bg-surface-2 object-contain ring-1 ring-line" />
      {urls.length > 1 && (
        <ul aria-label={`${urls.length} photos`} className="flex gap-2">
          {urls.slice(1).map((src, i) => (
            <li key={`${src}-${i}`}>
              <ExhibitPhoto src={src} alt={`Photo ${i + 2}`} n={i + 2} frame="size-14" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------------------------------------ Paid */

function paidParts({ claim, recall, againHref, sample, round, now, sandbox, account, activityUrl, payout }: ResultProps): Parts {
  const amount = claim.payout?.amount ?? recall.refund;
  const sentAt = claim.events.find((e) => e.type === "payout_sent")?.at ?? claim.payout?.updatedAt;
  const decidedAt = claim.events.find((e) => e.type === "decided")?.at;
  const took = secondsBetween(claim.events, "photos_received", "payout_sent");
  // The one arrival moment: it prints only when it's news. A reload, or a later visit, shows it at rest.
  const arrive = Boolean(now && decidedAt && now - Date.parse(decidedAt) < 60_000);
  const demo = Boolean(sample);
  const receipt = (
    // Flat paper with a hairline: the status row, not a stamp or a torn edge, says when the money has arrived.
    <Paper variant="receipt" padding="lg" className={clsx("w-full [&>div]:shadow-[0_0_0_1px_var(--paper-line)]", arrive && styles.print)}>
      <div className="flex items-baseline justify-between gap-4 text-ui text-ink-muted">
        <span>Refund receipt</span>
        <span className="font-mono text-micro">CPSC {recall.id}</span>
      </div>

      <Money value={Number(amount.value)} currency={amount.currency} size="amount" className="mt-6 block text-ink" />

      <dl className="mt-6 border-t border-paper-line">
        <PayoutRow />
        <ReceiptRow label="Claim" mono>
          {claim.id}
        </ReceiptRow>
        {/* The PayPal login the owner knows, masked; without one, the payer ID's tail. */}
        <ReceiptRow label="Paid to" mono={!account}>
          {account ? <Masked text={account} /> : <>
              <span className="sr-only">PayPal account ending {claim.payerId.slice(-5)}</span>
              <span aria-hidden="true">{maskPayer(claim.payerId)}</span>
            </>}
        </ReceiptRow>
        {claim.payout && (
          <ReceiptRow label="PayPal reference" mono>
            {claim.payout.batchId}
          </ReceiptRow>
        )}
        {sentAt && (
          <ReceiptRow label="Sent">
            <ClaimTime iso={sentAt} format="stamp" />
          </ReceiptRow>
        )}
        {/* Measured from the photos arriving to the payout leaving: sent, which is true before PayPal says received. */}
        {took !== null && (
          <ReceiptRow label="Sent after your photo">
            <span className="font-mono">{took}</span> {took === 1 ? "second" : "seconds"}
          </ReceiptRow>
        )}
      </dl>
      {payout && !payout.fresh && <p className="mt-3 text-ui text-ink-muted">PayPal didn&apos;t answer just now, so this is the last status we saved.</p>}
      {!sandbox && !demo && <p className="mt-3 text-ui text-ink-muted">PayPal emails you a receipt too.</p>}
      {/* Said once, plainly: the demo account's refunds are real payouts that carry no real money. */}
      {(sandbox || demo) && (
        <p className="mt-6 text-ui text-ink-muted">
          Demo account. No real money moved.
          {activityUrl && (
            <>
              {" "}
              <a href={activityUrl} target="_blank" rel="noreferrer" className="text-ink underline decoration-paper-line underline-offset-4 hover:decoration-ink">
                See it in PayPal<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          )}
        </p>
      )}
    </Paper>
  );
  return {
    title: <PaidTitle amount={money(amount)} />,
    side: receipt,
    under: receipt,
    next: sample && <DemoActions sample={sample} slug={recall.slug} againHref={againHref} round={round} />,
  };
}

/** "p••@owner.test": Schibsted's bullets sit wide apart, so the mask's run of them is set in mono, as the console's is. */
function Masked({ text }: { text: string }) {
  // Read out as "d, hidden, @owner.test" rather than a run of bullets.
  const spoken = text.replace(/•+/g, ", hidden, ");
  return (
    <>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true">
      {text.split(/(•+)/).map((part, i) =>
    part.startsWith("•") ? (
      <span key={i} className="font-mono tracking-[-0.08em]">
        {part}
      </span>
    ) : (
        part
      ),
      )}
      </span>
    </>
  );
}

function ReceiptRow({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-paper-line py-3 text-ui last:border-b-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className={clsx("min-w-0 text-right text-ink [overflow-wrap:anywhere]", mono && "font-mono")}>{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ Held */

function heldParts({ claim, recall, photoUrls, againHref, sample, round }: ResultProps): Parts {
  const reasons = decidingReasons(claim);
  const submitted = claim.events.find((e) => e.type === "photos_received")?.at ?? claim.createdAt;
  const checked = claim.events.find((e) => e.type === "decided")?.at ?? claim.events.find((e) => e.type === "checked")?.at;
  const company = companyName(recall);
  const nb = company.replace(/ /g, "\u00a0");
  // The owner asked a person to look at a claim the rule refused: this screen is the confirmation.
  const asked = reviewAsked(claim) ? (claim.events.find((e) => e.type === "review_requested")?.at ?? submitted) : null;
  // The photos passed and only the payout failed: nothing waits on the photos, a person sends the refund.
  const payout = asked ? null : payoutHold(claim);
  const unanswered = noModelAnswer(claim.decision, claim.reasons);
  const by = businessDaysAfter(asked ?? submitted, 2);
  const refund = money(recall.refund);
  const lead = payout
    ? `${payout === "network" ? "Remedy couldn't reach PayPal to send it" : "PayPal didn't accept the transfer"}, so a person at ${company} will send ${refund} by ${by}. Nothing has been paid yet.${payout === "refused" ? " If your PayPal account shows a notice, sort it out there." : ""}`
    : unanswered
      ? `We couldn't finish the photo check, so a person at ${company} will look at it by ${by}. Nothing was paid.`
      : `${asked ? "You asked for a review. " : ""}They decide by ${by}.`;
  return {
    title: payout ? `Your photos passed. ${company} will send your refund` : <>A person at {nb} will check this claim</>,
    lead,
    side: <Photos urls={photoUrls} claimId={claim.id} />,
    next: (
      <>
        <Card padding="lg" className="flex flex-col gap-6">
          <ol aria-label="What happens next" className="relative flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[3.5px] before:w-px before:bg-line">
            <TimelineRow state="done" label="Photos received" time={submitted} />
            {checked && <TimelineRow state="done" label={asked ? "Refused by the checks" : payout ? "Checks passed" : "Checks run"} time={checked} />}
            {asked && <TimelineRow state="done" label="You asked for a review" time={asked} />}
            <TimelineRow state="now" label="Waiting for a person" />
            <TimelineRow state="next" label={`${payout ? "Refund sent" : "Decision"} by ${by}`} />
          </ol>

          {asked && reasons.length > 0 && (
            <p className="text-ui text-muted">
              <EvidenceText>{reasons.map((r) => r.text).join(". ")}</EvidenceText>
            </p>
          )}

          {/* How the answer reaches the owner, in true facts only: the payout's own email from PayPal. */}
          <div className="flex flex-col gap-1 border-t border-line pt-5">
            <p className="text-body text-text">
              {payout ? `PayPal emails you when the ${refund} arrives.` : `If they approve it, PayPal emails you when the ${refund} arrives.`}
            </p>
            <p className="text-ui text-faint">
              Claim <span className="font-mono whitespace-nowrap">{claim.id}</span>
            </p>
          </div>
        </Card>
        {sample && <DemoActions sample={sample} slug={recall.slug} againHref={againHref} round={round} unanswered={unanswered} />}
      </>
    ),
  };
}

/** `time`: the viewer's local time, to the minute. */
function TimelineRow({ state, label, time }: { state: "done" | "now" | "next"; label: string; time?: string }) {
  return (
    <li className="relative grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center text-ui">
      <span aria-hidden="true" className={clsx("relative size-2 rounded-full", state === "done" ? "bg-muted" : state === "now" ? clsx("bg-text text-text", styles.pulse) : "border border-line-strong bg-surface")} />
      <span className={state === "done" ? "text-muted" : "text-text"}>{label}</span>
      {time && (
        <span className="pl-3 text-ui text-faint">
          <ClaimTime iso={time} format="day" />
        </span>
      )}
    </li>
  );
}

/* --------------------------------------------------------------------------------------------- Refused */

function refusedParts({ claim, recall, photoUrls, againHref, sample, round, duplicate }: ResultProps): Parts {
  const deciding = decidingReasons(claim);
  const reasons = readableReasons(deciding, claim.photos.length);
  // Said as many photos as matched: "These photos were already sent…" when more than one did.
  const these = deciding.filter((r) => r.check === "duplicate_photo").length > 1 ? "These photos were" : "This photo was";
  const retry = canRetry(reasons);
  const company = companyName(recall);
  const lead = reasons[0]?.check;
  const reviewed = lead === "review";
  const asked = reviewAsked(claim);
  // The photo check wasn't sure of what it read: the owner may ask a person to look, once (src/lib/appeal.ts).
  const appeal = !sample && canAskForReview(claim);
  const misread = appeal && lead === "code" ? misreadOf(claim.code, claim.verdict?.challenge_code.text_seen) : null;
  // Each PayPal account claims once per recall: the way forward is the claim that counts (same account, so it's theirs).
  const earlier = !sample ? /\((RM-\d+)\)/.exec(reasons.find((r) => r.check === "payer")?.text ?? "")?.[1] : undefined;
  const seen = codeDiff(claim.code, claim.verdict?.challenge_code.text_seen);
  const read = seen.cells.map((c) => c.seen).join("");
  const body = reviewed ? (
    <EvidenceText>{`${asked ? "You asked for a review, and" : "Your claim was held for a person, and"} ${company} refused it: ${reasons[0]?.text ?? ""}`}</EvidenceText>
  ) : lead === "code" ? (
    seen.readable ? (
      <>
        The code on the tag reads <span className="font-mono">{read}</span>. Yours is <span className="font-mono">{claim.code}</span>.
      </>
    ) : (
      <>
        We couldn&apos;t read a code on the tag. Yours is <span className="font-mono">{claim.code}</span>.
      </>
    )
  ) : lead === "session" ? (
    "This photo wasn't taken on Remedy's camera. Claims need a photo taken live, inside the claim."
  ) : lead === "duplicate_photo" ? (
    duplicate?.earlier ? (
      <>
        {these} already sent with claim <span className="font-mono">{duplicate.earlier.id}</span>.
      </>
    ) : (
      `${these} already sent with another claim.`
    )
  ) : (
    `${refusalHeadline(claim, recall.spec)}.`
  );
  // When starting over can't help (a second claim from one account), only that reason's advice applies.
  const next = reviewed
    ? []
    : appeal
      ? [misread?.ask ?? "If your photo does show what's asked, ask a person to look. They decide from your photos, and you can ask once."]
      : lead === "code"
        ? ["Start a new claim and write the code again, clearly."]
        : lead === "session"
          ? ["Start a new claim and take the photo on Remedy's camera."]
          : [...new Set((retry ? reasons : reasons.filter((r) => !canRetry([r]))).map((r) => adviceFor(r.check)))];
  const diff = lead === "code" && <CodeDiff code={claim.code} seen={claim.verdict?.challenge_code.text_seen} />;
  const pair = lead === "duplicate_photo" && photoUrls[0] ? <DuplicatePair claimId={claim.id} photoUrls={photoUrls} duplicate={duplicate ?? null} /> : null;
  return {
    title: reviewed ? `A person at ${company} looked at this and refused it` : "We couldn't pay this claim",
    lead: body,
    // A laptop: the evidence where the photo was. A repost's photo beside the earlier one, or the photo whole, and under
    // it the code as read against the claim's.
    side: (
      <>
        {pair ?? <Photos urls={photoUrls} claimId={claim.id} />}
        {diff}
      </>
    ),
    under: (diff || pair) && (
      <>
        {diff}
        {pair}
      </>
    ),
    photosShown: Boolean(pair),
    meta: true,
    next: (
      <>
        {reasons.length > 1 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-ui font-medium text-muted">Why</h3>
            <ul className="flex flex-col gap-1.5 text-body text-text">
              {reasons.map((r, i) => (
                <li key={`${r.check}-${i}`}>
                  <EvidenceText>{r.text}</EvidenceText>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!sample &&
          next.map((a) => (
            <p key={a} className="text-body text-text">
              {a}
            </p>
          ))}
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
            <p className="text-ui text-muted">A person at {company} decides from your photos. You can ask once.</p>
          </form>
        )}
        {!sample && retry && !reviewed && (
          <Button href={againHref} variant={appeal ? "secondary" : "primary"} size={appeal ? "md" : "lg"} block prefetch={false}>
            Start a new claim
          </Button>
        )}

        {sample && <DemoActions sample={sample} slug={recall.slug} againHref={againHref} round={round} />}
      </>
    ),
  };
}

/**
 * The signature refusal: the claim's code beside what the photo check read on the tag, the differing cell in --stop.
 * The boxes say it; the sentence naming the character is for a screen reader.
 */
function CodeDiff({ code, seen }: { code: string; seen: string | null | undefined }) {
  const { cells, caption, readable } = codeDiff(code, seen);
  const spoken = `Your code ${code.split("").join(", ")}. ${readable ? `Read on the tag ${cells.map((c) => c.seen || "nothing").join(", ")}.` : "Nothing readable on the tag."} ${caption}`;
  const cell = "flex h-13 w-11 items-center justify-center rounded-control font-mono text-[1.75rem] leading-none font-medium";
  return (
    // The tiles on the page, the size of their content: no box around them.
    <figure className="w-fit">
      <figcaption className="sr-only">{spoken}</figcaption>
      <div aria-hidden="true" className="grid grid-cols-[auto_auto] items-center gap-x-5 gap-y-2">
        <span className="text-ui text-muted">Yours</span>
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
        <span className="text-ui text-muted">On the tag</span>
        <span className="flex gap-2">
          {cells.map((c, i) => (
            <span key={i} className={clsx(cell, !readable ? "border border-dashed border-line-strong text-faint" : c.same ? "border border-line text-muted" : "border-2 border-stop bg-stop-soft text-text")}>
              {readable ? c.seen || "·" : "?"}
            </span>
          ))}
        </span>
      </div>
    </figure>
  );
}

/**
 * A repost: this claim's photo beside the earlier claim's matching photo, each with its own claim id, both whole. Another
 * account's claim shows neither its photo nor its id: this claim's photo alone, and one line saying it matched.
 */
function DuplicatePair({ claimId, photoUrls, duplicate }: { claimId: string; photoUrls: string[]; duplicate: Duplicate | null }) {
  const n = duplicate?.photo ?? 1;
  const earlier = duplicate?.earlier;
  const ours = <ExhibitPhoto src={photoUrls[n - 1] ?? photoUrls[0]} alt={`Photo ${n} of this claim, ${claimId}`} fit="contain" frame="aspect-[4/5]" />;
  if (!earlier) {
    return (
      <figure className="flex flex-col gap-2">
        {ours}
        <figcaption className="text-ui text-muted">This photo matches one already sent with another PayPal account.</figcaption>
      </figure>
    );
  }
  return (
    <figure className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-2">
        {ours}
        <span className="text-ui text-muted">This claim</span>
      </div>
      <div className="flex flex-col gap-2">
        <ExhibitPhoto src={earlier.src} alt={`Photo ${earlier.n} of the earlier claim ${earlier.id}, the same picture`} fit="contain" frame="aspect-[4/5]" />
        <span className="text-ui text-muted">
          Claimed before as <span className="font-mono whitespace-nowrap">{earlier.id}</span>
        </span>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------------------------------ Evidence */

/** Phones and short screens: the photos and the checks folded under the outcome, behind their one-line summary. */
function FoldedEvidence({ summary, photoUrls, checks }: { summary: string; photoUrls: string[]; checks: ReactNode }) {
  return (
    <RevealDetails className={clsx("group border-y border-line", NARROW_ONLY)}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 py-3 text-ui [&::-webkit-details-marker]:hidden">
        {photoUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrls[0]} alt="" className="size-12 shrink-0 rounded-control bg-surface-2 object-cover object-[50%_70%] ring-1 ring-line" />
        )}
        <span className="min-w-0 flex-1 text-text">{summary}</span>
        <span className="shrink-0 text-muted underline decoration-line-strong underline-offset-4 group-open:hidden">Show evidence</span>
        <span className="hidden shrink-0 text-muted underline decoration-line-strong underline-offset-4 group-open:inline">Hide evidence</span>
      </summary>
      <div className="flex flex-col gap-5 pt-2 pb-6">
        {photoUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {photoUrls.map((src, i) => (
              <ExhibitPhoto key={`${src}-${i}`} src={src} alt={`Photo ${i + 1} of this claim`} n={photoUrls.length > 1 ? i + 1 : undefined} fit="contain" frame="aspect-[4/5]" />
            ))}
          </div>
        )}
        {checks}
      </div>
    </RevealDetails>
  );
}

/* ------------------------------------------------------------------------------------------ Demo */

/** A form that files a demo claim and lands on its photo step (POST /api/claims, as the picker does). */
function RunSample({ slug, sample, children, secondary }: { slug: string; sample: string; children: ReactNode; secondary?: boolean }) {
  return (
    <form action="/api/claims" method="post">
      <input type="hidden" name="recall" value={slug} />
      <input type="hidden" name="sample" value={sample} />
      <Button type="submit" variant={secondary ? "secondary" : "primary"} size={secondary ? "md" : "lg"} block>
        {children}
      </Button>
    </form>
  );
}

/**
 * A demo result's own action: the next claim in the order (genuine, wrong code, upload, repost), straight to its photo;
 * after the photo check didn't answer, this one again; once all four have run, back to the four, now with their
 * outcomes (where the company's view of them is offered).
 */
function DemoActions({ sample, slug, againHref, round, unanswered }: { sample: DemoSample; slug: string; againHref: string; round?: DemoRound | null; unanswered?: boolean }) {
  const next = nextSample(round?.runs ?? [], sample.id);
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex w-full flex-col gap-2">
        {unanswered ? (
          <RunSample slug={slug} sample={sample.id}>
            Run it again
          </RunSample>
        ) : next ? (
          <RunSample slug={slug} sample={next.id}>
            Next claim
          </RunSample>
        ) : (
          <Button href={againHref} size="lg" block prefetch={false}>
            All four claims
          </Button>
        )}
        {unanswered && next && (
          <RunSample slug={slug} sample={next.id} secondary>
            Next claim: {sampleTitle(next.id, next.title).toLowerCase()}
          </RunSample>
        )}
      </div>
      {(next || unanswered) && (
        <Button href={againHref} variant="tertiary" size="sm" prefetch={false}>
          All four claims
        </Button>
      )}
    </div>
  );
}
