import Link from "next/link";
import type { Recall } from "@/lib/types";
import { keepHyphens } from "./format";
import { firmOf, sameFirm } from "./firm";

/**
 * A workspace with no recall of its own opens on the shared recall every workspace starts with: one quiet line says whose
 * recall it is and offers the company's own, until it imports one. Not for the firm that runs it.
 */
export function WorkspaceNote({ recall, recalls, company }: { recall: Recall; recalls: Pick<Recall, "owner">[]; company: string | null }) {
  const firm = firmOf(recall);
  if (recall.owner !== null || recalls.some((r) => r.owner !== null) || !firm || (company && sameFirm(firm, company))) return null;
  return (
    <p className="text-ui text-muted">
      Your workspace opens on {firm}&apos;s live {keepHyphens(recall.product)} recall, so you can see a running queue.{" "}
      <Link href="/console/recalls/new" className="whitespace-nowrap text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">
        Import your own recall <span aria-hidden="true">→</span>
      </Link>
    </p>
  );
}
