import { NextResponse, type NextRequest } from "next/server";
import { body, company, isResponse } from "@/app/console/_lib/api";
import { alreadyImported, readCpsc } from "@/app/console/_lib/import";
import { RecallRefInput, summarizeCpsc, uniqueSlug } from "@/app/console/_lib/recalls";
import { getAppStore } from "@/lib/demo";

// POST /api/console/recalls/import {ref}: step 1 of an import, CPSC's record for a URL or number. No model call.
export async function POST(request: NextRequest) {
  const session = await company();
  if (isResponse(session)) return session;
  const input = await body(request, RecallRefInput);
  if (isResponse(input)) return input;

  const record = await readCpsc(input.ref);
  if (isResponse(record)) return record;
  const store = await getAppStore();
  const clash = await alreadyImported(store, record, session);
  if (clash) return clash;

  const summary = summarizeCpsc(record);
  return NextResponse.json({ ...summary, slug: uniqueSlug(summary.slug, await store.listRecalls(), summary.id) });
}
