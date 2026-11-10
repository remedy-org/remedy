import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import { DemoCaptureStep } from "./DemoCaptureStep";

describe("demo capture disclosure", () => {
  it.each(DEMO_SAMPLES)("identifies $id as a prepared photo before submission", (sample) => {
    const html = renderToStaticMarkup(createElement(DemoCaptureStep, { claimId: "RM-fixture", code: "T7Y", sample, backHref: "#", onSent: () => {} }));
    expect(html).toContain("Prepared demo photo. Submit it to run this claim’s checks.");
  });
});
