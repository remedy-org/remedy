import Link from "next/link";
import type { Recall } from "@/lib/types";
import { keepHyphens } from "./format";
import { firmOf, sameFirm } from "./firm";

/**
 * A workspace with no recall of its own opens on the shared recall every workspace starts with: one quiet line says what
 * it is (Remedy's own run of a public CPSC recall, never a client's) and offers the company's own, until it imports one.
 * Not for the firm that runs it.
 */
type Workspace = { recall: Recall; recalls: Pick<Recall, "owner">[]; company: string | null };

/** Whether the workspace is on the shared recall, so the note shows (the report says so on its printed sheet too). */
export function onSharedRecall({ recall, recalls, company }: Workspace) {
  const firm = firmOf(recall);
  return !(recall.owner !== null || recalls.some((r) => r.owner !== null) || !firm || (company && sameFirm(firm, company)));
}

export function WorkspaceNote({ recall, recalls, company }: Workspace) {
  if (!onSharedRecall({ recall, recalls, company })) return null;
  return (
    <p className="rounded-control border border-line bg-surface px-4 py-3 text-ui text-muted">
      <span className="mr-2 font-medium text-text">Demo workspace</span>
      Public CPSC recall <span className="font-mono">{recall.id}</span>, {keepHyphens(recall.product)}. Includes sample claims and your demo round.{" "}
      <Link href="/console/recalls/new" className="whitespace-nowrap text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">
        Import your own recall <span aria-hidden="true">→</span>
      </Link>
    </p>
  );
}
