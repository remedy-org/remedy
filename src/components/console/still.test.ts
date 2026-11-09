import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { previewProps, previewSeed, PREVIEW_OPEN_ID } = await import("./preview");
const { toDrawerClaim } = await import("@/app/console/_lib/drawer");
const { EvidenceStill } = await import("./EvidenceStill");
const { ClaimVerdict, Deciding, FiveChecks, HeaderMeta, MoneyLine, heldNote } = await import("./EvidenceParts");
const { PayoutsNote } = await import("@/components/home/PayoutsNote");

// What a reader reads: the text, curly marks as the homepage sets them, one space between words.
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "’")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/[“”]/g, "\"")
    .replace(/'/g, "’")
    .replace(/\s+/g, " ")
    .trim();

describe("the homepage's Held claim still", () => {
  const { recall, claims } = previewSeed();
  const evidence = previewProps().rows.find((r) => r.id === PREVIEW_OPEN_ID)!.evidence!;
  // The claim as the console's own panel loads it (api/console/claims/[id]: toDrawerClaim).
  const console = toDrawerClaim(claims.find((c) => c.id === PREVIEW_OPEN_ID)!, recall);
  const still = text(renderToStaticMarkup(createElement(EvidenceStill, { claim: evidence, note: createElement(PayoutsNote, { claim: evidence }) })));

  it("says the console panel's header, headline, quote, count and checks word for word", () => {
    const parts = [
      createElement(Fragment, null, console.id, " ", createElement(ClaimVerdict, { claim: console }), " ", createElement(MoneyLine, { claim: console })),
      createElement(HeaderMeta, { claim: console }),
      createElement(Deciding, { claim: console }),
      createElement(FiveChecks, { claim: console }),
    ].map((el) => text(renderToStaticMarkup(el)));
    let from = 0;
    for (const part of parts) {
      const at = still.indexOf(part, from);
      expect(at, `the still should say, in order: ${part}`).toBeGreaterThanOrEqual(0);
      from = at + part.length;
    }
  });

  it("reads RM-9629 as the console does: one photo, the tag held once, and the console's held line", () => {
    expect(still).toContain("RM-9629 Held $29.99");
    // The day moves with the dataset (dataset.ts datasetShift); the time of day stays.
    expect(still).toMatch(/\b\d{1,2} [A-Z][a-z]{2} 13:05 PayPal account ending WPW4 •••• WPW4 Code H9D\b/);
    expect(still).toContain("4 of 5 checks passed · 1 held");
    expect(still).toContain(heldNote(console)!);
    expect(heldNote(console)).toBe("Held: approve or reject it to record your decision.");
  });
});
