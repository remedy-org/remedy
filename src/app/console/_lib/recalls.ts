import { z } from "zod";
import type { CpscRecord } from "@/lib/cpsc";
import { recallId, unitsSold } from "@/lib/cpsc";
import { CheckSpec, RecallSlug } from "@/lib/types";

// Shapes the recall import and settings routes accept, shared with the client forms.

// "29.99", from $1.00 to $10,000.00: PayPal takes amounts as strings with two decimals.
export const RefundValue = z
  .string()
  .trim()
  .transform((s) => s.replace(/^\$/, "").replace(/,/g, ""))
  .pipe(z.string().regex(/^\d{1,5}(\.\d{1,2})?$/, "Enter an amount like 29.99"))
  .transform((s) => Number(s).toFixed(2))
  .refine((s) => Number(s) >= 1 && Number(s) <= 10_000, "Refunds run from $1.00 to $10,000.00");

export const RecallRefInput = z.object({ ref: z.string().trim().min(5, "Paste a cpsc.gov recall URL or a number like 27-071").max(400) });

// The company edits the draft; recall and source stay as the model and CPSC gave them.
export const SpecInput = CheckSpec.extend({
  product: z.string().trim().min(3, "Describe the product").max(600),
  label_must_show: z.array(z.string().trim().min(2).max(300)).max(8),
  proof_steps: z.array(z.string().trim().min(3, "A step can't be empty").max(300)).min(1, "Keep at least one step").max(8),
  note: z.string().trim().max(800).optional(),
});

export const PublishInput = z.object({
  ref: z.string().trim().min(5).max(400),
  spec: SpecInput,
  refund: RefundValue,
  autoPay: z.boolean(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters and numbers, joined by single dashes")
    .max(64, "Keep it under 64 characters")
    .pipe(RecallSlug),
});

export const SettingsInput = z.object({ refund: RefundValue, autoPay: z.boolean() });

// What the import step shows before the model drafts the checks.
export interface CpscSummary {
  id: string;
  title: string;
  url: string;
  recallDate: string;
  product: string;
  units: string;
  unitsSold: number;
  remedy: string;
  hazard: string;
  firm: string;
  image: { url: string; caption: string } | null;
  slug: string;
}

export function summarizeCpsc(r: CpscRecord): CpscSummary {
  const product = r.Products.map((p) => p.Name).join("; ");
  // Retailer entries are sentences ("Sold At: Target..."), so fall back to the title's "<Firm> Recalls ..." instead.
  const firm = r.Manufacturers[0]?.Name ?? r.Title.match(/^(.+?) Recalls? /)?.[1] ?? "";
  const image = r.Images[0];
  return {
    id: recallId(r),
    title: r.Title,
    url: r.URL,
    recallDate: r.RecallDate.slice(0, 10),
    product,
    units: r.Products.map((p) => p.NumberOfUnits).filter(Boolean).join("; "),
    unitsSold: unitsSold(r),
    remedy: r.Remedies.map((x) => x.Name).join(" "),
    hazard: r.Hazards.map((h) => h.Name).join(" "),
    firm,
    image: image ? { url: image.URL, caption: image.Caption ?? "" } : null,
    slug: slugify(product || r.Title),
  };
}

// "X-VESOLJE Nursing Pillows" -> "x-vesolje-nursing-pillows", at most 48 characters on a word boundary.
export function slugify(text: string): string {
  const words = text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  let slug = "";
  for (const w of words) {
    const next = slug ? `${slug}-${w}` : w;
    if (next.length > 48) break;
    slug = next;
  }
  return slug || "recall";
}

// The slug, or slug-2, slug-3... if it's taken by another recall.
export function uniqueSlug(slug: string, taken: { slug: string; id: string }[], id: string): string {
  const clash = (s: string) => taken.some((r) => r.slug === s && r.id !== id);
  if (!clash(slug)) return slug;
  for (let n = 2; ; n++) {
    const s = `${slug.slice(0, 60)}-${n}`;
    if (!clash(s)) return s;
  }
}
