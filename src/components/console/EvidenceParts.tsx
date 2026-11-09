import type { ReactNode } from "react";
import type { DrawerClaim, PayoutFailureWords } from "@/app/console/_lib/drawer";
import { isPreCheck, typeset as typesetText } from "@/app/console/_lib/view";
import { ModelQuote } from "@/components/claim/EvidenceText";
import { CheckList } from "./CheckList";
import { formatClock, formatDayTime, PART_STATE } from "./format";
import { LinkedIds } from "./LinkedIds";
import { VerdictMark, verdictOf } from "./VerdictMark";

// The evidence panel's words, drawn by the console's panel (EvidenceDrawer.tsx) and by the homepage's picture of it
// (EvidenceStill.tsx) alike, so the two can't say one claim two ways. No hooks and no client-only imports: the homepage
// draws the still on the server too.

type PayoutFailure = PayoutFailureWords & { at: string; raw: string };

const REFUSED: PayoutFailureWords = { kind: "paypal", what: "PayPal didn’t take the payout", next: "Nothing was sent." };

/** A held claim whose last payout attempt failed: when, what happened in words (drawer.ts), and the raw answer for
 * support. The panel keeps saying so (and offers to try again) until a payout goes through; the history keeps it after. */
export function payoutFailure(claim: Pick<DrawerClaim, "decision" | "events">): PayoutFailure | null {
  if (claim.decision !== "held") return null;
  const last = [...claim.events].reverse().find((e) => e.type === "payout_failed" || e.type === "payout_sent");
  if (last?.type !== "payout_failed") return null;
  return { at: last.at, ...(last.failure ?? REFUSED), raw: last.raw ?? "" };
}

/** The decisions a reviewer acts on or answers for: their word is in full ink, the rest in the second. */
export const EXCEPTION = new Set<DrawerClaim["decision"]>(["held", "rejected", "blocked"]);

/** The header's verdict, in the grid's verdict track. */
export function ClaimVerdict({ claim }: { claim: Pick<DrawerClaim, "decision"> & { payout: { status: string } | null } }) {
  return <VerdictMark verdict={verdictOf({ decision: claim.decision, payoutStatus: claim.payout?.status ?? null })} className={EXCEPTION.has(claim.decision) ? "text-text" : undefined} />;
}

/** The header's second line: when it was filed, the payer's masked PayPal id ("Unverified" only when it's true, as in the
 * grid) and the claim's code. One line in the 440px panel, so the evidence keeps the height. */
export function HeaderMeta({ claim }: { claim: Pick<DrawerClaim, "createdAt" | "payer" | "verified" | "code"> }) {
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-ui text-muted">
      <span>{formatDayTime(claim.createdAt)}</span>
      <span>
        PayPal <span className="sr-only">account ending {claim.payer.slice(-4)}</span>
        {/* The bullets set as one tight group before the last four, never four wide mono cells. */}
        <span aria-hidden="true" className="font-mono">
          <span className="tracking-[-0.12em]">{claim.payer.slice(0, -5)}</span>
          {claim.payer.slice(-5)}
        </span>
        {!claim.verified && <span className="text-stop"> unverified</span>}
      </span>
      <span>
        Code <span className="font-mono text-text">{claim.code}</span>
      </span>
    </p>
  );
}

/** What a held claim's money waits on, as the timeline says it under "Sent": a claim the console starts with has no
 * payout behind it, so approving it records the decision (ReviewActions). Null for any other claim. */
export function heldNote(claim: Pick<DrawerClaim, "decision" | "seeded">): string | null {
  if (claim.decision !== "held") return null;
  return claim.seeded ? "Held: approve or reject it to record your decision." : "Held: nothing is sent until a person at the company approves.";
}

/** What decided a held or refused claim, in its own words: the reason, what it means, and the photo check's own words.
 * Null for any other claim. */
function decider(claim: DrawerClaim): { title: string; detail: string | null; evidence: string | null } | null {
  if (claim.decision !== "held" && claim.decision !== "rejected" && claim.decision !== "blocked") return null;
  // The newest thing that stopped the money leads: PayPal not taking the payout, or the checks run again on approve.
  const failure = payoutFailure(claim);
  const refused = claim.refused;
  if (failure && (!refused || failure.at > refused.at)) {
    return { title: failure.what, detail: `At ${formatClock(failure.at)} UTC. ${failure.next}`, evidence: null };
  }
  if (refused) {
    return {
      title: "Not paid on review",
      detail: `When it was approved at ${formatClock(refused.at)} UTC, Remedy checked again and didn’t send the payout: ${refused.text.charAt(0).toLowerCase()}${refused.text.slice(1)}.`,
      evidence: null,
    };
  }
  // A person rejected it: their reason, as the owner reads it, and who and when.
  if (claim.rejected) {
    return {
      title: "Rejected on review",
      detail: `${claim.rejected.by ?? "A person at the company"} rejected it at ${formatClock(claim.rejected.at)} UTC. The owner reads:`,
      evidence: claim.rejected.reason,
    };
  }
  // The rule refused it and the owner asked a person to look: their ask leads, then the check that refused it.
  if (claim.decision === "held" && claim.appealedAt) {
    const refused = claim.checks.find((c) => c.outcome === "reject");
    return {
      title: "The owner asked for a review",
      detail: `The rule refused it${refused ? ` on ${refused.label}: ${refused.rule.charAt(0).toLowerCase()}${refused.rule.slice(1).replace(/[.\s]+$/, "")}` : ""}. Nothing has been paid.`,
      evidence: refused?.evidence ?? null,
    };
  }
  const pre = claim.preChecks.find((p) => p.state === "reject" || p.state === "hold");
  const check = claim.checks.find((c) => c.outcome !== "pass");
  return { title: check?.rule ?? pre?.detail ?? claim.sentence, detail: null, evidence: check?.evidence ?? null };
}

/**
 * The panel's headline is the grid row's reason, word for word, in every state ("Tag reads K7Q · code is K7P"), so the
 * row and the panel never say one refusal two ways. What the row's line leaves out stays under it: a payout failure, a
 * review or an owner's ask says its own heading first in the detail; a check's full sentence is the check list's.
 * `rule` is the decider's own heading, which the check list's "see above" matches.
 */
export function deciding(claim: DrawerClaim): { title: string; detail: string | null; evidence: string | null; rule: string } | null {
  const d = decider(claim);
  if (!d) return null;
  if (!claim.note || claim.note === d.title) return { ...d, rule: d.title };
  const own = d.detail !== null && !claim.note.startsWith(d.title);
  return { title: claim.note, detail: own ? `${d.title.replace(/[.\s]+$/, "")}. ${d.detail}` : d.detail, evidence: d.evidence, rule: d.title };
}

/** Held or refused: the reason as the panel's first heading, the photo check's own words under it, then the count.
 * Claim ids it names open in the panel. */
export function Deciding({ claim, onOpen }: { claim: DrawerClaim; onOpen?: (id: string) => void }) {
  const d = deciding(claim);
  if (!d) return null;
  return (
    <section aria-labelledby="deciding-title" className="flex flex-col gap-1.5">
      <h3 id="deciding-title" className="text-ui font-medium text-text">
        {/* Typeset, with no capital after a colon ("Not done: the pillow is cut fully in half…"). */}
        <LinkedIds text={lowerAfterColons(typesetText(d.title))} onOpen={onOpen} self={claim.id} />
      </h3>
      {d.detail && (
        <p className="text-ui text-muted">
          <LinkedIds text={typesetText(d.detail)} onOpen={onOpen} self={claim.id} />
        </p>
      )}
      {d.evidence && <q className="block border-l border-line-strong pl-3 font-sans text-ui leading-[1.55] text-muted"><ModelQuote>{d.evidence}</ModelQuote></q>}
      {claim.five && <p className="mt-1 text-micro text-muted">{claim.five}</p>}
    </section>
  );
}


// No capital after a colon in these rows: "…: Couldn't confirm: The tag…" reads "…: couldn't confirm: the tag…". A
// word that is a name or a code (PayPal, X-VESOLJE, H9D) keeps its case: only a plain capitalised word is lowered.
export const lowerAfterColons = (text: string) => text.replace(/(:\s+)([A-Z])(?=[a-z’']*\b)(?![a-z’']*[A-Z0-9-])/g, (_, c: string, l: string) => c + l.toLowerCase());


/**
 * Under one of the five checks: why it was skipped, or each thing recorded under it, what held or failed first. One part
 * says its line alone; several name themselves. A photo-check answer that passed is its name and the model's own words,
 * never its rule restated ("Pillow cut fully in half: The pillow is cut fully in half"). The answer the panel already
 * leads with keeps its line here, as its name and state ("Same item: couldn't tell, see above"), without the quote.
 * Undefined when there is nothing more to say.
 */
export function fiveDetail(row: DrawerClaim["fiveRows"][number], decided: ReturnType<typeof deciding>, link: (text: string) => ReactNode): ReactNode {
  type Part = DrawerClaim["fiveRows"][number]["parts"][number];
  const led = (p: Part) => Boolean(decided && p.text === decided.rule && (p.evidence ?? null) === decided.evidence);
  const shown = row.parts.filter((p) => p.text || p.evidence).sort((a, b) => Number(a.state === "pass") - Number(b.state === "pass"));
  if (!row.note && !shown.length) return undefined;
  const named = shown.length > 1;
  // An account check's line says what was checked; a photo-check answer's rule only restates its name.
  const restates = (p: Part) => p.state === "pass" && !isPreCheck(p.id);
  // The row keeps its check's own name; what held or failed leads the lines under it (shown sorts it first), and under a
  // row in doubt an answer that passed says so even beside its quote, so what is in doubt is the only thing uncertain.
  const doubted = row.state === "hold" || row.state === "reject";
  return (
    <span className="flex flex-col gap-1.5">
      {row.note && <span>{lowerAfterColons(row.note)}</span>}
      {shown.map((p) => (
        <span key={p.id} className="block">
          {led(p) ? (
            <span className="text-text">
              {`${p.label}: ${PART_STATE[p.state] ?? "see above"}`}
              {PART_STATE[p.state] && <span className="text-muted">, see above</span>}
            </span>
          ) : restates(p) && (named || p.evidence) ? (
            <span className="text-text-2">
              {p.label}
              {(!p.evidence || doubted) && <span className="text-muted"> · passed</span>}
            </span>
          ) : named && PART_STATE[p.state] ? (
            // Its name and state; the rule's own line would only restate the name ("Couldn't confirm: The tag is on…").
            <span className="text-text">
              {p.label}: {PART_STATE[p.state]}
            </span>
          ) : (
            <>
              {named && <span className={p.state === "pass" ? "text-text-2" : "text-text"}>{p.label}: </span>}
              {link(lowerAfterColons(p.text))}
            </>
          )}
          {p.evidence && !led(p) && (
            <q className="mt-1.5 block border-l border-line-strong pl-3 font-sans text-ui leading-[1.55] text-muted">
              <ModelQuote>{p.evidence}</ModelQuote>
            </q>
          )}
        </span>
      ))}
    </span>
  );
}


/** The five checks the owner's result and the homepage name, in their order and states; what each one recorded (an
 * account check, the photo check's answers and its quoted words) under it. `open`: the passed rows' details shown. */
export function FiveChecks({ claim, open = false, onOpen }: { claim: DrawerClaim; open?: boolean; onOpen?: (id: string) => void }) {
  const d = deciding(claim);
  const link = (text: string) => <LinkedIds text={text} onOpen={onOpen} self={claim.id} />;
  return (
    <CheckList
      glyphs
      label={`Checks for ${claim.id}`}
      steps={claim.fiveRows.map((r) => ({
        id: String(r.n),
        label: r.name,
        state: r.state === "reject" ? (r.n <= 3 ? "blocked" : "reject") : r.state,
        detail: r.state === "waiting" || (r.state === "pass" && !open) ? undefined : fiveDetail(r, d, link),
      }))}
    />
  );
}

/** The header's money: what the claim pays; nothing for a refused claim. Where the money is (Paid, Sent, settling,
 * Approved) is the verdict badge beside it (lib/payoutWords.ts), so it is said once. */
export function MoneyLine({ claim }: { claim: DrawerClaim }) {
  if (claim.decision !== "paid" && claim.decision !== "held") return null;
  return (
    // Right-aligned on the header's row; when a phone wraps it, it starts on the left edge under the id, never mid-line.
    <span className="inline-flex items-baseline gap-1.5 text-ui sm:ml-auto">
      <span className="font-mono text-text">{claim.amount}</span>
    </span>
  );
}

/** PayPal's payout status in the console's words (lib/payoutWords.ts, as the section's heading says it), never its raw
 * enum. */
