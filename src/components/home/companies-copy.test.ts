import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { Companies } = await import("./Companies");
const { STUDIO_ON_HOME } = await import("@/components/insights/InsightsPreviewLazy");
const { studioLicence } = await import("@/lib/agStudioLicence");

// What a visitor reads in the For companies section, laptop tour and phone story both: its text, and the words its
// images and regions carry (alt, aria-label, title). Seed text is in it, so the model's recorded answers are covered.
function visibleWords(html: string) {
  const attrs = [...html.matchAll(/\s(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]);
  const text = html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, " ");
  return `${text} ${attrs.join(" ")}`.replace(/\s+/g, " ");
}

describe("For companies, as rendered", () => {
  const html = renderToStaticMarkup(createElement(Companies));
  const words = visibleWords(html);
  // The laptop tour and the phone story are both in the markup; a visitor reads one of them.
  const [tour, story] = html.split("data-story").map(visibleWords);

  it("speaks as the product: no sample, sandbox, test or demo labels anywhere in the section", () => {
    expect(words.length).toBeGreaterThan(2000);
    expect(words).not.toMatch(/\b(samples?|sandbox|test|demo|never sent|no money moved|AI-made|exhibit)\b/i);
  });

  it("says that no money moves at most once in each layout", () => {
    for (const layout of [tour, story]) expect(layout.match(/money mov/gi)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it("uses typeset quotes and apostrophes in the seed's words", () => {
    expect(words).not.toMatch(/\w'\w|"/);
  });

  it("mounts AG Studio on the Insights step only under a valid key, so no visitor sees a licence notice", () => {
    expect(STUDIO_ON_HOME).toBe(studioLicence() !== null);
    expect(words).not.toMatch(/licen[cs]e|trial|watermark/i);
  });
});
