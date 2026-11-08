import { NextResponse, type NextRequest } from "next/server";
import { body, company, fail, isResponse } from "@/app/console/_lib/api";
import { readCpsc } from "@/app/console/_lib/import";
import { RecallRefInput } from "@/app/console/_lib/recalls";
import { getAppStore } from "@/lib/demo";
import { limits, nextUtcDay, plural, retryIn, utcDay } from "@/lib/limits";
import { draftSpec } from "@/lib/spec";

// The model reads the notice and its photos; about 15 seconds at high effort.
export const maxDuration = 60;

// POST /api/console/recalls/draft {ref}: step 2, the model drafts the checks from CPSC's notice. The company edits
// the draft before anything is published.
export async function POST(request: NextRequest) {
  const session = await company();
  if (isResponse(session)) return session;
  const input = await body(request, RecallRefInput);
  if (isResponse(input)) return input;

  const record = await readCpsc(input.ref);
  if (isResponse(record)) return record;
  // Counted before the call: every draft costs a model call, whether or not it's published.
  const now = new Date();
  const { draft: limit } = limits();
  if (!(await (await getAppStore()).takeUsage(utcDay(now), "draft", limit))) {
    return fail(429, `Remedy drafts up to ${plural(limit, "recall")} a day, and today's are used up. Write the checks yourself, or try the draft again ${retryIn(nextUtcDay(now), now)}.`);
  }
  try {
    return NextResponse.json(await draftSpec(record));
  } catch (e) {
    console.error("draftSpec failed:", e instanceof Error ? e.message : e);
    return fail(502, "No draft came back. Nothing was published; try again, or write the checks yourself.");
  }
}
