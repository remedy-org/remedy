import { NextResponse, type NextRequest } from "next/server";
import { company, fail, isResponse } from "@/app/console/_lib/api";
import { loadQueue } from "@/app/console/_lib/queue";
import { viewerOf } from "@/app/console/_lib/workspace";
import type { ClaimRow } from "@/app/console/_lib/view";

export interface QueueResponse {
  recallId: string;
  rows: ClaimRow[];
  // When the server read index.json.
  at: string;
}

// GET /api/console/claims?recall=27-071: the claims grid's rows, for its live updates. Reads index.json (and, on a
// cold instance, recalls.json and the recall): 1 Blob read warm, 3 at most. The page polls it only while a claim can
// still change, every 8 s while visible, for at most 10 minutes (components/console/useQueuePoll.ts).
export async function GET(request: NextRequest) {
  const session = await company();
  if (isResponse(session)) return session;
  const queue = await loadQueue(await viewerOf(session, request.cookies), request.nextUrl.searchParams.get("recall"));
  if (!queue) return fail(404, "No recall with that id in this workspace.");
  return NextResponse.json<QueueResponse>({ recallId: queue.recall.id, rows: queue.rows, at: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
}
