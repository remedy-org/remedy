import { z } from "zod";

export const DEV_SESSION_SECRET = "remedy-dev-only-session-secret-not-for-production";

const Limit = z.coerce.number().int().nonnegative();

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
  // Signs the session cookies (HMAC-SHA256). The default is for local dev only; session.ts refuses it in production.
  SESSION_SECRET: z.string().min(32).default(DEV_SESSION_SECRET),
  // What the live demo may spend (src/lib/limits.ts). Days are UTC. Vercel Blob's Hobby plan allows 2,000 writes a
  // month and suspends the store for 30 days past it: a real claim costs about 10 writes, a demo round of four about 24.
  // 30 real claims (about 300 writes) and 200 demo claims (50 rounds, about 1,200) fit any 30 days with room to spare.
  VISION_DAILY_LIMIT: Limit.default(100),
  DRAFT_DAILY_LIMIT: Limit.default(20),
  CLAIM_DAILY_LIMIT: Limit.default(10),
  CLAIM_MONTHLY_LIMIT: Limit.default(30),
  ACCOUNT_CLAIM_DAILY_LIMIT: Limit.default(5),
  // The demo's own limits: demo claims never count towards the claim limits above, so judges can't use up real owners'
  // claims. Judges share the sandbox login from the Devpost notes, so one account runs every judge's samples: 40 is
  // 10 rounds of four a day. Two of the four reach the model (about 1.1 cents each), and VISION_DAILY_LIMIT caps the rest.
  ACCOUNT_DEMO_DAILY_LIMIT: Limit.default(40),
  // Demo claims every account together, a day and in any 30 days: each start costs Blob writes, sent or abandoned.
  DEMO_DAILY_LIMIT: Limit.default(40),
  DEMO_MONTHLY_LIMIT: Limit.default(200),
});

export type Env = z.infer<typeof Env>;

// Parsed on every call, never at import time, so `next build` works without secrets.
// Empty values count as missing: a copied .env.example leaves keys as `KEY=`.
export function env(): Env {
  const set = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  return Env.parse(set);
}
