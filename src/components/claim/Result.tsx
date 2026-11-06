import clsx from "clsx";
import type { ReactNode } from "react";
import { Button, Card, CrossIcon, ExhibitLabel, HoldIcon, StatusPill, BlockIcon } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import type { Claim, Recall } from "@/lib/types";
import { CheckList } from "./CheckList";
import { EvidenceText } from "./EvidenceText";
import { adviceFor, canRetry, companyName, decidingReasons, maskPayer, money, payoutWords, secondsBetween, stamp, type CheckRow, type Tone } from "./model";

export interface PayoutLive {
  /** PayPal's status: live from getPayoutStatus, or the last one stored if PayPal couldn't be reached. */
  status: string | null;
  /** false: PayPal didn't answer just now; the status shown is the stored one. */
  fresh: boolean;
}

export interface ResultProps {
  claim: Pick<Claim, "id" | "decision" | "reasons" | "payout" | "events" | "payerId" | "payerVerified" | "createdAt" | "code">;
  recall: Recall;
  rows: CheckRow[];
  photoUrls: string[];
  payout?: PayoutLive;
  /** Starts over: a new real claim, or the demo's sample picker. */
  againHref: string;
  sample?: DemoSample | null;
}

/** The end of a claim: a Checkout-style receipt when paid; otherwise what happens next and why. */
export function Result(props: ResultProps) {
  switch (props.claim.decision) {
    case "paid":
      return <Paid {...props} />;
    case "held":
      return <Held {...props} />;
    default:
      return <Refused {...props} />;
  }
}

function Paid({ claim, recall, rows, photoUrls, payout, againHref, sample }: ResultProps) {
  const words = payoutWords(payout?.status ?? claim.payout?.status);
  const sentAt = claim.events.find((e) => e.type === "payout_sent")?.at ?? claim.payout?.updatedAt;
  const took = secondsBetween(claim.events, "photos_received", "payout_sent");
  return (
    <Card padding="none" as="section" aria-labelledby="result-title">
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <Top status={<StatusPill status="paid" label={sample ? "Paid · sandbox" : "Paid"} />} id={claim.id} />
        <div className="flex items-end justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-2">
            <p id="result-title" className="text-h1 font-semibold tabular-nums">
              {money(recall.refund)}
            </p>
            <p className="text-body text-muted">
              Refunded to your PayPal account by {companyName(recall)}
              {sample ? ", in sandbox money" : ""}.
            </p>
          </div>
          {photoUrls[0] && <Thumb src={photoUrls[0]} />}
        </div>
      </div>
      <Rows>
        <Row label="Payout status">
          <span className="inline-flex items-center gap-2">
            <Dot tone={words.tone} />
            {words.label}
          </span>
        </Row>
        {sentAt && <Row label="Sent">{stamp(sentAt)}</Row>}
        {took !== null && <Row label="Photos to payout">{took} seconds</Row>}
        <Row label="PayPal account" mono>
          {maskPayer(claim.payerId)}
          {claim.payerVerified ? " · verified" : ""}
        </Row>
        {claim.payout && (
          <Row label="PayPal batch" mono>
            {claim.payout.batchId}
          </Row>
        )}
        <Row label="Recall">CPSC {recall.id}</Row>
      </Rows>
      <div className="flex flex-col gap-4 border-t border-line p-6 sm:p-8">
        <p className="text-ui text-muted">
          {payout && !payout.fresh ? "PayPal didn't answer just now, so this is the last status we saved. " : ""}
          {words.note} PayPal also emails you a receipt.
        </p>
        <Evidence rows={rows} photoUrls={photoUrls} summary={`All ${rows.length} checks passed`} />
        {sample && <DemoFooter sample={sample} againHref={againHref} />}
      </div>
    </Card>
  );
}

function Held({ claim, recall, rows, photoUrls, againHref, sample }: ResultProps) {
  const reasons = decidingReasons(claim);
  const submitted = claim.events.find((e) => e.type === "photos_received")?.at ?? claim.createdAt;
  return (
    <Card padding="none" as="section" aria-labelledby="result-title">
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <Top status={<StatusPill status="held" />} id={claim.id} />
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-3">
            <h2 id="result-title" className="text-h2 font-semibold text-balance">
              A person will look at your claim
            </h2>
            <p className="text-body text-muted">
              It&apos;s saved and nothing is lost. {companyName(recall)}&apos;s recall team reviews held claims within 2 business days. If they approve it, {money(recall.refund)} goes
              to your PayPal account and PayPal emails you.
            </p>
          </div>
          {photoUrls[0] && <Thumb src={photoUrls[0]} className="hidden sm:flex" />}
        </div>
        <Reasons title="What they'll look at" tone="hold" items={reasons.map((r) => r.text)} />
      </div>
      <Rows>
        <Row label="Refund if approved">{money(recall.refund)}</Row>
        <Row label="Photos sent">{stamp(submitted)}</Row>
        <Row label="Your code" mono>
          {claim.code}
        </Row>
      </Rows>
      <div className="flex flex-col gap-4 border-t border-line p-6 sm:p-8">
        <Evidence rows={rows} photoUrls={photoUrls} summary={`Every check, and the ${photoUrls.length === 1 ? "photo" : "photos"} you sent`} />
        {sample && <DemoFooter sample={sample} againHref={againHref} />}
      </div>
    </Card>
  );
}

function Refused({ claim, rows, photoUrls, againHref, sample }: ResultProps) {
  const blocked = claim.decision === "blocked";
  const reasons = decidingReasons(claim);
  const retry = canRetry(reasons);
  const advice = [...new Set(reasons.map((r) => adviceFor(r.check)))];
  return (
    <Card padding="none" as="section" aria-labelledby="result-title">
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <Top status={<StatusPill status={blocked ? "blocked" : "rejected"} />} id={claim.id} />
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-3">
            <h2 id="result-title" className="text-h2 font-semibold text-balance">
              {blocked ? "Stopped before the photo check" : `${photoUrls.length === 1 ? "This photo doesn't" : "These photos don't"} prove the claim`}
            </h2>
            <p className="text-body text-muted">
            {blocked
              ? "Some claims are refused before any photo reaches the model. No refund was sent."
              : "The photo check read your photos and one of its answers rules the claim out. No refund was sent."}
            </p>
          </div>
          {photoUrls[0] && <Thumb src={photoUrls[0]} className="hidden sm:flex" />}
        </div>
        <Reasons title={reasons.length > 1 ? "The reasons" : "The reason"} tone="stop" icon={blocked ? <BlockIcon size={14} /> : <CrossIcon size={14} />} items={reasons.map((r) => r.text)} />
        {!sample && (
          <div className="flex flex-col gap-2">
            <h3 className="micro text-faint">What to do</h3>
            {advice.map((a) => (
              <p key={a} className="text-body text-text">
                {a}
              </p>
            ))}
          </div>
        )}
        {sample ? (
          <DemoFooter sample={sample} againHref={againHref} />
        ) : (
          retry && (
            <Button href={againHref} size="lg" block prefetch={false}>
              Start a new claim
            </Button>
          )
        )}
      </div>
      <div className="border-t border-line p-6 sm:p-8">
        <Evidence rows={rows} photoUrls={photoUrls} summary={`Every check, and the ${photoUrls.length === 1 ? "photo" : "photos"} you sent`} />
      </div>
    </Card>
  );
}

function Top({ status, id }: { status: ReactNode; id: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {status}
      <span className="font-mono text-ui text-faint">Claim {id}</span>
    </div>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <dl className="border-t border-line px-6 sm:px-8">{children}</dl>;
}

function Row({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-ui last:border-b-0">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={clsx("min-w-0 truncate text-right text-text tabular-nums", mono && "font-mono")}>{children}</dd>
    </div>
  );
}

const DOT: Record<Tone, string> = { pay: "bg-pay", hold: "bg-hold", stop: "bg-stop", muted: "bg-faint" };
function Dot({ tone }: { tone: Tone }) {
  return <span className={clsx("size-1.5 shrink-0 rounded-full", DOT[tone])} aria-hidden="true" />;
}

const REASON_TONE = { hold: "bg-hold-soft text-hold", stop: "bg-stop-soft text-stop" } as const;
function Reasons({ title, tone, icon, items }: { title: string; tone: "hold" | "stop"; icon?: ReactNode; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="micro text-faint">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((t) => (
          <li key={t} className="flex gap-3 rounded-control border border-line px-3 py-2.5">
            <span className={clsx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", REASON_TONE[tone])}>{icon ?? <HoldIcon size={12} />}</span>
            <span className="text-body text-text">
              <EvidenceText>{t}</EvidenceText>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The photos and every check, folded away: evidence next to the verdict, on request. */
function Evidence({ rows, photoUrls, summary }: { rows: CheckRow[]; photoUrls: string[]; summary: string }) {
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-ui font-medium text-text [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <span className="micro text-faint group-open:hidden">Show</span>
        <span className="micro hidden text-faint group-open:inline">Hide</span>
      </summary>
      <div className="flex flex-col gap-6 pt-4">
        {photoUrls.length > 0 && (
          <div className={clsx("grid gap-3", photoUrls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {photoUrls.map((src, i) => (
              <figure key={src} className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Photo ${i + 1} of this claim`} className="aspect-[4/3] w-full rounded-control border border-line object-cover" loading="lazy" />
                <ExhibitLabel as="figcaption" leaderLength={16}>
                  Exhibit {String.fromCharCode(65 + i)} · photo {i + 1}
                </ExhibitLabel>
              </figure>
            ))}
          </div>
        )}
        <CheckList rows={rows} />
      </div>
    </details>
  );
}

function DemoFooter({ sample, againHref }: { sample: DemoSample; againHref: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-surface-2 p-4">
      <p className="text-ui text-muted">
        <span className="font-medium text-text">What this sample is meant to show.</span> {sample.description}
      </p>
      <Button href={againHref} variant="secondary" block prefetch={false}>
        Try another sample
      </Button>
    </div>
  );
}

/** The first photo beside the verdict, labelled as the exhibit it is. */
function Thumb({ src, className }: { src: string; className?: string }) {
  return (
    <figure className={clsx("flex shrink-0 flex-col items-end gap-1.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Your first photo" className="aspect-[3/4] w-16 rounded-control border border-line object-cover sm:w-20" />
      <figcaption className="micro text-accent-text">Exhibit A</figcaption>
    </figure>
  );
}
