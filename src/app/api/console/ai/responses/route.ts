import { getSession } from "@/lib/session";
import { MAX_BODY_BYTES, rateLimiter, sanitize, upstreamMessage, type Body } from "../guard";

// The Recall analyst's model runs through here. AG Studio's OpenAI adapter runs in the browser and POSTs each turn to
// `${endpoint}/responses`; with its endpoint set to /api/console/ai it lands on this route, which checks the company
// session, the rate limits and the request, adds the server's OpenAI key and streams OpenAI's reply straight back.
// The key never reaches the browser, and no tool that approves, rejects or pays a claim is ever offered to the model.

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

// A streamed turn with a few tool calls finishes well inside this.
export const maxDuration = 60;

const limiter = rateLimiter();

// The adapter reads `error.message` from a failed response.
const error = (status: number, message: string, headers?: HeadersInit) => Response.json({ error: { message } }, { status, headers });

export async function POST(request: Request) {
  const session = await getSession("company");
  if (!session) return error(401, "Your session ended. Log in with PayPal again.");

  const key = process.env.OPENAI_API_KEY;
  if (!key) return error(503, "The analyst isn't set up on this server: it needs an OpenAI key.");

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return error(413, "This conversation is too long for the analyst. Start a new one.");
  let raw: Body;
  try {
    raw = JSON.parse(text);
  } catch {
    return error(400, "The request body isn’t JSON.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return error(400, "The request body isn't a JSON object.");

  // One budget per PayPal account, not per login: logging in again doesn't refill it.
  const taken = limiter.take(session.payerId);
  if (!taken.ok) {
    const wait = taken.retryAfter < 120 ? `${taken.retryAfter} seconds` : `${Math.ceil(taken.retryAfter / 60)} minutes`;
    const message =
      taken.scope === "session"
        ? `The analyst answers at most a few questions a minute for one login. Try again in ${wait}.`
        : `The analyst has reached today's limit. Try again in ${wait}.`;
    return error(429, message, { "Retry-After": String(taken.retryAfter) });
  }

  const { body, dropped } = sanitize(raw);
  if (dropped.length) console.warn(`[analyst] dropped tools the analyst may never call: ${dropped.join(", ")}`);

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      // Stopping the chat aborts the browser's request, which cancels this one too.
      signal: request.signal,
    });
  } catch (e) {
    if (request.signal.aborted) return error(499, "Stopped.");
    console.error("[analyst] OpenAI unreachable:", e instanceof Error ? e.message : e);
    return error(502, "The analyst's model didn't answer. Try again in a moment.");
  }

  if (!upstream.ok) {
    // OpenAI's own message can name the key or the account: log it, and tell the reader something useful instead.
    console.error(`[analyst] OpenAI ${upstream.status}:`, (await upstream.text()).slice(0, 500));
    return error(502, upstreamMessage(upstream.status));
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream", "Cache-Control": "no-store" },
  });
}
