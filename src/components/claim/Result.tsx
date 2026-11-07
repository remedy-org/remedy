import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { Button, CheckIcon, CrossIcon, Money, NoBreakHyphens, Paper, Stamp, StatusPill, statusLabel } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import type { Claim, Recall } from "@/lib/types";
import { CheckList } from "./CheckList";
import { EvidenceText } from "./EvidenceText";
import { ExhibitPhoto, SampleChip, StepTitle } from "./Exhibit";
import styles from "./flow.module.css";
import { FocusTitle } from "./FocusTitle";
import { WithJudges } from "./Judges";
import {
  adviceFor,
  businessDaysAfter,
  canRetry,
  clock,
  codeDiff,
  companyName,
  decidingReasons,
  maskPayer,
  money,
  refusalHeadline,
  secondsBetween,
  stamp,
  type CheckRow,
} from "./model";
import { ReceiptLive } from "./ReceiptLive";
import { nextSample, Scoreboard, scoreLine, type RoundRun } from "./Scoreboard";

export interface PayoutLive {
  /** PayPal's status: live from getPayoutStatus, or the last one stored if PayPal couldn't be reached. */
  status: string | null;
  /** false: PayPal didn't answer just now; the status shown is the stored one. */
  fresh: boolean;
  /** The receipt keeps asking (a payout sent in the last 10 minutes that hasn't settled). */
  live?: boolean;
}

/** A demo claim's place in this browser's demo round: what ran, and what to run next. */
export interface DemoRound {
  runs: RoundRun[];
}

export interface ResultProps {
  claim: Pick<Claim, "id" | "decision" | "reasons" | "payout" | "events" | "payerId" | "payerVerified" | "createdAt" | "code" | "verdict" | "photos">;
  recall: Recall;
  rows: CheckRow[];
  photoUrls: string[];
  payout?: PayoutLive;
  /** Starts over: a new real claim, or the demo's sample picker. */
  againHref: string;
  sample?: DemoSample | null;
  /** Demo: this round's runs, for the scoreboard and "Next sample". */
  round?: DemoRound | null;
  /** The server's clock at render (ms): the receipt prints only for a claim decided under a minute ago. */
  now?: number;
  /** The step meter, above the result. */
  meter?: ReactNode;
  /** Payouts go to PayPal's sandbox in this build: every amount is labelled sandbox money, sample or not. */
  sandbox?: boolean;
}

// The judges' rail on a result, one note per outcome: what the rule did with this claim and whether money moved.
const RESULT_NOTES: Partial<Record<Claim["decision"], string>> = {
  paid: "Every check passed, so the rule paid it: PayPal Payouts sent the refund in sandbox money.",
  held: "The rule held it for a person at the company. No payout is sent unless they approve it.",
  rejected: "The rule refused it on the model's quoted reading. No payout was attempted.",
  blocked: "A check with no AI stopped it before the model saw the photo. No payout was attempted.",
};

/** The end of a claim, as a paper object: a receipt when paid; a sheet with the evidence when held or refused. */
export function Result(props: ResultProps) {
  const { sample } = props;
  const body = props.claim.decision === "paid" ? <Paid {...props} /> : props.claim.decision === "held" ? <Held {...props} /> : <Refused {...props} />;
  return (
    <WithJudges
      demo={Boolean(sample)}
      step="result"
      note={RESULT_NOTES[props.claim.decision]}
      extra={sample && <JudgeVerdict sample={sample} decision={props.claim.decision} round={props.round} claimId={props.claim.id} />}
    >
      <FocusTitle id="result-title" />
      {props.meter && <div className="mx-auto mb-6 w-full max-w-claim">{props.meter}</div>}
      {body}
    </WithJudges>
  );
}

/* ------------------------------------------------------------------------------------------------ Paid */

function Paid({ claim, recall, rows, photoUrls, payout, againHref, sample, round, now, sandbox }: ResultProps) {
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
              Paid {took} s after your photo
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
          {sentAt && <ReceiptRow label="Sent">{stamp(sentAt)}</ReceiptRow>}
          <ReceiptRow label="PayPal account" mono>
            {maskPayer(claim.payerId)}
            {claim.payerVerified ? " · verified" : ""}
          </ReceiptRow>
          {claim.payout && (
            <ReceiptRow label="PayPal batch" mono>
              {claim.payout.batchId}
            </ReceiptRow>
          )}
          <ReceiptRow label="Recall">CPSC {recall.id}</ReceiptRow>
        </dl>
        {payout && !payout.fresh && <p className="mt-3 text-ui text-ink-muted">PayPal didn&apos;t answer just now, so this is the last status we saved.</p>}
        {!sb && <p className="mt-3 text-ui text-ink-muted">PayPal emails you a receipt too.</p>}
      </Paper>

      {sample && <DemoActions sample={sample} againHref={againHref} round={round} />}
      <Evidence rows={rows} photoUrls={photoUrls} sample={Boolean(sample)} summary={passedSummary(rows)} open={false} code={claim.code} />
    </section>
  );
}

function ReceiptRow({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-paper-line py-3 text-ui last:border-b-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className={clsx("min-w-0 truncate text-right text-ink", mono && "font-mono")}>{children}</dd>
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
  return (
    <section aria-labelledby="result-title" className="mx-auto flex w-full max-w-claim flex-col gap-6">
      <Top status={<StatusPill status="held" label={sb ? "Held · sandbox" : "Held"} />} id={claim.id} />
      <StepTitle id="result-title">A person at {company.replace(/ /g, "\u00a0")} will look at this</StepTitle>

      <Paper variant="sheet" padding="lg">
        <span className="absolute top-6 right-6">
          <Stamp tone="hold" land={0}>
            Held for review
          </Stamp>
        </span>
        <p className="font-mono text-micro tracking-[0.06em] text-ink-muted uppercase">Claim {claim.id}</p>
        <p className="mt-6 text-body font-semibold text-ink">Nothing is lost.</p>
        <p className="mt-1 max-w-[34ch] text-body text-ink-muted">
          Your claim is saved. If {company} approves it, {money(recall.refund)} goes to your PayPal account{sb ? " in sandbox money" : " and PayPal emails you"}.
        </p>

        <ol aria-label="What happens next" className="relative mt-6 flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[3.5px] before:w-px before:bg-paper-line">
          <TimelineRow state="done" label="Photos received" time={clock(submitted)} />
          {checked && <TimelineRow state="done" label="Checks run" time={clock(checked)} />}
          <TimelineRow state="now" label="Waiting for a person" />
          <TimelineRow state="next" label={`Decision by ${businessDaysAfter(submitted, 2)}`} />
        </ol>

        {reasons.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 border-t border-dashed border-paper-line pt-4">
            <h3 className="font-mono text-micro tracking-[0.06em] text-ink-muted uppercase">What they&apos;ll look at</h3>
            <Reasons reasons={reasons} rows={rows} summary={claim.verdict?.summary} />
          </div>
        )}

        <dl className="mt-6 border-t border-dashed border-paper-line">
          <ReceiptRow label="Refund if approved">
            {money(recall.refund)}
            {sb ? " sandbox" : ""}
          </ReceiptRow>
          <ReceiptRow label="Photos sent">{stamp(submitted)}</ReceiptRow>
          <ReceiptRow label="Your code" mono>
            {claim.code}
          </ReceiptRow>
        </dl>
      </Paper>

      {sample && <DemoActions sample={sample} againHref={againHref} round={round} />}
      <Evidence rows={rows} photoUrls={photoUrls} sample={Boolean(sample)} summary={`Every check, and the ${photoUrls.length === 1 ? "photo" : "photos"} you sent`} open={Boolean(sample)} code={claim.code} />
    </section>
  );
}

function TimelineRow({ state, label, time }: { state: "done" | "now" | "next"; label: string; time?: string }) {
  return (
    <li className="relative grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center text-ui">
      <span
        aria-hidden="true"
        className={clsx("relative size-2 rounded-full", state === "done" ? "bg-pay-ink" : state === "now" ? clsx("bg-hold-ink text-hold-ink", styles.pulse) : "border border-ink-muted bg-paper")}
      />
      <span className={state === "next" ? "font-medium text-ink" : state === "now" ? "text-ink" : "text-ink-muted"}>{label}</span>
      {time && <span className="font-mono text-micro text-ink-muted tabular-nums">{time} UTC</span>}
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
              {quote && <span className="border-l border-paper-line pl-3 font-mono text-micro leading-relaxed text-ink-muted">&ldquo;{quote}&rdquo;</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------------------------------------- Refused */

function Refused({ claim, recall, rows, photoUrls, againHref, sample, round }: ResultProps) {
  const blocked = claim.decision === "blocked";
  const reasons = decidingReasons(claim);
  const retry = canRetry(reasons);
  const company = companyName(recall);
  const lead = reasons[0]?.check;
  const reviewed = lead === "review";
  // When starting over can't help (a second claim from one account), only that reason's advice applies: advice to
  // start a new claim would lead to the same refusal.
  const advice = reviewed ? [] : [...new Set((retry ? reasons : reasons.filter((r) => !canRetry([r]))).map((r) => adviceFor(r.check)))];
  const one = photoUrls.length === 1;
  const headline = reviewed ? `A person at ${company} looked at this and refused it` : refusalHeadline(claim, recall.spec);
  return (
    <section aria-labelledby="result-title" className="mx-auto flex w-full max-w-claim flex-col gap-6">
      <Top status={<StatusPill status={blocked ? "blocked" : "rejected"} />} id={claim.id} />
      <div className="flex flex-col gap-3">
        <StepTitle id="result-title">{headline}</StepTitle>
        <p className="text-body text-muted">
          {blocked
            ? "Some claims are refused before any photo reaches the model. No refund was sent."
            : reviewed
              ? "Your claim was held for a person, who refused it for the reason below. No refund was sent."
              : `The photo check read your ${one ? "photo" : "photos"} and one of its answers rules the claim out. No refund was sent.`}
        </p>
      </div>

      {lead === "code" && <CodeDiff code={claim.code} seen={claim.verdict?.challenge_code.text_seen} />}
      {lead === "session" && <Provenance claim={claim} />}
      {lead === "duplicate_photo" && photoUrls[0] && <DuplicatePair src={photoUrls[0]} sample={Boolean(sample)} />}

      <Paper variant="sheet" padding="lg">
        <div className="flex items-start justify-between gap-4">
          <p className="font-mono text-micro tracking-[0.06em] whitespace-nowrap text-ink-muted uppercase">Verdict · {claim.id}</p>
          <Stamp tone="neutral" land={0}>
            Not paid
          </Stamp>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          {photoUrls[0] && lead !== "duplicate_photo" && (
            <ExhibitPhoto src={photoUrls[0]} alt={`Exhibit A: the ${sample ? "sample" : "first"} photo of claim ${claim.id}`} sample={false} frame="aspect-[3/4]" className="w-32 self-start sm:w-auto" />
          )}
          <div className={clsx("flex min-w-0 flex-col gap-3", (lead === "duplicate_photo" || !photoUrls[0]) && "sm:col-span-2")}>
            <h3 className="font-mono text-micro tracking-[0.06em] text-ink-muted uppercase">{reasons.length > 1 ? "The reasons" : "The reason"}</h3>
            <Reasons reasons={reasons} rows={rows} />
            {sample && photoUrls[0] && lead !== "duplicate_photo" && <p className="text-ui text-ink-muted">Exhibit A is an AI-made sample photo.</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-1.5 border-t border-dashed border-paper-line pt-4">
          <h3 className="font-mono text-micro tracking-[0.06em] text-ink-muted uppercase">How this was decided</h3>
          <p className="text-ui text-ink">
            {reviewed
              ? `The photo check held this claim for a person, and a person at ${company} refused it.`
              : `${blocked ? "These checks need no AI and run before the model sees anything." : "The model only describes the photo."} A fixed rule, the same for every claim, made this call. Nobody at ${company} chose it.`}
          </p>
        </div>
      </Paper>

      {!sample && advice.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="micro text-faint">What to do</h3>
          <ol className="flex flex-col gap-2">
            {advice.map((a, i) => (
              <li key={a} className="grid grid-cols-[2rem_minmax(0,1fr)] text-body text-text">
                <span className="font-mono text-micro leading-[1.6rem] text-faint">{String(i + 1).padStart(2, "0")}</span>
                {a}
              </li>
            ))}
          </ol>
        </div>
      )}
      {!sample && retry && !reviewed && (
        <Button href={againHref} size="lg" block prefetch={false}>
          Start a new claim (new code)
        </Button>
      )}

      {sample && <DemoActions sample={sample} againHref={againHref} round={round} />}
      {/* The verdict sheet above already shows Exhibit A and the deciding quote; the rest of the checks wait folded. */}
      <Evidence rows={rows} photoUrls={photoUrls} sample={Boolean(sample)} summary={otherSummary(rows)} open={false} code={claim.code} />
    </section>
  );
}

/** The signature refusal: the claim's code beside what the model read on the tag, the differing cell in --stop. */
function CodeDiff({ code, seen }: { code: string; seen: string | null | undefined }) {
  const { cells, caption, readable } = codeDiff(code, seen);
  const spoken = `Your code ${code.split("").join(", ")}. ${readable ? `Read on the tag ${cells.map((c) => c.seen || "nothing").join(", ")}.` : "Nothing readable on the tag."} ${caption}`;
  const cell = "flex h-13 w-11 items-center justify-center rounded-control font-mono text-[1.75rem] leading-none font-semibold";
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
            Code <span className="font-mono">{claim.code}</span> issued{issued ? <span className="font-mono"> {clock(issued)}</span> : null}
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

/** A repost: the photo sent, beside the claim that already has it. Nothing about the other claim but that it exists. */
function DuplicatePair({ src, sample }: { src: string; sample: boolean }) {
  return (
    <figure className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-center gap-6">
        {["Your photo", "Already claimed"].map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-2.5">
            <ExhibitPhoto src={src} alt={i ? "The same photo, in an earlier claim" : "The photo you sent"} letter={i ? "B" : "A"} frame="aspect-[3/4]" className="w-30" />
            <span className="micro text-faint">{label}</span>
          </div>
        ))}
      </div>
      <figcaption className="flex flex-col gap-2 text-ui text-muted">
        <span>The same picture is already in another claim, so a second refund can&apos;t be paid for it.</span>
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
  const pre = count(rows, "pre");
  const model = count(rows, "model");
  // "Five checks" on the homepage: the ones with no AI, then the photo check, whose answers are listed one per row.
  return `All checks passed · ${pre} with no AI · the photo check: ${model} of ${model} answers`;
}

function otherSummary(rows: CheckRow[]): string {
  const passed = rows.some((r) => r.group !== "pay" && r.state === "pass");
  return passed ? "Everything else passed · every check" : "Every check";
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
    <details className="group rounded-card border border-line bg-surface" open={open}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 px-4 py-3 text-ui font-medium text-text sm:px-5 [&::-webkit-details-marker]:hidden">
        {photoUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrls[0]} alt="" className="size-16 shrink-0 rounded-[4px] bg-paper object-cover p-[2px]" />
        )}
        <span className="flex-1">{summary}</span>
        <span className="micro text-faint group-open:hidden">Show evidence</span>
        <span className="micro hidden text-faint group-open:inline">Hide</span>
      </summary>
      <div className="flex flex-col gap-6 border-t border-line p-4 sm:p-5">
        {photoUrls.length > 0 && (
          <div className={clsx("grid gap-5", photoUrls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {photoUrls.map((src, i) => (
              // /demo holds only AI-made samples (a dev preview's stand-ins too): any photo from there carries the label.
              <ExhibitPhoto key={`${src}-${i}`} src={src} alt={`Photo ${i + 1} of this claim`} letter={String.fromCharCode(65 + i)} sample={sample || src.startsWith("/demo/")} />
            ))}
          </div>
        )}
        <CheckList rows={rows} code={code} />
      </div>
    </details>
  );
}

/** Demo results: the next sample in the guided order is the primary action. */
function DemoActions({ sample, againHref, round }: { sample: DemoSample; againHref: string; round?: DemoRound | null }) {
  const runs = round?.runs ?? [];
  const next = nextSample(runs, sample.id);
  const { ran, expected, text } = scoreLine(runs);
  return (
    <div className="flex flex-col gap-3">
      {next ? (
        <Button href={`${againHref}?sample=${next.id}`} size="lg" block prefetch={false}>
          Next sample: {next.title}
        </Button>
      ) : (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-ui text-text">
          {ran === 4 ? `All 4 run · ${expected} of 4 as expected.` : text} Run them again for the same outcomes.
        </p>
      )}
      <Button href={againHref} variant="secondary" block prefetch={false}>
        {next ? "Choose another sample" : "Back to the samples"}
      </Button>
    </div>
  );
}

/** The judges' rail on a demo result: what should have happened, what did, this round's score, the console. */
function JudgeVerdict({ sample, decision, round, claimId }: { sample: DemoSample; decision: Claim["decision"]; round?: DemoRound | null; claimId: string }) {
  const ok = decision === sample.expect;
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-ui">
        <dt className="micro text-faint">Expected</dt>
        <dd>
          <StatusPill status={sample.expect} label={statusLabel(sample.expect)} />
        </dd>
        <dt className="micro text-faint">Got</dt>
        <dd className="flex items-center gap-2 whitespace-nowrap">
          <StatusPill status={decision} />
          <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap", ok ? "text-pay" : "text-stop")}>
            {ok ? <CheckIcon size={14} /> : <CrossIcon size={14} />}
            {ok ? "As expected" : "Not as expected"}
          </span>
        </dd>
      </dl>
      <p className="text-ui text-muted">
        <NoBreakHyphens>{sample.description}</NoBreakHyphens>
      </p>
      {round && <Scoreboard runs={round.runs} />}
      <Button href={`/console?claim=${claimId}`} variant="tertiary" size="sm" prefetch={false} className="self-start">
        See this claim in Kikea Store&apos;s console
      </Button>
    </div>
  );
}
