import { NextResponse, type NextRequest } from "next/server";
import { body, company, fail, isResponse } from "@/app/console/_lib/api";
import { alreadyImported, readCpsc } from "@/app/console/_lib/import";
import { PublishInput, uniqueSlug } from "@/app/console/_lib/recalls";
import { toRecall } from "@/lib/cpsc";
import { getAppStore } from "@/lib/demo";

// POST /api/console/recalls {ref, spec, refund, autoPay, slug}: publish. The claim page goes live at /r/<slug>.
export async function POST(request: NextRequest) {
  const session = await company();
  if (isResponse(session)) return session;
  const input = await body(request, PublishInput);
  if (isResponse(input)) return input;

  const record = await readCpsc(input.ref);
  if (isResponse(record)) return record;
  const store = await getAppStore();
  const clash = await alreadyImported(store, record, session);
  if (clash) return clash;

  const recalls = await store.listRecalls();
  const slug = uniqueSlug(input.slug, recalls, "");
  // The source is always CPSC's own page, whatever the form sent.
  const spec = { ...input.spec, source: record.URL };
  const recall = toRecall(record, { refund: { value: input.refund, currency: "USD" }, spec, slug, owner: session.payerId, autoPay: input.autoPay });
  try {
    await store.putRecall(recall);
  } catch (e) {
    console.error("putRecall failed:", e instanceof Error ? e.message : e);
    return fail(503, "Remedy couldn't save the recall. Nothing went live; try again.");
  }
  return NextResponse.json({ id: recall.id, slug: recall.slug }, { status: 201 });
}
