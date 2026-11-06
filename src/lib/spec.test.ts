import type OpenAI from "openai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import kikea from "./__fixtures__/cpsc-27071.json";
import { CpscRecord } from "./cpsc";
import { buildSpecPrompt, draftSpec, SPEC_SYSTEM } from "./spec";

const record = CpscRecord.parse(kikea);

beforeEach(() => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
});

describe("buildSpecPrompt", () => {
  it("carries everything the drafter needs from the notice", () => {
    const text = buildSpecPrompt(record);
    expect(text.split("\n")[0]).toBe(`Recall 27-071: ${kikea.Title}`);
    expect(text).toContain("There are no markings or labels on the product.");
    expect(text).toContain("Product: X-VESOLJE Nursing Pillows; About 19,596 units");
    expect(text).toContain("Remedy: Consumers should stop using the recalled nursing pillows immediately");
    expect(text).toContain(`Photo 1: ${kikea.Images[0].Caption}`);
  });
});

describe("SPEC_SYSTEM", () => {
  it("states the spec generator rules", () => {
    expect(SPEC_SYSTEM).toContain('"in marker", not "in permanent marker"');
    expect(SPEC_SYSTEM).toContain("Say where each identifier sits on the label");
    expect(SPEC_SYSTEM).toContain("from the notice's photos, not only its text");
    expect(SPEC_SYSTEM).toContain("the one-time code is the claim number");
  });
});

describe("draftSpec", () => {
  it("sends the notice's photos and text, and fills recall and source itself", async () => {
    const parse = vi.fn().mockResolvedValue({
      status: "completed",
      output_parsed: {
        recall: "Kikea Store X-VESOLJE nursing pillows, model NP001",
        product: "C-shaped nursing pillow in white with blue flowers and green leaves",
        label_must_show: [],
        proof_steps: ["The pillow is cut fully in half, so it can no longer be used"],
        note: "",
      },
    });
    const spec = await draftSpec(record, { client: { responses: { parse } } as unknown as OpenAI });

    expect(spec).toEqual({
      recall: "Kikea Store X-VESOLJE nursing pillows, model NP001 (CPSC 27-071)",
      source: kikea.URL,
      product: "C-shaped nursing pillow in white with blue flowers and green leaves",
      label_must_show: [],
      proof_steps: ["The pillow is cut fully in half, so it can no longer be used"],
    });
    const req = parse.mock.calls[0][0];
    expect(req.input[0]).toEqual({ role: "system", content: SPEC_SYSTEM });
    expect(req.input[1].content[0]).toEqual({ type: "input_image", image_url: kikea.Images[0].URL, detail: "original" });
    expect(req.input[1].content[1].text).toBe(buildSpecPrompt(record));
    expect(req.text.format.name).toBe("check_spec");
  });

  it("refuses a draft with no proof steps", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: { recall: "r", product: "p", label_must_show: [], proof_steps: [], note: "" } });
    await expect(draftSpec(record, { client: { responses: { parse } } as unknown as OpenAI })).rejects.toThrow();
  });
});
