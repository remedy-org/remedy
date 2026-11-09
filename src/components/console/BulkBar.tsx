"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Button, CrossIcon } from "@/components/ui";
import type { ApiError } from "@/app/console/_lib/api";
import type { ReviewedClaim } from "@/app/console/_lib/drawer";
import { formatCents, type ClaimRow } from "@/app/console/_lib/view";
import { api } from "./api";
import { plural } from "./format";
import { Keys } from "./Keys";
import { LinkedIds } from "./LinkedIds";
import { sharedQuickReasons, type QuickReason } from "./quickReasons";
import { REASON_MIN, REASON_SHORT } from "./ReviewActions";

export type BulkMode = "idle" | "approve" | "reject";

/** What one claim of a bulk decision came to. */
export interface BulkResult {
  id: string;
  ok: boolean;
  // The claim as decided, when it was.
  claim?: ReviewedClaim;
  error?: ApiError;
}

// A quick reason as one sentence for many claims: each claim gets its own code in it when it is sent.
const CODE = "{code}";
const generic = (q: QuickReason) => q.text(CODE).replace(`read ${CODE}, this claim’s code`, "read this claim’s code").replace(`code ${CODE}`, "code");

/**
 * The pick's actions, docked under the grid (Linear's selection bar): how many are picked and how many of
 * them are held, then Approve and Reject for the held ones. Approve asks once ("Pay $89.97 to 3 owners"), reject asks
 * one reason for all, with the panel's quick reasons. The claims go one at a time, in the grid's order, so a refusal
 * names its claim; the bar then says what happened and the queue moves on to the next held claim.
 */
export function BulkBar({
  rows,
  mode,
  onMode,
  onClear,
  onDone,
  onOpen,
  onBack,
}: {
  // The picked claims, in the grid's order.
  rows: ClaimRow[];
  // Esc out of the confirm or the reason: focus back on the pick's anchor row, never the page.
  onBack?: () => void;
  mode: BulkMode;
  onMode: (m: BulkMode) => void;
  onClear: () => void;
  onDone: (results: BulkResult[], decision: "approve" | "reject") => void;
  onOpen?: (id: string) => void;
}) {
  const held = rows.filter((r) => r.decision === "held");
  const cents = held.reduce((n, r) => n + (r.cents ?? 0), 0);
  // One word for the action, as the panel's (reviewLabels): Approve when every held claim is one of the console's own,
  // which approving sends nothing for, Pay when PayPal pays.
  const approveOnly = held.length > 0 && held.every((r) => r.seeded);
  const word = approveOnly ? "Approve" : "Pay";
  // The quick reasons every held claim in the pick can be given (quickReasons.ts).
  const QUICK = sharedQuickReasons(held.map((r) => r.bars ?? []));
  const quickKey = (k: string) => /^[1-9]$/.test(k) && Number(k) <= QUICK.length;
  const [progress, setProgress] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<BulkResult[]>([]);
  const bar = useRef<HTMLDivElement>(null);

  // A mode opened from the keyboard (A or R) moves focus into the bar: its first control.
  useEffect(() => {
    if (mode === "idle") return;
    requestAnimationFrame(() => bar.current?.querySelector<HTMLElement>("textarea, [data-autofocus]")?.focus());
  }, [mode]);

  const run = async (decision: "approve" | "reject") => {
    setError(null);
    setFailed([]);
    const results: BulkResult[] = [];
    for (const [i, r] of held.entries()) {
      setProgress(i);
      const quick = QUICK.find((q) => generic(q) === reason);
      const text = quick ? quick.text(r.code ?? "") : reason;
      const res = await api<ReviewedClaim>(`/api/console/claims/${r.id}/${decision}`, { method: "POST", json: decision === "reject" ? { reason: text } : undefined });
      results.push(res.ok ? { id: r.id, ok: true, claim: res.data } : { id: r.id, ok: false, error: res.error });
    }
    setProgress(null);
    const bad = results.filter((r) => !r.ok);
    setFailed(bad);
    onDone(results, decision);
  };

  const busy = progress !== null;
  const verb = mode === "reject" ? "Rejecting" : approveOnly ? "Approving" : "Paying";

  return (
    <div
      ref={bar}
      role="region"
      aria-label="Picked claims"
      // A strip under the grid on a hairline, not a box: the pick's one set of actions.
      className="w-full border-t border-line-2 bg-surface-2 text-ui"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) {
          e.preventDefault();
          e.stopPropagation();
          if (mode !== "idle") {
            onMode("idle");
            onBack?.();
          } else onClear();
        }
        // A again approves, as the key line says (A opened this confirm).
        if (mode === "approve" && !busy && (e.key === "a" || e.key === "A") && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          run("approve");
        }
      }}
    >
      {mode === "reject" && (
        <form
          id="bulk-reject"
          noValidate
          className="flex flex-col gap-2.5 border-b border-line px-4 pt-3.5 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length < REASON_MIN) return setError(REASON_SHORT);
            run("reject");
          }}
        >
          <label htmlFor="bulk-reason" className="font-medium text-text">
            Why {held.length === 1 ? "it’s" : "they’re"} rejected
          </label>
          <textarea
            id="bulk-reason"
            rows={2}
            maxLength={280}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              // As in the panel: ⌘↵ or Ctrl+Enter sends it, and 1, 2… pick a quick reason while the box is empty or holds one.
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              } else if ((!reason || QUICK.some((q) => generic(q) === reason)) && quickKey(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                setReason(generic(QUICK[Number(e.key) - 1]));
                setError(null);
              }
            }}
            aria-describedby="bulk-reason-hint"
            aria-invalid={error ? true : undefined}
            className="w-full resize-none rounded-control border border-line-strong bg-surface px-3 py-2 text-ui text-text placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-0"
          />
          <p id="bulk-reason-hint" className={clsx("text-micro", error ? "text-stop" : "text-muted")}>
            {error ?? "Each owner reads this on their claim page, with their own code where the reason names it."}
          </p>
          {/* The panel's quick reasons: outlined choices in the text colour, each with its number key. */}
          {QUICK.length > 0 && <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick reasons">
            {QUICK.map((q, i) => {
              const text = generic(q);
              return (
                <button
                  key={q.label}
                  type="button"
                  aria-pressed={reason === text}
                  aria-keyshortcuts={String(i + 1)}
                  onClick={() => {
                    setReason(text);
                    setError(null);
                  }}
                  className={clsx(
                    "inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-ui whitespace-nowrap text-text shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-160 hover:bg-surface-2",
                    reason === text && "bg-surface-3 shadow-[inset_0_0_0_1px_var(--text-2)]",
                  )}
                >
                  <span aria-hidden="true" className="font-mono text-micro text-faint">
                    {i + 1}
                  </span>
                  {q.label}
                </button>
              );
            })}
          </div>}
        </form>
      )}

      <div className={clsx("flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 py-2 pl-4", mode === "idle" ? "pr-2" : "pr-4")}>
        <p role="status" className="min-w-0 flex-1 basis-48 text-muted">
          {busy ? (
            <span className="text-text">
              {verb} {Math.min(progress! + 1, held.length)} of {held.length}…
            </span>
          ) : failed.length ? (
            <span className="text-text">
              {plural(failed.length, "claim")} not done:{" "}
              <LinkedIds text={failed.map((f) => `${f.id} (${f.error?.error ?? "no answer"})`).join(", ")} onOpen={onOpen} />
            </span>
          ) : mode === "approve" ? (
            <span className="text-text">{approveOnly ? `Approve ${plural(held.length, "held claim")}? Remedy records your decision, and the queue, ledger and report read Approved.` : `Pay ${formatCents(cents)} to ${plural(held.length, "owner")} through PayPal?`}</span>
          ) : mode === "reject" ? (
            <span className="text-text">Reject {plural(held.length, "held claim")}.</span>
          ) : (
            <>
              <span className="font-medium text-text">{plural(rows.length, "claim")} picked</span>
              {held.length !== rows.length && (
                <span>
                  {" · "}
                  {held.length ? `${held.length} held` : "none held: only held claims can be approved or rejected"}
                </span>
              )}
            </>
          )}
        </p>
        <div className={clsx("flex shrink-0 items-center", mode === "idle" ? "gap-2" : "gap-4")}>
          {mode === "idle" && held.length > 0 && (
            <>
              <Button size="sm" variant="secondary" onClick={() => onMode("approve")}>
                {`${word} ${held.length}…`}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onMode("reject")}>
                Reject {held.length}…
              </Button>
            </>
          )}
          {mode === "approve" && (
            <>
              <Button size="sm" data-autofocus pending={busy} pendingLabel={verb} onClick={() => run("approve")}>
                {approveOnly ? word : `${word} ${formatCents(cents)}`}
              </Button>
              <Button size="sm" variant="tertiary" arrow={false} disabled={busy} onClick={() => onMode("idle")}>
                Cancel
              </Button>
            </>
          )}
          {mode === "reject" && (
            <>
              {/* The quiet button: amber is for moving money only. */}
              <Button size="sm" type="submit" form="bulk-reject" variant="secondary" pending={busy} pendingLabel={verb}>
                Reject {held.length}
              </Button>
              <Button size="sm" variant="tertiary" arrow={false} disabled={busy} onClick={() => onMode("idle")}>
                Cancel
              </Button>
            </>
          )}
          {mode === "idle" && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear the pick (Esc)"
              title="Clear the pick (Esc)"
              className="inline-flex size-9 items-center justify-center rounded-control text-muted hover:bg-surface-3 hover:text-text"
            >
              <CrossIcon className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {!busy && !failed.length && (
        // What the keys do now, in every mode, as the panel's key line says it.
        <p aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-micro text-faint">
          {mode === "reject" ? (
            <>
              {QUICK.length > 0 && <Keys k={[QUICK.length > 1 ? `1–${QUICK.length}` : "1"]}>Quick reason</Keys>}
              <Keys k={["⌘↵"]}>Reject {held.length}</Keys>
              <Keys k={["Esc"]}>Cancel</Keys>
            </>
          ) : mode === "approve" ? (
            <>
              <Keys k={["A"]}>{approveOnly ? word : `${word} ${formatCents(cents)}`}</Keys>
              <Keys k={["Esc"]}>Cancel</Keys>
            </>
          ) : (
            <>
              <Keys k={["⇧", "↑/↓"]}>Pick more</Keys>
              {held.length > 0 && <Keys k={["A"]}>{word}</Keys>}
              {held.length > 0 && <Keys k={["R"]}>Reject</Keys>}
              <Keys k={["Esc"]}>Clear</Keys>
            </>
          )}
        </p>
      )}
    </div>
  );
}
