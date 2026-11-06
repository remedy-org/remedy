import { describe, expect, it, vi } from "vitest";
import kikea from "./__fixtures__/cpsc-27071.json";
import { CpscRecord, fetchCpscRecall, parseRecallRef, recallId, toRecall } from "./cpsc";

const record = CpscRecord.parse(kikea);

function mockCpsc(body: unknown, status = 200) {
  const fetch = vi.fn<(url: string) => Promise<Response>>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("parseRecallRef", () => {
  it("accepts a recall number with or without the dash, or a cpsc.gov URL", () => {
    expect(parseRecallRef("27-071")).toEqual({ number: "27071" });
    expect(parseRecallRef(" 27071 ")).toEqual({ number: "27071" });
    expect(parseRecallRef(kikea.URL)).toEqual({ url: kikea.URL });
  });

  it("refuses anything else", () => {
    expect(() => parseRecallRef("https://evil.example/Recalls/x")).toThrow();
    expect(() => parseRecallRef("pillow")).toThrow();
  });
});

describe("fetchCpscRecall", () => {
  it("queries by recall number and keeps the exact match", async () => {
    const fetch = mockCpsc([{ ...kikea, RecallNumber: "270710" }, kikea]);
    const r = await fetchCpscRecall("27-071");
    expect(r?.RecallID).toBe(11047);
    expect(fetch.mock.calls[0]).toEqual(["https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=27071"]);
  });

  it("queries by URL path, ignoring protocol, www and a trailing slash", async () => {
    const fetch = mockCpsc([kikea]);
    const page = kikea.URL.replace("https://www.", "http://") + "/";
    expect((await fetchCpscRecall(page))?.RecallNumber).toBe("27071");
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("RecallURL")).toBe(new URL(kikea.URL).pathname);
  });

  it("returns null when nothing matches exactly", async () => {
    mockCpsc([]);
    expect(await fetchCpscRecall("27-999")).toBeNull();
  });

  it("throws on an API error", async () => {
    mockCpsc({}, 503);
    await expect(fetchCpscRecall("27-071")).rejects.toThrow(/503/);
  });
});

describe("toRecall", () => {
  it("maps the Kikea record", () => {
    const spec = { recall: "x", source: kikea.URL, product: "pillow", label_must_show: [], proof_steps: ["cut"] };
    const recall = toRecall(record, { refund: { value: "29.99", currency: "USD" }, spec, now: new Date("2026-11-06T09:00:00Z") });
    expect(recall).toMatchObject({
      id: "27-071",
      recallDate: "2026-11-05",
      product: "X-VESOLJE Nursing Pillows",
      units: "About 19,596",
      images: [{ url: kikea.Images[0].URL, caption: kikea.Images[0].Caption }],
      createdAt: "2026-11-06T09:00:00.000Z",
    });
    expect(recall.remedy).toMatch(/cut the pillow in half/);
    expect(recallId(record)).toBe("27-071");
  });
});
