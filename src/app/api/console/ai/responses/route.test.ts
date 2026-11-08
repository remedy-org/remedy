import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ANALYST_MODEL, MAX_OUTPUT_TOKENS, rateLimiter, sanitize, SERVER_INSTRUCTIONS, SESSION_LIMIT } from "../guard";

const session = vi.hoisted(() => ({ current: null as null | { role: string; payerId: string; verified: boolean; iat: number } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: async () => session.current }));

const { POST } = await import("./route");

const upstream = vi.fn();
const post = (body: unknown) =>
  POST(new Request("http://127.0.0.1/api/console/ai/responses", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const turn = {
  model: "gpt-6.1-sol",
  input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Why were 9 claims refused?" }] }],
  instructions: "You are the Recall analyst.",
  tools: [
    { type: "function", name: "explain_claim", description: "", parameters: {}, strict: true },
    { type: "function", name: "approve_claim", description: "", parameters: {}, strict: true },
    { type: "web_search" },
  ],
  max_output_tokens: 128_000,
  reasoning: { effort: "high" },
  previous_response_id: "resp_someone_else",
  stream: true,
};

beforeEach(() => {
  session.current = { role: "company", payerId: `CO${Math.random().toString(36).slice(2, 10)}`, verified: true, iat: 1 };
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("ANALYST_MODEL", "");
  upstream.mockReset().mockResolvedValue(new Response("data: {}\n\n", { status: 200, headers: { "Content-Type": "text/event-stream" } }));
  vi.stubGlobal("fetch", upstream);
});

describe("POST /api/console/ai/responses", () => {
  it("refuses without a company session and never calls OpenAI", async () => {
    session.current = null;
    const res = await post(turn);
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toMatch(/Log in with PayPal/);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards one turn with the mini model, an output cap, low effort and no pay tool, and streams it back", async () => {
    const res = await post(turn);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.text()).toBe("data: {}\n\n");

    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe(DEFAULT_ANALYST_MODEL);
    expect(sent.max_output_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(sent.reasoning).toEqual({ effort: "low" });
    expect(sent.store).toBe(false);
    expect(sent.tools.map((t: { name: string }) => t.name)).toEqual(["explain_claim"]);
    expect(sent).not.toHaveProperty("previous_response_id");
    // The server's own instructions come first, then the page's.
    expect(sent.instructions).toBe(`${SERVER_INSTRUCTIONS}\n\n${turn.instructions}`);
  });

  it("uses ANALYST_MODEL when it is set", async () => {
    vi.stubEnv("ANALYST_MODEL", "gpt-5.4-nano");
    await post(turn);
    expect(JSON.parse(upstream.mock.calls[0][1].body).model).toBe("gpt-5.4-nano");
  });

  it("rate-limits one session, and the next session still gets through", async () => {
    for (let i = 0; i < SESSION_LIMIT.requests; i++) expect((await post(turn)).status).toBe(200);
    const limited = await post(turn);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(upstream).toHaveBeenCalledTimes(SESSION_LIMIT.requests);

    // Logging in again (a new session for the same PayPal account) doesn't refill the budget.
    session.current = { ...session.current!, iat: 2 };
    expect((await post(turn)).status).toBe(429);

    session.current = { ...session.current!, payerId: "ANOTHERCO" };
    expect((await post(turn)).status).toBe(200);
  });

  it("rejects a body that isn't a JSON object", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post([1, 2])).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("hides OpenAI's own error text from the browser", async () => {
    upstream.mockResolvedValue(new Response(JSON.stringify({ error: { message: "Incorrect API key provided: sk-test" } }), { status: 401 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(turn);
    expect(res.status).toBe(502);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("sk-test");
    // A key problem says the analyst is unavailable, never that something was "refused".
    expect(body).toContain("unavailable right now");
    expect(body).not.toMatch(/refused/i);
  });
});

describe("sanitize", () => {
  it("drops money-moving tools and a forced choice of one", () => {
    const { body, dropped } = sanitize({ tools: [{ type: "function", name: "pay_claim" }, { type: "function", name: "reject" }], tool_choice: { type: "function", name: "pay_claim" } }, "m");
    expect(dropped).toEqual(["pay_claim", "reject"]);
    expect(body.tools).toEqual([]);
    expect(body.tool_choice).toBe("auto");
  });
});

describe("rateLimiter", () => {
  it("frees a slot once the oldest request leaves the window, and stops everyone at the daily total", () => {
    const limit = rateLimiter({ requests: 2, windowMs: 1_000 }, 3);
    expect(limit.take("a", 0).ok).toBe(true);
    expect(limit.take("a", 100).ok).toBe(true);
    expect(limit.take("a", 200)).toEqual({ ok: false, retryAfter: 1, scope: "session" });
    expect(limit.take("a", 1_001).ok).toBe(true);
    expect(limit.take("b", 1_002)).toMatchObject({ ok: false, scope: "daily" });
  });
});
