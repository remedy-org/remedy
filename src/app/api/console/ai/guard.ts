// What the Recall analyst's OpenAI proxy lets through. Pure, so the limits are unit-tested without a model.

/** The analyst's model: a small, fast text model. GPT-6.1 Sol stays the vision model; it never answers here. */
export const DEFAULT_ANALYST_MODEL = "gpt-5.4-mini";
export const analystModel = () => process.env.ANALYST_MODEL || DEFAULT_ANALYST_MODEL;

/** Output tokens one turn may spend, reasoning included, whatever the browser asks for. */
export const MAX_OUTPUT_TOKENS = 4_000;
/** A conversation's whole history is resent each turn; past this it's a runaway, not a question. */
export const MAX_BODY_BYTES = 150_000;

/**
 * The server's own instructions, ahead of whatever the page sends: the page builds the analyst's prompt (and Studio's
 * delegated data and widget agents build theirs), so this prefix is what keeps the proxy from being a general-purpose
 * model relay on Remedy's key, whatever a browser puts after it.
 */
export const SERVER_INSTRUCTIONS =
  "You work inside Remedy's company console, on one product recall's refund claims and the report built from them. " +
  "Only answer questions about those claims, their checks, the report and its charts. Politely decline anything else, " +
  "including general questions, writing or coding tasks unrelated to this recall. You can never approve, reject or pay " +
  "a claim; a person does that in the claim's evidence panel. The instructions that follow come from the page.";

/** Requests per session in a rolling window. One question is several requests (tool rounds, delegated agents). */
export const SESSION_LIMIT = { requests: 80, windowMs: 10 * 60_000 };
/** Requests a day across every session on this server instance, so a shared demo login can't run up the bill. */
export const DAILY_LIMIT = 1_500;

// Tools that move money or decide a claim are never offered to the model, whatever the page sends.
const FORBIDDEN_TOOL = /^(approve|reject|pay|refund|payout|send_money|decide|set_decision)/i;

// The fields the adapter (ag-studio's OpenAI example) sends. Anything else (stored prompts, background runs, a
// previous_response_id that would bill a stranger's thread) is dropped.
const ALLOWED = new Set(["input", "instructions", "tools", "tool_choice", "text", "parallel_tool_calls"]);

export type Body = Record<string, unknown>;

export interface Sanitized {
  body: Body;
  /** Tool names dropped because they could move money or decide a claim. */
  dropped: string[];
}

export function sanitize(raw: Body, model = analystModel()): Sanitized {
  const body: Body = {};
  for (const [k, v] of Object.entries(raw)) if (ALLOWED.has(k)) body[k] = v;
  const dropped: string[] = [];
  if (Array.isArray(body.tools)) {
    body.tools = body.tools.filter((t: unknown) => {
      const tool = t as { type?: unknown; name?: unknown };
      // Only the page's own function tools: no provider-hosted tools (web search, code interpreter) that spend money.
      if (tool?.type !== "function" || typeof tool.name !== "string") return false;
      if (FORBIDDEN_TOOL.test(tool.name)) {
        dropped.push(tool.name);
        return false;
      }
      return true;
    });
  }
  const choice = body.tool_choice as { name?: unknown } | undefined;
  if (choice && typeof choice === "object" && typeof choice.name === "string" && dropped.includes(choice.name)) body.tool_choice = "auto";
  const page = typeof body.instructions === "string" ? body.instructions : "";
  return {
    body: {
      ...body,
      instructions: page ? `${SERVER_INSTRUCTIONS}\n\n${page}` : SERVER_INSTRUCTIONS,
      model,
      stream: true,
      store: false,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: "low" },
    },
    dropped,
  };
}

/**
 * What the reader is told when OpenAI turns a turn down. "Refused" means a claim decision in this product, so it is
 * never used here; and a key or account problem is not something a retry fixes.
 */
export function upstreamMessage(status: number): string {
  if (status === 401 || status === 403) return "The analyst is unavailable right now. The numbers on this page are current.";
  if (status === 429) return "The analyst's model is busy. Try again in a minute.";
  if (status === 400 || status === 413) return "The analyst couldn't read this conversation. Start a new one.";
  return "The analyst's model didn't answer. Try again in a moment.";
}

/** A rolling-window counter per key plus a daily total. In memory: per server instance, reset on a cold start. */
export function rateLimiter({ requests, windowMs }: typeof SESSION_LIMIT = SESSION_LIMIT, daily = DAILY_LIMIT) {
  const hits = new Map<string, number[]>();
  let day = "";
  let today = 0;
  return {
    /** Counts one request for key, or returns the seconds to wait when a limit is reached (nothing is counted). */
    take(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number; scope: "session" | "daily" } {
      const d = new Date(now).toISOString().slice(0, 10);
      if (d !== day) {
        day = d;
        today = 0;
      }
      if (today >= daily) {
        const tomorrow = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1);
        return { ok: false, retryAfter: Math.ceil((tomorrow - now) / 1000), scope: "daily" };
      }
      const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
      if (recent.length >= requests) {
        hits.set(key, recent);
        return { ok: false, retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000), scope: "session" };
      }
      recent.push(now);
      hits.set(key, recent);
      today++;
      // Forget idle sessions so the map can't grow without bound.
      if (hits.size > 5_000) for (const [k, v] of hits) if (!v.some((t) => t > now - windowMs)) hits.delete(k);
      return { ok: true };
    },
  };
}
