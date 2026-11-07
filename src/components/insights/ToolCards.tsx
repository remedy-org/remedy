"use client";

import clsx from "clsx";
import type { AgAiToolDetailParams, AgTypeScriptAiToolDisplay } from "ag-studio";
import { useState } from "react";
import { StatusPill, type Status } from "@/components/ui";
import type { Dossier } from "@/app/console/insights/facts";
import type { ExplainData, NoteData, OpenData } from "./analyst";
import { reactComp } from "./reactComp";

// How the analyst's own tools show in the chat: the claim's evidence in mono, a claim card with its photo, and a
// drafted note with the line that says who decides.

const STATUS: Record<string, Status> = { Paid: "paid", Held: "held", Rejected: "rejected", Blocked: "blocked", "In progress": "pending" };
const OUTCOME_DOT: Record<string, string> = { pass: "bg-pay", hold: "bg-hold", reject: "bg-stop" };
// Never colour alone: each check's outcome is also a word.
const OUTCOME_WORD: Record<string, string> = { pass: "Yes", hold: "Unclear", reject: "No" };
const OUTCOME_TEXT: Record<string, string> = { pass: "text-faint", hold: "text-hold", reject: "text-stop" };

const done = <T,>(p: AgAiToolDetailParams): T | undefined => (p.status === "done" && p.result?.success ? (p.result.data as T) : undefined);

function Head({ d }: { d: Dossier }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-ui font-medium text-text">{d.id}</span>
      <StatusPill status={STATUS[d.decision] ?? "pending"} />
    </div>
  );
}

function Explain(p: AgAiToolDetailParams) {
  const data = done<ExplainData>(p);
  if (!data) return null;
  const d = data.dossier;
  return (
    <div className="flex flex-col gap-3 py-1">
      <Head d={d} />
      <p className="text-ui text-muted">{d.sentence}</p>
      <ul className="flex flex-col gap-2.5">
        {d.checks.map((k) => (
          <li key={k.label} className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-ui text-text">
              <span aria-hidden="true" className={clsx("size-1.5 rounded-full", OUTCOME_DOT[k.outcome] ?? "bg-faint")} />
              {k.label}
              <span className={clsx("micro ml-auto", OUTCOME_TEXT[k.outcome] ?? "text-faint")}>{OUTCOME_WORD[k.outcome] ?? k.outcome}</span>
            </span>
            {k.evidence && <q className="border-l border-line pl-3 font-mono text-micro text-muted before:content-none after:content-none">{k.evidence}</q>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Open(p: AgAiToolDetailParams) {
  const data = done<OpenData>(p);
  if (!data) return null;
  const d = data.dossier;
  return (
    <a href={data.href} className="group flex items-center gap-3 rounded-card border border-line bg-surface p-2 transition-colors hover:border-line-strong">
      {d.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- a session-gated console photo, not a static asset
        <img src={d.photo} alt="" className="size-14 shrink-0 rounded-control bg-surface-2 object-cover" />
      ) : (
        <span className="size-14 shrink-0 rounded-control bg-surface-2" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <Head d={d} />
        <span className="truncate text-micro text-muted">
          {d.source === "Sample" ? "Sample photo · " : d.source === "Judges' demo" ? "Demo sample photo · " : ""}
          Open in Claims <span aria-hidden="true">→</span>
        </span>
      </span>
    </a>
  );
}

function Note(p: AgAiToolDetailParams) {
  const data = done<NoteData>(p);
  const [copied, setCopied] = useState(false);
  if (!data) return null;
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="rounded-control bg-paper p-3 text-ink shadow-[0_0_0_1px_var(--paper-line)]">
        <p className="micro text-ink-muted">Draft review note · {data.claimId}</p>
        <p className="mt-2 text-ui">{data.note}</p>
        <p className="mt-2 text-right font-mono text-micro text-ink-muted tabular-nums">{data.note.length} / 280</p>
      </div>
      <p className="text-micro text-muted">A person still decides: Approve or Reject in the evidence panel. The analyst can&rsquo;t.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(data.note).then(() => setCopied(true), () => {})}
          className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-3 text-ui text-text transition-colors hover:bg-surface-2"
        >
          {copied ? "Copied" : "Copy note"}
        </button>
        <a href={data.href} className="inline-flex min-h-11 items-center px-2 text-ui text-text underline decoration-line-2 underline-offset-4 hover:decoration-text">
          Open {data.claimId} <span aria-hidden="true">&nbsp;→</span>
        </a>
      </div>
    </div>
  );
}

const arg = (p: { args: Partial<Record<string, unknown>> }) => (typeof p.args.claimId === "string" ? p.args.claimId : "a claim");

export const toolDisplay: Record<string, AgTypeScriptAiToolDisplay> = {
  explain_claim: { label: (p) => ({ text: `Read the evidence for ${arg(p)}` }), detail: reactComp(Explain) },
  open_claim: { label: (p) => ({ text: `Showed ${arg(p)}` }), detail: reactComp(Open) },
  draft_review_note: { label: (p) => ({ text: `Drafted a review note for ${arg(p)}` }), detail: reactComp(Note) },
};
