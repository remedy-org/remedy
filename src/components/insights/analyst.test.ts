import { describe, expect, it } from "vitest";
import { buildInsights } from "@/app/console/insights/facts";
import { demoRecall } from "@/lib/demo/kikea";
import { buildSeedClaims, SEED_PHOTOS } from "@/lib/demo/seed";
import { instructions, plainError, UNREACHABLE } from "./analyst";

describe("the analyst's instructions", () => {
  const hashes = Object.fromEntries(SEED_PHOTOS.map((p, i) => [p, (i + 1).toString(16).padStart(16, "0")]));
  const recall = demoRecall(new Date("2026-11-04T12:00:00Z"));
  const data = buildInsights(buildSeedClaims({ recall, hashes }), recall, new Date("2026-11-07T12:00:00Z"));
  const api = { getAiContext: () => ({ schema: () => ({ tables: [{ name: "claims" }] }) }) } as unknown as Parameters<typeof instructions>[0];
  const text = instructions(api, data);

  it("count the refusals from refused claims alone, and name the widget that already charts them", () => {
    const line = text.split("\n").find((l) => /^- "Why (was|were) \d+ claims? refused\?":/.test(l));
    expect(line).toBeDefined();
    expect(line).toContain("decision Rejected or Blocked");
    expect(line).toContain("leave out any row whose refusalReason is blank");
    expect(line).toContain("\"Why claims were refused\" widget");
  });

  it("never read a blank refusal reason as a reason", () => {
    const how = text.slice(text.indexOf("## How you work"), text.indexOf("## The suggested questions"));
    expect(how).toContain("A blank refusalReason means the claim wasn't refused");
    expect(how).toContain("It is never a reason");
  });
});

describe("the analyst's errors", () => {
  it("say a request that never reached Remedy in words, and keep every other message", () => {
    expect((plainError(new TypeError("Failed to fetch")) as Error).message).toBe(UNREACHABLE);
    expect((plainError(new Error("NetworkError when attempting to fetch resource.")) as Error).message).toBe(UNREACHABLE);
    const proxy = new Error("The analyst's daily limit was reached.");
    expect(plainError(proxy)).toBe(proxy);
    const abort = new DOMException("The operation was aborted.", "AbortError");
    expect(plainError(abort)).toBe(abort);
  });
});
