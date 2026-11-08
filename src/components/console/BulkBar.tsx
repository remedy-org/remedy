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
import { QUICK, REASON_MIN, REASON_SHORT } from "./ReviewActions";

export type BulkMode = "idle" | "approve" | "reject";

/** What one claim of a bulk decision came to. */
export interface BulkResult {
  id: string;
  ok: boolean;
  // A claim that came with the console: the server says what it would have done, and nothing is saved.
  sample: boolean;
  error?: ApiError;
}

// A quick reason as one sentence for many claims: each claim gets its own code in it when it is sent.
const CODE = "{code}";
const generic = (q: (typeof QUICK)[number]) => q.text(CODE).replace(`read ${CODE}, this claim's code`, "read this claim's code").replace(`code ${CODE}`, "code");

/**
 * The pick's actions, floating over the foot of the grid (Linear's selection bar): how many are picked and how many of
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
}: {
  // The picked claims, in the grid's order.
  rows: ClaimRow[];
  mode: BulkMode;
  onMode: (m: BulkMode) => void;
  onClear: () => void;
  onDone: (results: BulkResult[], decision: "approve" | "reject") => void;
  onOpen?: (id: string) => void;
}) {
  const held = rows.filter((r) => r.decision === "held");
  const owed = held.filter((r) => !r.seeded);
  const cents = owed.reduce((n, r) => n + (r.cents ?? 0), 0);
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
      results.push(res.ok ? { id: r.id, ok: true, sample: Boolean(res.data.sample) } : { id: r.id, ok: false, sample: false, error: res.error });
    }
    setProgress(null);
    const bad = results.filter((r) => !r.ok);
    setFailed(bad);
    onDone(results, decision);
  };

  const busy = progress !== null;
  const verb = mode === "reject" ? "Rejecting" : owed.length ? "Paying" : "Approving";

  return (
    <div
      ref={bar}
      role="region"
      aria-label="Picked claims"
      className="pointer-events-auto w-[min(40rem,calc(100%-1.5rem))] rounded-card bg-surface-2 text-ui shadow-float"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) {
          e.preventDefault();
          e.stopPropagation();
          if (mode !== "idle") onMode("idle");
          else onClear();
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
            Why {held.length === 1 ? "it's" : "they're"} rejected
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
            aria-describedby="bulk-reason-hint"
            aria-invalid={error ? true : undefined}
            className="w-full resize-none rounded-control border border-line-strong bg-surface px-3 py-2 text-ui text-text placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-0"
          />
          <p id="bulk-reason-hint" className={clsx("text-micro", error ? "text-stop" : "text-muted")}>
            {error ?? "Each owner reads this on their claim page, with their own code where the reason names it."}
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick reasons">
            {QUICK.map((q) => {
              const text = generic(q);
              return (
                <button
                  key={q.label}
                  type="button"
                  aria-pressed={reason === text}
                  onClick={() => {
                    setReason(text);
                    setError(null);
                  }}
                  className={clsx(
                    "inline-flex h-8 items-center rounded-control px-2.5 text-ui shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-text",
                    reason === text ? "bg-surface-3 text-text" : "text-muted",
                  )}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
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
            <span className="text-text">{approveLine(held, owed, cents)}</span>
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
                {owed.length ? `Pay ${held.length}…` : `Approve ${held.length}…`}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onMode("reject")}>
                Reject {held.length}…
              </Button>
            </>
          )}
          {mode === "approve" && (
            <>
              <Button size="sm" data-autofocus pending={busy} pendingLabel={verb} onClick={() => run("approve")}>
                {owed.length ? `Pay ${formatCents(cents)}` : `Approve ${held.length}`}
              </Button>
              <Button size="sm" variant="tertiary" arrow={false} disabled={busy} onClick={() => onMode("idle")}>
                Cancel
              </Button>
            </>
          )}
          {mode === "reject" && (
            <>
              <Button size="sm" type="submit" form="bulk-reject" pending={busy} pendingLabel={verb}>
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
      {mode === "idle" && !busy && !failed.length && (
        <p aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-micro text-faint">
          <Keys k={["⇧", "↑", "↓"]}>Pick more</Keys>
          {held.length > 0 && <Keys k={["A"]}>Approve</Keys>}
          {held.length > 0 && <Keys k={["R"]}>Reject</Keys>}
          <Keys k={["Esc"]}>Clear</Keys>
        </p>
      )}
    </div>
  );
}

/** "Pay $59.98 to 2 owners through PayPal.", saying what the ones that came with the console do. */
function approveLine(held: ClaimRow[], owed: ClaimRow[], cents: number) {
  const starter = held.length - owed.length;
  if (!owed.length) return `Approve ${plural(held.length, "held claim")}? ${held.length === 1 ? "It came" : "They came"} with your console, so nothing is sent.`;
  const pay = `Pay ${formatCents(cents)} to ${plural(owed.length, "owner")} through PayPal?`;
  return starter ? `${pay} ${plural(starter, "other claim")} came with your console and ${starter === 1 ? "sends" : "send"} nothing.` : pay;
}
