import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// AG Studio runs only under a valid, unexpired key (lib/agStudioLicence.ts). Without one, Insights is Remedy's own
// report and the homepage's Insights step keeps its still: Studio's module never loads, so no licence notice, trial
// banner or watermark can reach a visitor.

const EXPIRY = Date.UTC(2026, 11, 22);
const KEY = `Remedy_Insights_[TRIAL]_[v3]_[03C]_${btoa(String(EXPIRY))}0123456789abcdef0123456789abcdef`;

async function studioOnHome(key: string | undefined, now: number) {
  vi.resetModules();
  vi.useFakeTimers({ now, toFake: ["Date"] });
  vi.stubEnv("NEXT_PUBLIC_AG_STUDIO_LICENSE", key);
  return (await import("./InsightsPreviewLazy")).STUDIO_ON_HOME;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the homepage's Insights step", () => {
  it("loads AG Studio under a valid key", async () => {
    expect(await studioOnHome(KEY, Date.UTC(2026, 10, 9))).toBe(true);
  });

  it("keeps the still without a key, with a blank one, or once the key has expired", async () => {
    expect(await studioOnHome(undefined, Date.UTC(2026, 10, 9))).toBe(false);
    expect(await studioOnHome("", Date.UTC(2026, 10, 9))).toBe(false);
    expect(await studioOnHome(KEY, Date.UTC(2026, 11, 23))).toBe(false);
  });
});

// The modules a file imports at runtime (type-only imports and next/dynamic's lazy imports left out), followed through
// the app's own files.
const SRC = resolve(__dirname, "../..");
function runtimeImports(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/^import\s+(?!type\b)[^;]*?from\s+"([^"]+)";/gm)) {
    const spec = m[1];
    if (spec === "ag-studio" || spec.endsWith("studio-lib")) {
      seen.add(spec);
      continue;
    }
    const base = spec.startsWith("@/") ? resolve(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(file), spec) : null;
    if (!base) continue;
    const found = [".tsx", ".ts", "/index.ts", "/index.tsx", ".js"].map((ext) => base + ext).find((f) => {
      try {
        readFileSync(f);
        return true;
      } catch {
        return false;
      }
    });
    if (found) runtimeImports(found, seen);
  }
  return seen;
}

describe("Remedy's own Insights report", () => {
  it("never imports AG Studio at runtime", () => {
    const graph = [...runtimeImports(resolve(__dirname, "InsightsReport.tsx"))];
    expect(graph.length).toBeGreaterThan(5);
    expect(graph.filter((f) => /ag-studio|studio-lib|InsightsStudio|InsightsPreview\.tsx|widgets\/index/.test(f))).toEqual([]);
  });

  it("is the console's page in plain React, with no analyst and no licence words", async () => {
    vi.resetModules();
    const { insightsPreview } = await import("./preview");
    const { InsightsReport } = await import("./InsightsReport");
    const html = renderToStaticMarkup(createElement(InsightsReport, { data: insightsPreview() }));
    for (const title of ["Recall progress", "Decisions", "Where claims stop", "Why claims were refused", "Paid through PayPal, by day"]) expect(html).toContain(title);
    expect(html).toContain("Pick a decision, a drop or a reason to filter the page");
    expect(html).not.toMatch(/Ask the analyst|licen[cs]e|trial|watermark|ag-studio/i);
  });
});

describe("a pick", () => {
  it("replaces the panel's pick on a click, adds to it with Cmd or Ctrl, and clears on a second click", async () => {
    const { togglePick } = await import("./InsightsReport");
    const one = togglePick([], "claims.decision", "Held", false);
    expect(one).toEqual([{ field: "claims.decision", values: ["Held"] }]);
    expect(togglePick(one, "claims.decision", "Paid", false)).toEqual([{ field: "claims.decision", values: ["Paid"] }]);
    expect(togglePick(one, "claims.decision", "Paid", true)).toEqual([{ field: "claims.decision", values: ["Held", "Paid"] }]);
    expect(togglePick(one, "claims.decision", "Held", false)).toEqual([]);
    expect(togglePick(one, "claims.stage", "Filed", false)).toEqual([...one, { field: "claims.stage", values: ["Filed"] }]);
  });

  it("filters every other panel, and leaves the panel holding it whole", async () => {
    const { claimsFor } = await import("./InsightsReport");
    const { insightsPreview } = await import("./preview");
    const { claims } = insightsPreview();
    const picks = [{ field: "claims.decision", values: ["Held"] }];
    expect(claimsFor(claims, picks, "claims.decision")).toHaveLength(claims.length);
    const held = claimsFor(claims, picks, "claims.stage");
    expect(held.length).toBeGreaterThan(0);
    expect(held.every((c) => c.decision === "Held")).toBe(true);
  });
});
