import clsx from "clsx";
import type { ReactNode } from "react";
import { Button, Card, Money, Paper } from "@/components/ui";
import { canAskForReview, reviewAsked } from "@/lib/appeal";
import type { DemoSample } from "@/lib/demo";
import { sampleTitle } from "@/lib/demo/sampleCopy";
import type { Claim, Recall } from "@/lib/types";
import { CheckList, sixRows, type SixRow } from "./CheckList";
import { CopyPageLink } from "./CopyPageLink";
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
import { PaidStamp, PaidTitle, PayoutLive, PayoutRow } from "./ReceiptLive";
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

/**
 * The end of a claim: the outcome said once, in the headline, beside its evidence. Paid is the printed receipt; held and
 * refused say what happens next. On a laptop the evidence (photos, the six checks) sits on the right; on a phone it
 * folds under the result.
 */
export function Result(props: ResultProps) {
  const { claim, recall, rows } = props;
  const cut = cutInHalf(recall.spec);
  const read = claim.verdict ? { label: claim.verdict.label.text_seen, code: claim.verdict.challenge_code.text_seen } : undefined;
  const six = sixRows(rows, { code: claim.code, noun: nounOf(recall.spec), cut, decided: true, held: claim.decision === "held", read });
  const repost = claim.decision !== "paid" && claim.reasons.some((r) => r.check === "duplicate_photo") && props.photoUrls.length > 0;
  const summary = evidenceSummary(six, { decision: claim.decision, cut, unanswered: noModelAnswer(claim.decision, claim.reasons) });
  const body = claim.decision === "paid" ? <Paid {...props} /> : claim.decision === "held" ? <Held {...props} /> : <Refused {...props} />;
  return (
    <ClaimFrame>
      <FocusTitle id="result-title" />
      {props.meter}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:gap-14">
        <section aria-labelledby="result-title" className="flex min-w-0 flex-col gap-6">
          {body}
        </section>
        {/* A repost shows its photo beside the earlier claim's already: the evidence doesn't repeat it. */}
        <Evidence six={six} photoUrls={repost ? [] : props.photoUrls} summary={summary} company={companyName(recall)} amount={money(claim.payout?.amount ?? recall.refund)} claimId={claim.id} />
      </div>
    </ClaimFrame>
  );
}

/* ------------------------------------------------------------------------------------------------ Paid */

function Paid({ claim, recall, payout, againHref, sample, round, now, sandbox, account, activityUrl }: ResultProps) {
  const amount = claim.payout?.amount ?? recall.refund;
  const sentAt = claim.events.find((e) => e.type === "payout_sent")?.at ?? claim.payout?.updatedAt;
  const decidedAt = claim.events.find((e) => e.type === "decided")?.at;
  const took = secondsBetween(claim.events, "photos_received", "payout_sent");
  // The one arrival moment: it prints only when it's news. A reload, or a later visit, shows it at rest.
  const arrive = Boolean(now && decidedAt && now - Date.parse(decidedAt) < 60_000);
  const status = payout?.status ?? claim.payout?.status ?? null;
  const demo = Boolean(sample);
  return (
    <PayoutLive claimId={claim.id} status={status} live={Boolean(payout?.live)} amount={money(amount)}>
      <StepTitle id="result-title">
        <PaidTitle amount={money(amount)} />
      </StepTitle>
      <Paper variant="receipt" perforated padding="lg" className={clsx(arrive && styles.print)}>
        <div className="flex items-baseline justify-between gap-4 text-ui text-ink-muted">
          <span>Refund receipt</span>
          <span className="font-mono text-micro">CPSC {recall.id}</span>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <Money value={Number(amount.value)} currency={amount.currency} size="amount" className="text-ink" />
          <PaidStamp arrive={arrive} />
        </div>

        <dl className="mt-6 border-t border-dashed border-paper-line">
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
        </dl>
        {took !== null && <p className="mt-3 text-ui text-ink-muted">Paid {took}s after your photo</p>}
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

      {sample && <DemoActions sample={sample} slug={recall.slug} company={companyName(recall)} againHref={againHref} claimId={claim.id} round={round} />}
    </PayoutLive>
  );
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
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-paper-line py-3 text-ui last:border-b-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className={clsx("min-w-0 text-right text-ink [overflow-wrap:anywhere]", mono && "font-mono")}>{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ Held */

function Held({ claim, recall, againHref, sample, round }: ResultProps) {
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
      : `${asked ? "You asked for a review. " : ""}They decide by ${by}. If they approve it, ${refund} goes to your PayPal.`;
  return (
    <>
      <div className="flex flex-col gap-3">
        <StepTitle id="result-title">{payout ? `Your photos passed. ${company} will send your refund` : <>A person at {nb} will check this claim</>}</StepTitle>
        <p className="text-body text-pretty text-muted">{lead}</p>
      </div>

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

        {/* How the answer reaches the owner, in true facts only: this page shows it. */}
        <div className="flex flex-col items-start gap-3 border-t border-line pt-5">
          <p className="text-body text-text">
            Bookmark this page. {payout ? "The payout" : "The decision"} shows here.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <CopyPageLink />
            <span className="text-ui text-faint">
              Claim <span className="font-mono whitespace-nowrap">{claim.id}</span>
            </span>
          </div>
        </div>
      </Card>

      {sample && <DemoActions sample={sample} slug={recall.slug} company={company} againHref={againHref} claimId={claim.id} round={round} unanswered={unanswered} />}
    </>
  );
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

function Refused({ claim, recall, photoUrls, againHref, sample, round, duplicate }: ResultProps) {
  const reasons = readableReasons(decidingReasons(claim), claim.photos.length);
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
        This photo was already sent with claim <span className="font-mono">{duplicate.earlier.id}</span>.
      </>
    ) : (
      "This photo was already sent with another claim."
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
  return (
    <>
      <div className="flex flex-col gap-3">
        <StepTitle id="result-title">{reviewed ? `A person at ${company} looked at this and refused it` : "We couldn't pay this claim"}</StepTitle>
        <p className="text-body text-pretty text-muted">{body}</p>
      </div>

      {lead === "code" && <CodeDiff code={claim.code} seen={claim.verdict?.challenge_code.text_seen} />}
      {lead === "duplicate_photo" && photoUrls[0] && <DuplicatePair claimId={claim.id} photoUrls={photoUrls} duplicate={duplicate ?? null} />}

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

      {sample && <DemoActions sample={sample} slug={recall.slug} company={company} againHref={againHref} claimId={claim.id} round={round} />}
    </>
  );
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
    <figure className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <figcaption className="sr-only">{spoken}</figcaption>
      <div aria-hidden="true" className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2">
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
 * A repost: this claim's photo beside the earlier claim's matching photo, each with its own claim id. Another
 * account's claim shows neither its photo nor its id: only that it exists.
 */
function DuplicatePair({ claimId, photoUrls, duplicate }: { claimId: string; photoUrls: string[]; duplicate: Duplicate | null }) {
  const n = duplicate?.photo ?? 1;
  const earlier = duplicate?.earlier;
  return (
    <figure className="grid grid-cols-2 gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-2">
        <ExhibitPhoto src={photoUrls[n - 1] ?? photoUrls[0]} alt={`Photo ${n} of this claim, ${claimId}`} fit="cover" position="object-[50%_70%]" frame="aspect-[3/4]" />
        <span className="text-ui text-muted">This claim</span>
      </div>
      <div className="flex flex-col gap-2">
        {earlier ? (
          <ExhibitPhoto src={earlier.src} alt={`Photo ${earlier.n} of the earlier claim ${earlier.id}, the same picture`} fit="cover" position="object-[50%_70%]" frame="aspect-[3/4]" />
        ) : (
          <span className="flex aspect-[3/4] items-center justify-center rounded-control border border-dashed border-line-strong px-3 text-center text-ui text-muted">Another account&apos;s photo</span>
        )}
        <span className="text-ui text-muted">
          {earlier ? (
            <>
              Claimed before as <span className="font-mono whitespace-nowrap">{earlier.id}</span>
            </>
          ) : (
            "Claimed before by another account"
          )}
        </span>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------------------------------ Evidence */

/**
 * The photos and the six checks. From 1024px they sit open beside the result; below, they fold under it behind
 * "Show evidence". The rule's one line is said here, once.
 */
function Evidence({ six, photoUrls, summary, company, amount, claimId }: { six: SixRow[]; photoUrls: string[]; summary: string; company: string; amount: string; claimId: string }) {
  const content = (
    <>
      {photoUrls.length > 0 && (
        <div className={clsx("grid gap-3", photoUrls.length > 1 ? "grid-cols-3" : "max-w-[15rem] grid-cols-1")}>
          {photoUrls.map((src, i) => (
            <ExhibitPhoto key={`${src}-${i}`} src={src} alt={`Photo ${i + 1} of this claim`} fit="cover" position="object-[50%_70%]" frame="aspect-[3/4]" />
          ))}
        </div>
      )}
      <CheckList rows={six} label="Checks for this claim" amount={amount} />
      <p className="text-ui text-faint">
        Claim <span className="font-mono whitespace-nowrap">{claimId}</span>. The same rule decides every claim; nobody at {company} picks who gets paid.
      </p>
    </>
  );
  return (
    <>
      <aside aria-label="Evidence" className="hidden min-w-0 flex-col gap-5 lg:flex">
        <p className="text-ui font-medium text-muted">{summary}</p>
        {content}
      </aside>
      <RevealDetails className="group border-y border-line lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 py-3 text-ui [&::-webkit-details-marker]:hidden">
          {photoUrls[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrls[0]} alt="" className="size-12 shrink-0 rounded-control bg-surface-2 object-cover object-[50%_70%] ring-1 ring-line" />
          )}
          <span className="min-w-0 flex-1 text-text">{summary}</span>
          <span className="shrink-0 text-muted underline decoration-line-strong underline-offset-4 group-open:hidden">Show evidence</span>
          <span className="hidden shrink-0 text-muted underline decoration-line-strong underline-offset-4 group-open:inline">Hide evidence</span>
        </summary>
        <div className="flex flex-col gap-5 pt-2 pb-6">{content}</div>
      </RevealDetails>
    </>
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
 * outcomes. The company's view of the same claims is a quiet link, never the owner's main action.
 */
function DemoActions({ sample, slug, company, againHref, claimId, round, unanswered }: { sample: DemoSample; slug: string; company: string; againHref: string; claimId: string; round?: DemoRound | null; unanswered?: boolean }) {
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
      {next || unanswered ? (
        <Button href={againHref} variant="tertiary" size="sm" prefetch={false}>
          All four claims
        </Button>
      ) : (
        <a href={`/console?claim=${claimId}`} className="text-ui text-muted underline decoration-line-strong underline-offset-4 hover:text-text">
          See these claims as {company}
        </a>
      )}
    </div>
  );
}
