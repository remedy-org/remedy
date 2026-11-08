import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The root layout's "Skip to content" (#main) and the console's "Skip to claims" (#claims-panel) must land somewhere on
// every page they show on: a skip link whose target is missing silently does nothing.

const src = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");
const target = (id: string) => new RegExp(`id="${id}" tabIndex=\\{-1\\}`);

describe("skip link targets", () => {
  it("the root layout skips to #main", () => {
    expect(src("app/layout.tsx")).toContain('<SkipLink href="#main">Skip to content</SkipLink>');
  });

  // The homepage, the company sign-in, every claim page and not-found (FlowShell), and every console page (its layout).
  it.each(["app/(marketing)/page.tsx", "app/signin/page.tsx", "components/claim/FlowShell.tsx", "components/legal/LegalPage.tsx", "app/console/layout.tsx"])(
    "%s holds a focusable #main",
    (path) => {
      expect(src(path)).toMatch(target("main"));
    },
  );

  it("the claims queue's panel takes the console's skip link", () => {
    expect(src("components/console/ConsoleSkipLink.tsx")).toContain('href="#claims-panel"');
    expect(src("components/console/ClaimsQueue.tsx")).toMatch(/id="claims-panel"[\s\S]{0,400}tabIndex=\{-1\}/);
  });
});
