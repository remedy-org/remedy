import { z } from "zod";
import type { CheckSpec, Money, Recall } from "./types";

const API = "https://www.saferproducts.gov/RestWebServices/Recall";

// CPSC leaves some lists null on older records.
const list = <T extends z.ZodType>(item: T) => z.array(item).nullish().transform((v) => v ?? []);
const Named = z.object({ Name: z.string() });

// The fields Remedy uses from a CPSC API record (example: __fixtures__/cpsc-27071.json).
export const CpscRecord = z.object({
  RecallID: z.number(),
  RecallNumber: z.string(),
  RecallDate: z.string(),
  Title: z.string(),
  Description: z.string(),
  URL: z.url(),
  Products: list(z.object({ Name: z.string(), Description: z.string().nullish(), Model: z.string().nullish(), NumberOfUnits: z.string().nullish() })),
  Images: list(z.object({ URL: z.url(), Caption: z.string().nullish() })),
  Hazards: list(Named),
  Remedies: list(Named),
  Manufacturers: list(Named),
  Retailers: list(Named),
});
export type CpscRecord = z.infer<typeof CpscRecord>;

export type RecallRef = { number: string } | { url: string };

// Accepts "27-071", "27071" or a cpsc.gov recall page URL.
export function parseRecallRef(input: string): RecallRef {
  const s = input.trim();
  const n = s.match(/^(\d{2})-?(\d{3,4})$/);
  if (n) return { number: n[1] + n[2] };
  if (URL.canParse(s) && /(^|\.)cpsc\.gov$/.test(new URL(s).hostname)) return { url: s };
  throw new Error(`Not a CPSC recall number or cpsc.gov URL: ${input}`);
}

// "27071" -> "27-071", the form CPSC prints and Remedy uses as the recall id.
export const recallId = (r: Pick<CpscRecord, "RecallNumber">) => `${r.RecallNumber.slice(0, 2)}-${r.RecallNumber.slice(2)}`;

const samePage = (a: string, b: string) => {
  const key = (u: string) => {
    const url = new URL(u);
    return (url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/$/, "")).toLowerCase();
  };
  return key(a) === key(b);
};

// Both API filters match substrings ("Kikea-Store" finds the Kikea recall), so keep only the exact match.
export async function fetchCpscRecall(input: string): Promise<CpscRecord | null> {
  const ref = parseRecallRef(input);
  const query = new URLSearchParams({ format: "json" });
  if ("number" in ref) query.set("RecallNumber", ref.number);
  else query.set("RecallURL", new URL(ref.url).pathname.replace(/\/$/, ""));
  const res = await fetch(`${API}?${query}`);
  if (!res.ok) throw new Error(`CPSC API -> ${res.status}`);
  const records = z.array(CpscRecord).parse(await res.json());
  return records.find((r) => ("number" in ref ? r.RecallNumber === ref.number : samePage(r.URL, ref.url))) ?? null;
}

export function toRecall(r: CpscRecord, { refund, spec, now = new Date() }: { refund: Money; spec: CheckSpec; now?: Date }): Recall {
  return {
    id: recallId(r),
    title: r.Title,
    url: r.URL,
    recallDate: r.RecallDate.slice(0, 10),
    product: r.Products.map((p) => p.Name).join("; "),
    units: r.Products.map((p) => p.NumberOfUnits).filter(Boolean).join("; "),
    remedy: r.Remedies.map((x) => x.Name).join(" "),
    images: r.Images.map((i) => ({ url: i.URL, caption: i.Caption ?? "" })),
    refund,
    spec,
    createdAt: now.toISOString(),
  };
}
