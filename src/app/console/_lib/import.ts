import "server-only";
import type { NextResponse } from "next/server";
import { fetchCpscRecall, parseRecallRef, recallId, type CpscRecord } from "@/lib/cpsc";
import type { Session } from "@/lib/session";
import type { Store } from "@/lib/store";
import { fail, type ApiError } from "./api";
import { canSee } from "./workspace";

// The CPSC record behind a pasted URL or number, or the error response to send. Every import step re-reads CPSC:
// the client never hands the server a record to trust.
export async function readCpsc(ref: string): Promise<CpscRecord | NextResponse<ApiError>> {
  try {
    parseRecallRef(ref);
  } catch {
    return fail(400, "That isn't a CPSC recall number or a cpsc.gov recall URL.", { fields: { ref: "Paste a cpsc.gov recall URL or a number like 27-071" } });
  }
  let record: CpscRecord | null;
  try {
    record = await fetchCpscRecall(ref);
  } catch (e) {
    console.error("CPSC lookup failed:", e instanceof Error ? e.message : e);
    return fail(502, "CPSC's recall service didn't answer. Try again in a minute.");
  }
  return record ?? fail(404, "CPSC has no recall at that address or number. Check it against the notice on cpsc.gov.", { fields: { ref: "No CPSC recall matches this" } });
}

// A recall id is CPSC's number, so each recall exists once in Remedy.
export async function alreadyImported(store: Store, record: CpscRecord, session: Session): Promise<NextResponse<ApiError> | null> {
  const id = recallId(record);
  const row = (await store.listRecalls()).find((r) => r.id === id);
  if (!row) return null;
  if (canSee(row, session)) return fail(409, `Recall ${id} is already in your workspace.`, { existing: id });
  return fail(409, `Recall ${id} is already run through Remedy by another company.`);
}
