import { z } from "zod";

const Env = z.object({
  PAYPAL_CLIENT_ID: z.string(),
  PAYPAL_CLIENT_SECRET: z.string(),
  PAYPAL_API_BASE: z.url().default("https://api-m.sandbox.paypal.com"),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  OPENAI_API_KEY: z.string(),
  VISION_MODEL: z.string().default("gpt-6.1-sol"),
  VISION_EFFORT: z.enum(["low", "medium", "high", "xhigh"]).default("high"),
  // Absent means "use local files under data/".
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  // Public base URL; defaults to the local dev server so the eval and tests run without it.
  APP_URL: z.url().default("http://127.0.0.1:3000"),
});

export type Env = z.infer<typeof Env>;

// Parsed on every call, never at import time, so `next build` works without secrets.
// Empty values count as missing: a copied .env.example leaves keys as `KEY=`.
export function env(): Env {
  const set = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  return Env.parse(set);
}
