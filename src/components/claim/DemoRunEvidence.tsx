import type { DemoSample } from "@/lib/demo/samples";
import type { Claim } from "@/lib/types";
import { ModelQuote } from "./EvidenceText";

type DemoRunClaim = Pick<Claim, "id" | "code" | "decision" | "events" | "verdict" | "seeded">;

/** The existing claim record, not a separate attestation: never infer a model call from a verdict alone. */
export function DemoRunEvidence({ claim, sample }: { claim: DemoRunClaim; sample: DemoSample }) {
  if (claim.seeded) return null;
  const received = claim.events.find((e) => e.type === "photos_received");
  const prechecked = claim.events.find((e) => e.type === "prechecked" || e.type === "blocked");
  const checked = claim.events.find((e) => e.type === "checked");
  const replay = checked && /recorded answer|no model call/i.test(checked.detail);
  const model = replay
    ? "Local replay: the photo-model answer is simulated or recorded."
    : checked
      ? "A new photo-model response was saved for this claim."
      : claim.decision === "blocked"
        ? "A rule blocked this claim before the photo model ran."
        : "No photo-model response was recorded for this claim.";
  return (
    <section aria-label="About this demo result" className="flex flex-col gap-2 text-ui text-pretty text-muted">
      <p>Prepared AI-made photo. {model}</p>
      <details className="group/evidence border-y border-line">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-text outline-hidden hover:text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
          What ran on this claim
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 group-open/evidence:rotate-180">
            <path d="M4.5 6.5L8 10l3.5-3.5" />
          </svg>
        </summary>
        <div className="flex flex-col gap-4 pb-4">
          <p>
            {sample.code ? <>Code <span className="font-mono text-text">{claim.code}</span> is fixed for this prepared sample. </> : "This sample gets a newly issued code. "}
            The camera-session condition is simulated: the demo supplies {sample.liveSession ? "a matching" : "a deliberately mismatched"} session token, not a new camera capture.
          </p>
          <p>{sample.id === "genuine" ? "Photo matches and the one-claim-per-account rule compare only genuine claims within this browser’s demo round." : "The one-claim-per-account rule is skipped for this sample so one demo account can try all four claims. Photo matches are checked within this demo round."} The illustrated console claims are excluded.</p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2">
            <dt>Claim</dt>
            <dd className="font-mono text-text">{claim.id}</dd>
            {received && <><dt>Photo received</dt><dd className="min-w-0 break-words text-text"><EventTime iso={received.at} /></dd></>}
            {prechecked && <><dt>Pre-checks</dt><dd className="min-w-0 text-text">{prechecked.detail}<span className="mt-1 block text-muted"><EventTime iso={prechecked.at} /></span></dd></>}
            <dt>Photo model</dt>
            <dd className="min-w-0 text-text">
              {checked ? <>{checked.detail}<span className="mt-1 block text-muted"><EventTime iso={checked.at} /></span></> : claim.decision === "blocked" ? "Not run: stopped by a pre-check." : "No answer recorded."}
            </dd>
            {claim.verdict && <><dt>Code read</dt><dd className="font-mono text-text">{claim.verdict.challenge_code.text_seen ?? "No readable code returned"}</dd></>}
          </dl>
          {claim.verdict?.challenge_code.evidence && <p className="text-text-2">Photo-model evidence: &ldquo;<ModelQuote>{claim.verdict.challenge_code.evidence}</ModelQuote>&rdquo;</p>}
          <p>The photo model describes the evidence; Remedy’s rules decide the result. Reloading shows this claim’s saved result. Starting another claim runs the applicable checks for a new attempt.</p>
        </div>
      </details>
    </section>
  );
}

function EventTime({ iso }: { iso: string }) {
  return <time dateTime={iso} className="tabular-nums">{iso.replace("T", " ").replace(/Z$/, " UTC")}</time>;
}
