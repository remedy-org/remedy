import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { Companies } = await import("./Companies");

// Prevent a sample preview or future funding model being presented as current customer/payment proof.
function visibleWords(html: string) {
  return html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
}

describe("For companies, as rendered", () => {
  const html = renderToStaticMarkup(createElement(Companies));
  const words = visibleWords(html);

  it("labels the previews and identifies current sandbox funding", () => {
    expect(words).toContain("Sample workspace");
    expect(words).toContain("Illustrative workspace");
    expect(words).toContain("This build uses Remedy’s PayPal sandbox account");
    expect(words).toContain("Per-company funding requires PayPal partner onboarding");
  });

  it("preserves evidence review, real integration names, and the analyst boundary", () => {
    expect(words).toContain("exact check that decided it");
    expect(words).toContain("AG Grid");
    expect(words).toContain("AG Studio");
    expect(words).toContain("It can’t approve a claim or move money");
    expect(html).toContain('href="/signin"');
  });

  it("does not turn model-call cost or sample payment timing into a product promise", () => {
    expect(words).not.toMatch(/costs? 1\.1|paid in a minute|15 seconds|55 seconds/i);
    expect(words).not.toMatch(/refunds go from your PayPal Business account/i);
  });
});
