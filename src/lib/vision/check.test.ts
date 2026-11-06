import type OpenAI from "openai";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckSpec, Verdict } from "../types";
import { buildPrompt, prepareImage, runVisionCheck, SYSTEM } from "./check";

const spec: CheckSpec = {
  recall: "DREO DR-HSH015 space heaters (CPSC 27-054)",
  source: "https://www.cpsc.gov/Recalls/2027/dreo",
  product: "DREO space heater, model DR-HSH015",
  label_must_show: ["model DR-HSH015 and a manufacture date in YYYY/MM format"],
  proof_steps: ["The electrical cord is cut, so the heater can no longer be used", "The label showing model DR-HSH015 is visible"],
};

const verdict: Verdict = {
  label: { text_seen: "DR-HSH015", matches_recalled_product: "yes", evidence: "label" },
  steps: [],
  challenge_code: { text_seen: "K7M", matches: "yes", evidence: "tag" },
  same_item_in_all_photos: "yes",
  looks_like_photo_of_screen_or_print: "no",
  summary: "ok",
};

const image = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#888" } }).png().toBuffer();

beforeEach(() => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
  vi.stubEnv("VISION_MODEL", "");
  vi.stubEnv("VISION_EFFORT", "");
});

describe("buildPrompt", () => {
  it("matches the spike's text", () => {
    expect(buildPrompt(spec, "K7M")).toBe(`Recalled product: DREO space heater, model DR-HSH015. The label must show: model DR-HSH015 and a manufacture date in YYYY/MM format.
Proof steps to check, in this order:
1. The electrical cord is cut, so the heater can no longer be used
2. The label showing model DR-HSH015 is visible
Expected one-time code: K7M`);
  });

  it("handles no label and no code", () => {
    const text = buildPrompt({ ...spec, label_must_show: [] }, null);
    expect(text).toContain("This product has no label: judge whether it is the recalled product from its shape and pattern.");
    expect(text).toContain('This claim has no one-time code; answer "unclear" for the code.');
  });
});

describe("prepareImage", () => {
  it("shrinks to 1568 px on the long side, as JPEG", async () => {
    const meta = await sharp(await prepareImage(await image(4032, 3024))).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1568, 1176]);
  });

  it("never upscales", async () => {
    const meta = await sharp(await prepareImage(await image(800, 600))).metadata();
    expect([meta.width, meta.height]).toEqual([800, 600]);
  });
});

describe("runVisionCheck", () => {
  it("sends the spike's request and returns the parsed verdict", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: verdict, model: "gpt-6.1-sol", usage: { input_tokens: 10, output_tokens: 5 }, status: "completed" });
    const client = { responses: { parse } } as unknown as OpenAI;
    const result = await runVisionCheck({ images: [await image(2000, 1000), await image(300, 300)], spec, code: "K7M", client });

    expect(result).toMatchObject({ verdict, model: "gpt-6.1-sol", usage: { input_tokens: 10 } });
    expect(result.seconds).toBeGreaterThanOrEqual(0);
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe("gpt-6.1-sol");
    expect(req.reasoning).toEqual({ effort: "high" });
    expect(req.input[0]).toEqual({ role: "system", content: SYSTEM });
    const content = req.input[1].content;
    expect(content.slice(0, 2).map((c: { detail: string }) => c.detail)).toEqual(["original", "original"]);
    expect(content[0].image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(content[2]).toEqual({ type: "input_text", text: buildPrompt(spec, "K7M") });
    expect(req.text.format.name).toBe("verdict");
  });

  it("throws when the model's output doesn't parse", async () => {
    const client = { responses: { parse: vi.fn().mockResolvedValue({ output_parsed: null, status: "incomplete" }) } } as unknown as OpenAI;
    await expect(runVisionCheck({ images: [await image(10, 10)], spec, code: null, client })).rejects.toThrow(/unparsed/);
  });

  it("takes 1 to 3 photos", async () => {
    const client = {} as OpenAI;
    await expect(runVisionCheck({ images: [], spec, code: null, client })).rejects.toThrow(/1-3/);
  });
});
