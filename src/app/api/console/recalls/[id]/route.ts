import { NextResponse, type NextRequest } from "next/server";
import { body, company, fail, isResponse } from "@/app/console/_lib/api";
import { SettingsInput } from "@/app/console/_lib/recalls";
import { loadRecallFor } from "@/app/console/_lib/workspace";

// PATCH /api/console/recalls/27-071 {refund, autoPay}: recall settings. Claims already decided keep their amount.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/console/recalls/[id]">) {
  const session = await company();
  if (isResponse(session)) return session;
  const input = await body(request, SettingsInput);
  if (isResponse(input)) return input;
  const found = await loadRecallFor(session, (await ctx.params).id);
  if (!found) return fail(404, "No recall with that id in this workspace.");

  const recall = { ...found.recall, refund: { value: input.refund, currency: "USD" as const }, autoPay: input.autoPay };
  try {
    await found.store.putRecall(recall);
  } catch (e) {
    console.error("putRecall failed:", e instanceof Error ? e.message : e);
    return fail(503, "Remedy couldn't save the settings. Nothing changed; try again.");
  }
  return NextResponse.json({ refund: recall.refund.value, autoPay: recall.autoPay });
}
