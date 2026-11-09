import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeftIcon, Button } from "@/components/ui";
import { canAskForReview, reviewAsked } from "@/lib/appeal";
import type { DemoSample } from "@/lib/demo";
import { SAMPLE_COPY, sampleTitle } from "@/lib/demo/sampleCopy";
import type { Claim, Recall, Reason } from "@/lib/types";
import { CheckList, sixRows, type SixRow } from "./CheckList";
import { ClaimPhotos } from "./ClaimPhotos";
import { evidenceSummary } from "./EvidenceText";
import { ClaimFrame, ClaimLayout, NARROW_ONLY, OutcomeHead, photoWidth } from "./Exhibit";
import styles from "./flow.module.css";
import { FocusTitle } from "./FocusTitle";
import {
  adviceFor,
  businessDaysAfter,
  canRetry,
  codeDiff,
  companyName,
  cutInHalf,
  decidingReasons,
  FOLD_MS,
  handWrittenLabel,
  misreadOf,
  money,
  noModelAnswer,
  nounOf,
  payoutHold,
  payoutWords,
  photoAlt,
  readableReasons,
  refusalHeadline,
  secondsBetween,
  type CheckRow,
} from "./model";
import { PassedChecks } from "./PassedChecks";
import { Receipt } from "./Receipt";
import { SubmitButton } from "./SubmitButton";
import { BringIntoView, PaidTitle, PayoutLive } from "./ReceiptLive";
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
  /** Payouts go to PayPal's sandbox in this build: the receipt points to PayPal activity rather than an email. */
  sandbox?: boolean;
  /** A sandbox build's paid receipt: PayPal's activity page, where the payout shows. */
  activityUrl?: string;
  /** The PayPal login the owner recognises, masked ("p••@owner.test"); the receipt falls back to the payer ID's tail. */
  account?: string | null;
}

/** What each outcome puts where: the headline and its line, the evidence, and the outcome column under the headline. */
interface Parts {
  title: ReactNode;
  /** What we saw and what's wrong, in one or two plain sentences, under the headline. */
  lead?: ReactNode;
  /** A laptop's photo, under the outcome: the checking screen's photo, kept in its place. */
  side: ReactNode;
  /** Phones: the evidence that replaces the thumbnail (a repost's two photos), over the checks. */
  under?: ReactNode;
  /** The outcome column: the receipt, what happens next, the way on. */
  next?: ReactNode;
  /** The claim's number as metadata, when nothing else on the screen carries it. */
  meta?: boolean;
  /** The photos are on screen already (a repost's comparison): no thumbnail beside the headline. */
  photosShown?: boolean;
  /** Paid: the five passed checks fold into one line, so the receipt and the way on share the headline's screen. */
  fold?: { arrive: boolean };
}

/** What the photo check read on the tag, once it has answered. */
const readOf = (claim: Pick<Claim, "verdict">) => (claim.verdict ? { label: claim.verdict.label.text_seen, code: claim.verdict.challenge_code.text_seen } : undefined);

/** A sentence as the page writes it: "We couldn’t…" for the pipeline's "Couldn't…", typeset (the rule stores straight
 * apostrophes), and a full stop. */
const sentence = (s: string) => {
  const t = s.trim().replace(/^Couldn't/, "We couldn't").replace(/(?<=\p{L})'(?=\p{L})/gu, "’");
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

/**
 * The end of a claim, in the checking screen's own layout (ClaimLayout), so the outcome lands in place: the photo and
 * the checks stay where they were in the evidence column, the headline where it was, and the outcome column under it
 * takes the receipt (paid) or what happens next (held, refused).
 */
export function Result(props: ResultProps) {
  const { claim, recall, rows } = props;
  const cut = cutInHalf(recall.spec);
  const read = readOf(claim);
  const paid = claim.decision === "paid";
  const options = {
    code: claim.code,
    noun: nounOf(recall.spec),
    cut,
    decided: true,
    held: claim.decision === "held",
    demo: Boolean(claim.demo),
    photos: claim.photos.length,
    earlier: props.duplicate?.earlier?.id,
    written: handWrittenLabel(recall.spec),
    read,
    steps: recall.spec.proof_steps,
    company: companyName(recall),
  };
  // The outcome column says why a check failed or is held, so its row doesn't say it again.
  const six = sixRows(rows, { ...options, explained: true });
  const summary = evidenceSummary(six, { decision: claim.decision, cut, unanswered: noModelAnswer(claim.decision, claim.reasons) });
  const parts = paid ? paidParts(props) : claim.decision === "held" ? heldParts(props, sixRows(rows, options)) : refusedParts(props);
  const list = <CheckList rows={six} label={`Checks for this claim: ${summary}`} className={parts.fold && "border-t-0"} />;
  const page = (
    <ClaimLayout
      labelledBy="result-title"
      head={<OutcomeHead id="result-title" thumb={parts.photosShown ? undefined : props.photoUrls[0]} thumbAlt={photoAlt(claim.id, read)} title={parts.title} lead={parts.lead} />}
      checks={
        <>
          {parts.under && <div className={clsx(NARROW_ONLY, "flex flex-col gap-4")}>{parts.under}</div>}
          {parts.fold ? (
            <PassedChecks count={six.filter((r) => r.key !== "refund").length} arrive={parts.fold.arrive}>
              {list}
            </PassedChecks>
          ) : (
            list
          )}
        </>
      }
      photo={parts.side}
      outcome={
        (parts.next || parts.meta) && (
          <>
            {parts.next}
            {parts.meta && <Meta id={claim.id} />}
          </>
        )
      }
    />
  );
  return (
    <ClaimFrame>
      <FocusTitle id="result-title" />
      {paid ? (
        <PayoutLive claimId={claim.id} status={props.payout?.status ?? claim.payout?.status ?? null} live={Boolean(props.payout?.live)} amount={money(claim.payout?.amount ?? recall.refund)}>
          {page}
        </PayoutLive>
      ) : (
        page
      )}
    </ClaimFrame>
  );
}

function Meta({ id, className }: { id: string; className?: string }) {
  return (
    <p className={clsx("text-ui text-faint", className)}>
      Claim <span className="font-mono whitespace-nowrap">{id}</span>
    </p>
  );
}

/* ------------------------------------------------------------------------------------------------ Paid */

function paidParts({ claim, recall, photoUrls, againHref, sample, round, now, sandbox, account, activityUrl, payout }: ResultProps): Parts {
  const amount = claim.payout?.amount ?? recall.refund;
  const sentAt = claim.events.find((e) => e.type === "payout_sent")?.at ?? claim.payout?.updatedAt;
  const decidedAt = claim.events.find((e) => e.type === "decided")?.at;
  // The one arrival moment: it prints only when it's news. A reload, or a later visit, shows it at rest.
  const arrive = Boolean(now && decidedAt && now - Date.parse(decidedAt) < 60_000);
  const demo = Boolean(sample);
  // One quiet line at the receipt's foot: where else the payout shows. No email on this build's payouts, so PayPal's
  // activity page instead.
  const foot = (
    <>
      {payout && !payout.fresh && <p>PayPal didn&rsquo;t answer just now, so this is the last status we saved.</p>}
      {sandbox || demo ? (
        <p>
          See it in your{" "}
          {activityUrl ? (
            <a href={activityUrl} target="_blank" rel="noreferrer" className="text-link text-ink underline decoration-paper-line underline-offset-4 hover:decoration-ink">
              PayPal activity<span className="sr-only"> (opens PayPal in a new tab)</span>
            </a>
          ) : (
            "PayPal activity"
          )}
          .
        </p>
      ) : (
        <p>PayPal emails you a receipt too.</p>
      )}
    </>
  );
  // When PayPal confirmed it: the stored payout's time once its stored status is Received (the status route records when
  // it changed), from the photo's arrival.
  const photosAt = claim.events.find((e) => e.type === "photos_received")?.at;
  const confirmed =
    claim.payout && payoutWords(claim.payout.status).tone === "pay" && photosAt ? Math.max(0, Math.round((Date.parse(claim.payout.updatedAt) - Date.parse(photosAt)) / 1000)) : null;
  // Every check passed (a paid claim's always have): they fold into one line first, then the receipt prints.
  const delay = arrive ? FOLD_MS : 0;
  return {
    title: <PaidTitle />,
    side: <ClaimPhotos urls={photoUrls} claimId={claim.id} read={readOf(claim)} />,
    fold: { arrive },
    next: (
      <>
        <Receipt
          amount={amount}
          recallId={recall.id}
          claimId={claim.id}
          account={account}
          payoutId={claim.payout?.batchId}
          sentAt={sentAt}
          took={secondsBetween(claim.events, "photos_received", "payout_sent")}
          confirmed={confirmed}
          arrive={arrive}
          delay={delay}
          foot={foot}
        />
        {arrive && <BringIntoView id="receipt" title="result-title" after={delay} />}
        {/* The last step the notice asks of the owner, once the money is sent: nothing left to do but this. */}
        {cutInHalf(recall.spec) && (
          <p className={clsx("text-ui text-pretty text-muted", arrive && styles.later)} style={{ ["--feed-delay" as string]: `${delay}ms` }}>
            You&rsquo;re done. Throw both halves away so no one uses them again.
          </p>
        )}
        {/* The way on comes in once the receipt is out, so the paper is the only thing moving. */}
        {sample && (
          <div className={clsx(arrive && styles.later)} style={{ ["--feed-delay" as string]: `${delay}ms` }}>
            <DemoActions sample={sample} slug={recall.slug} againHref={againHref} round={round} />
          </div>
        )}
      </>
    ),
  };
}

/* ------------------------------------------------------------------------------------------------ Held */

function heldParts({ claim, recall, photoUrls, againHref, sample, round }: ResultProps, six: SixRow[]): Parts {
  const reasons = decidingReasons(claim);
  const submitted = claim.events.find((e) => e.type === "photos_received")?.at ?? claim.createdAt;
  const company = companyName(recall);
  const nb = company.replace(/ /g, "\u00a0");
  // The owner asked a person to look at a claim the rule refused: this screen is the confirmation.
  const asked = reviewAsked(claim) ? (claim.events.find((e) => e.type === "review_requested")?.at ?? submitted) : null;
  // The photos passed and only the payout failed: nothing waits on the photos, a person sends the refund.
  const payout = asked ? null : payoutHold(claim);
  const unanswered = noModelAnswer(claim.decision, claim.reasons);
  const by = businessDaysAfter(asked ?? submitted, 2);
  const refund = money(recall.refund);
  // What's wrong, once: the checks that need a person, in the rows' own words.
  const unsure = six.filter((r) => r.key !== "refund" && r.state === "hold" && r.detail).map((r) => sentence(r.detail!));
  const lead = payout
    ? `${payout === "network" ? "Remedy couldn’t reach PayPal to send it." : "PayPal didn’t accept the transfer."}${payout === "refused" ? " If your PayPal account shows a notice, sort it out there." : ""}`
    : unanswered
      ? "We couldn’t finish the photo check, so a person will look at your photos instead."
      : asked
        ? `You asked for a review. ${reasons.filter((r) => r.outcome === "reject").map((r) => sentence(refusalHeadline({ ...claim, decision: "rejected", reasons: [r] }, recall.spec))).join(" ")}`
        : [...new Set(unsure)].join(" ") || "Some of the checks need a person to look.";
  // What happens next, in true facts only: who decides, by when, and how the money would arrive.
  const next = payout
    ? `A person at ${company} sends ${refund} by ${by}. Nothing has been paid yet, and PayPal emails you when it arrives.`
    : `${company} decides by ${by}. If they approve it, PayPal sends you ${refund} and emails you.`;
  return {
    title: payout ? `Your photos passed. ${nb} will send your refund` : <>A person at {nb} will check this claim</>,
    lead,
    side: <ClaimPhotos urls={photoUrls} claimId={claim.id} read={readOf(claim)} />,
    meta: true,
    next: (
      <>
        {/* Right under the checks, whose last hairline is above it: no rule of its own. */}
        <p className="text-body text-pretty text-muted">{next}</p>
        {sample && <DemoActions sample={sample} slug={recall.slug} againHref={againHref} round={round} unanswered={unanswered} />}
      </>
    ),
  };
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
  // The catch at a glance: the characters that differ, marked in both lines (the tag's in red), and said in words.
  const marked = (side: "seen" | "yours") =>
    seen.cells.map((c, i) =>
      c.same ? (
        c[side]
      ) : (
        <span key={i} className={clsx("underline decoration-2 underline-offset-[5px]", side === "seen" ? "text-stop decoration-stop" : "decoration-text-2")}>
          {c[side]}
        </span>
      ),
    );
  // A demo claim's photo whose tag is known: the tag itself, enlarged. On a laptop under the photo it was cut from; on a
  // phone after the checks, the column's full width.
  const tag = sample && lead === "code" && seen.readable ? SAMPLE_COPY[sample.id]?.tag : undefined;
  const tagRead = claim.verdict?.label.text_seen || seen.cells.map((c) => c.seen).join("");
  // What we saw and what's wrong, in one or two sentences: the deciding reason first, then any other, each once.
  const first = reviewed ? (
    `${asked ? "You asked for a review, and" : "Your claim was held for a person, and"} ${company} refused it: ${reasons[0]?.text ?? ""}`
  ) : lead === "code" ? (
    seen.readable ? (
      // Two lines, read against each other: what the tag says, then what it should say.
      <>
        <span className="block">
          The tag in your photo reads <span className="font-mono whitespace-nowrap">{marked("seen")}</span>.
        </span>
        <span className="block">
          Your claim&rsquo;s code is <span className="font-mono whitespace-nowrap">{marked("yours")}</span>.
        </span>
        {/* The difference in words, so O and 0 (or a P and a Q) can't be mistaken: for everyone, not only a screen reader. */}
        <span className="mt-1 block text-ui text-muted">{seen.caption}</span>
      </>
    ) : (
      <>
        We couldn&rsquo;t read a code on the tag. Your claim&rsquo;s code is <span className="font-mono whitespace-nowrap">{claim.code}</span>.
      </>
    )
  ) : lead === "session" ? (
    // The row under it says this photo came from outside the camera: the lead says the rule, once.
    "Only photos taken in this claim’s camera, within 10 minutes of its code, count."
  ) : lead === "duplicate_photo" ? (
    // The row and the pair beside it carry the earlier claim's number: said there, once.
    duplicate?.earlier ? (
      `A photo can be claimed once, and ${these === "This photo was" ? "this one already was" : "these already were"}.`
    ) : (
      `${these} already sent with ${duplicate ? "another PayPal account’s claim" : "another claim"}.`
    )
  ) : (
    sentence(refusalHeadline(claim, recall.spec))
  );
  const rest = reviewed ? [] : reasons.slice(1).map((r: Reason) => sentence(refusalHeadline({ ...claim, reasons: [r] }, recall.spec)));
  // What to do differently, said once: never a sentence that only repeats the button under it ("Start a new claim"), and
  // never the review's terms, which sit under its own button. When starting over can't help (a second claim from one
  // account), only that reason's advice applies. A photo taken as a screen keeps its advice beside the ask: retaking it
  // in better light is the other way on.
  const advice = reviewed
    ? []
    : appeal
      ? lead === "screen"
        ? [adviceFor("screen")]
        : []
      : lead === "code"
        ? ["Next time, write the code large and clear, in marker."]
        : lead === "session" || lead === "duplicate_photo"
          ? []
          : [...new Set((retry ? reasons : reasons.filter((r) => !canRetry([r]))).map((r) => adviceFor(r.check)))];
  const adviceText = advice.map((a) => (
    <p key={a} className="text-body text-pretty text-text">
      {a}
    </p>
  ));
  const pair = lead === "duplicate_photo" && photoUrls[0] && duplicate?.earlier ? <DuplicatePair claimId={claim.id} photoUrls={photoUrls} earlier={duplicate.earlier} n={duplicate.photo} /> : null;
  const actions = Boolean(earlier || appeal || (!sample && retry && !reviewed) || sample);
  return {
    title: reviewed ? `A person at ${company} looked at this and refused it` : "We couldn’t pay this claim",
    lead: (
      <>
        {first}
        {rest.length > 0 && ` ${rest.join(" ")}`}
      </>
    ),
    // A laptop: the evidence where the photo was. A repost's photo beside the earlier one, or the photo whole (and its
    // tag enlarged under it, at the photo's width).
    side: pair ?? (
      <>
        <ClaimPhotos urls={photoUrls} claimId={claim.id} read={readOf(claim)} />
        {tag && <TagCrop src={tag} read={tagRead} style={{ width: photoWidth(2 / 3) }} />}
      </>
    ),
    under: pair,
    photosShown: Boolean(pair),
    meta: true,
    next: (advice.length > 0 || actions) && (
      <>
        {!sample && !appeal && adviceText}
        {tag && <TagCrop src={tag} read={tagRead} className={NARROW_ONLY} />}
        {/* The demo's refusal answers the fair question, what a genuine owner who slipped can do, in the product's terms:
            no button of its own, since the demo's next step is the next claim. */}
        {sample && lead === "code" && (
          <p className="text-ui text-pretty text-muted">
            Wrote a character wrong? A new claim gives you a new code. When a tag is hard to read, you can ask a person at {company} to look at your photos, once.
          </p>
        )}
        {earlier && (
          <Button href={`/r/${recall.slug}/claim/${earlier}`} size="lg" block prefetch={false}>
            {duplicate?.earlier?.id === earlier ? "See your earlier claim" : `See your claim ${earlier}`}
          </Button>
        )}
        {/* An uncertain read: asking a person leads, since starting over means a new tag and new photos. */}
        {appeal && (
          <form action={`/api/claims/${claim.id}/review`} method="post" className="flex flex-col gap-2">
            <Button type="submit" size="lg" block>
              Ask a person to look
            </Button>
            <p className="text-ui text-pretty text-muted">
              {misread ? (
                <>
                  If your tag says <span className="font-mono">{claim.code}</span>, a person at {company} decides from your photos. You can ask once.
                </>
              ) : (
                `A person at ${company} decides from your photos. You can ask once.`
              )}
            </p>
          </form>
        )}
        {!sample && appeal && adviceText}
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
 * A repost of this account's own photo: this claim's photo beside the earlier claim's, each with its own claim id, both
 * whole. Another account's claim shows neither its photo nor its id, so it gets no pair: this claim's photo alone.
 */
function DuplicatePair({ claimId, photoUrls, earlier, n }: { claimId: string; photoUrls: string[]; earlier: NonNullable<Duplicate["earlier"]>; n: number }) {
  // Each photo at its own shape, edge to edge in a hairline: no frame of empty bands around it.
  const photo = "block h-auto w-full rounded-control bg-surface-2 ring-1 ring-line";
  return (
    <figure className="grid grid-cols-2 items-start gap-3">
      <div className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrls[n - 1] ?? photoUrls[0]} alt={`Photo ${n} of this claim, ${claimId}`} className={photo} />
        <span className="text-ui text-muted">This claim</span>
      </div>
      <div className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={earlier.src} alt={`Photo ${earlier.n} of the earlier claim ${earlier.id}, the same picture`} className={photo} />
        <span className="text-ui text-muted">
          Claimed before as <span className="font-mono whitespace-nowrap">{earlier.id}</span>
        </span>
      </div>
    </figure>
  );
}

/**
 * The tag in the claim's photo, enlarged (about three times the photo beside the checks), so the code that stopped the
 * claim can be read without squinting: cut from the photo's full-size original, never the photo blown up. The column's
 * full width at 2:1; on a laptop the photo's width, under it.
 */
function TagCrop({ src, read, className, style }: { src: string; read: string; className?: string; style?: CSSProperties }) {
  return (
    <figure className={clsx("flex w-full max-w-full flex-col gap-2", className)} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`Tag reading ${read}`} width={800} height={400} className="block aspect-[2/1] h-auto w-full rounded-card bg-surface-2 object-cover ring-1 ring-line" />
      <figcaption className="text-ui text-muted">The tag in your photo, enlarged</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------------------------------ Demo */

/** A form that files a demo claim and lands on its photo step (POST /api/claims, as the picker does). */
function RunSample({ slug, sample, children, secondary }: { slug: string; sample: string; children: ReactNode; secondary?: boolean }) {
  return (
    <form action="/api/claims" method="post">
      <input type="hidden" name="recall" value={slug} />
      <input type="hidden" name="sample" value={sample} />
      <SubmitButton variant={secondary ? "secondary" : "primary"} size={secondary ? "md" : "lg"} block>
        {children}
      </SubmitButton>
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
            Try this claim again
          </RunSample>
        ) : next ? (
          // Named, so the button says where it goes: the next claim, not this one again.
          <RunSample slug={slug} sample={next.id}>
            Next claim: {sampleTitle(next.id, next.title).toLowerCase()}
          </RunSample>
        ) : (
          <Button href={againHref} size="lg" block native>
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
        // Back to the four, as the camera's bar says it: a back arrow, on the left.
        <Button href={againHref} variant="tertiary" size="sm" native arrow={false}>
          <span className="inline-flex items-center gap-1.5">
            <ArrowLeftIcon className="shrink-0" /> All four claims
          </span>
        </Button>
      )}
    </div>
  );
}
