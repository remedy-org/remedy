// Spike 1: prove the PayPal money chain Remedy depends on, end to end, in the sandbox.
//   1. OAuth token, and check the app has the Payouts and Log in with PayPal scopes.
//   2. Send a $1.00 payout to a sandbox personal account by email, and wait for the result.
//   3. Log in with PayPal: get the payer ID and verified flag, then pay that exact PAYPAL_ID.
//   4. Fallback identity: a $1 authorize-then-void through Orders v2 (payer ID + account status).
// Run: npm run spike:paypal, then open http://127.0.0.1:8787 when it says so.
// The dashboard refuses to save a "localhost" Return URL (HTTP 520), so we use 127.0.0.1.

import http from "node:http";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const API = "https://api-m.sandbox.paypal.com";
const WEB = "https://www.sandbox.paypal.com";
const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_RECEIVER_EMAIL } = process.env;
const REDIRECT_URI = process.env.PAYPAL_REDIRECT_URI || "http://127.0.0.1:8787/callback";
const PORT = Number(new URL(REDIRECT_URI).port || 8787);
const ORIGIN = new URL(REDIRECT_URI).origin;
const results = { startedAt: new Date().toISOString(), steps: {} };

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_RECEIVER_EMAIL) {
  console.error("Missing PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET or PAYPAL_RECEIVER_EMAIL in .env");
  process.exit(1);
}

const basic = "Basic " + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

async function paypal(method, path, { token, body, form } = {}) {
  const headers = { Authorization: token ? `Bearer ${token}` : basic };
  if (method === "POST") headers["PayPal-Request-Id"] = randomUUID();
  if (form) headers["Content-Type"] = "application/x-www-form-urlencoded";
  else if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, {
    method,
    headers,
    body: form ? new URLSearchParams(form) : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status} ${json.name || json.error || ""}: ${json.message || json.error_description || ""}`);
    err.detail = { status: res.status, debugId: res.headers.get("paypal-debug-id"), body: json };
    throw err;
  }
  return json;
}

function record(step, ok, data) {
  results.steps[step] = { ok, ...data };
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}`, JSON.stringify(data, null, 2));
  mkdirSync("spikes/out", { recursive: true });
  writeFileSync("spikes/out/spike1.json", JSON.stringify(results, null, 2));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendPayout(token, recipientType, receiver, label) {
  const batch = await paypal("POST", "/v1/payments/payouts", {
    token,
    body: {
      sender_batch_header: { sender_batch_id: `remedy-spike-${Date.now()}`, email_subject: "Remedy spike payout" },
      items: [{
        recipient_type: recipientType,
        amount: { value: "1.00", currency: "USD" },
        receiver,
        note: `Remedy spike: ${label}`,
        sender_item_id: `item-${Date.now()}`,
      }],
    },
  });
  const id = batch.batch_header.payout_batch_id;
  for (let i = 0; i < 20; i++) {
    const status = await paypal("GET", `/v1/payments/payouts/${id}`, { token });
    const item = status.items?.[0];
    if (["SUCCESS", "DENIED", "CANCELED"].includes(status.batch_header.batch_status) && item?.transaction_status !== "PENDING") {
      return { payoutBatchId: id, batchStatus: status.batch_header.batch_status, itemStatus: item?.transaction_status, itemErrors: item?.errors };
    }
    await sleep(3000);
  }
  return { payoutBatchId: id, batchStatus: "STILL_PENDING_AFTER_60S" };
}

async function appToken() {
  return paypal("POST", "/v1/oauth2/token", { form: { grant_type: "client_credentials" } });
}

// Step 1 and 2 run immediately.
let token;
try {
  const t = await appToken();
  token = t.access_token;
  const scopes = t.scope.split(" ");
  record("1. app token and scopes", true, {
    appId: t.app_id,
    hasPayoutsScope: scopes.some((s) => s.includes("payouts")),
    hasIdentityScope: scopes.some((s) => s === "openid" || s.includes("identity")),
  });
} catch (e) {
  record("1. app token and scopes", false, { error: e.message, ...e.detail });
  process.exit(1);
}

try {
  record("2. payout to sandbox email", true, await sendPayout(token, "EMAIL", PAYPAL_RECEIVER_EMAIL, "email payout"));
} catch (e) {
  record("2. payout to sandbox email", false, { error: e.message, ...e.detail, hint: e.message.includes("USER_COUNTRY_NOT_ALLOWED") ? "Attach the REST app to a US sandbox business account (spikes/README.md, step 1)." : undefined });
}

// Steps 3 and 4 need a browser, so start a tiny local server.
const done = new Set();
const page = (body) => `<!doctype html><meta name=viewport content="width=device-width"><body style="font:16px system-ui;max-width:560px;margin:40px auto;padding:0 16px">${body}</body>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/") {
      const auth = new URL(`${WEB}/signin/authorize`);
      auth.search = new URLSearchParams({
        flowEntry: "static",
        client_id: PAYPAL_CLIENT_ID,
        response_type: "code",
        scope: "openid profile email https://uri.paypal.com/services/paypalattributes",
        redirect_uri: REDIRECT_URI,
      });
      res.end(page(`<h2>Remedy spike 1</h2>
        <p>Use a <b>US personal sandbox account</b> for both.</p>
        <p><a href="${auth}">3. Log in with PayPal</a></p>
        <p><a href="/hold">4. $1 hold, then release</a></p>
        <p><a href="/done">Finish and print the summary</a></p>`));
    } else if (url.pathname === new URL(REDIRECT_URI).pathname) {
      const code = url.searchParams.get("code");
      if (!code) throw new Error(`No code returned: ${url.search}`);
      const user = await paypal("POST", "/v1/oauth2/token", { form: { grant_type: "authorization_code", code } });
      let info;
      try {
        info = await paypal("GET", "/v1/identity/oauth2/userinfo?schema=paypalv1.1", { token: user.access_token });
      } catch {
        info = await paypal("GET", "/v1/identity/openidconnect/userinfo?schema=openid", { token: user.access_token });
      }
      const payerId = info.payer_id;
      const data = { payerId, verifiedAccount: info.verified_account, userId: info.user_id, emails: info.emails?.length ?? (info.email ? 1 : 0) };
      if (payerId) data.payoutToPayerId = await sendPayout(token, "PAYPAL_ID", payerId, "payout to logged-in payer ID");
      record("3. Log in with PayPal, then pay that PAYPAL_ID", Boolean(payerId) && data.payoutToPayerId?.batchStatus === "SUCCESS", data);
      done.add(3);
      res.end(page(`<p>Step 3 done: payer ID ${payerId ? "received" : "<b>missing</b> (enable the PayPal account ID attribute)"}.</p><p><a href="/">Back</a></p>`));
    } else if (url.pathname === "/hold") {
      const base = ORIGIN;
      const order = await paypal("POST", "/v2/checkout/orders", {
        token,
        body: {
          intent: "AUTHORIZE",
          purchase_units: [{ amount: { currency_code: "USD", value: "1.00" }, description: "Remedy identity check: $1 hold, released at once" }],
          payment_source: { paypal: { experience_context: { return_url: `${base}/hold/return`, cancel_url: `${base}/`, shipping_preference: "NO_SHIPPING", user_action: "CONTINUE" } } },
        },
      });
      const approve = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
      res.writeHead(302, { Location: approve.href }).end();
    } else if (url.pathname === "/hold/return") {
      const orderId = url.searchParams.get("token");
      const auth = await paypal("POST", `/v2/checkout/orders/${orderId}/authorize`, { token, body: {} });
      const authorization = auth.purchase_units[0].payments.authorizations[0];
      await paypal("POST", `/v2/payments/authorizations/${authorization.id}/void`, { token, body: {} });
      const voided = await paypal("GET", `/v2/payments/authorizations/${authorization.id}`, { token });
      record("4. $1 authorize then void", voided.status === "VOIDED", {
        orderId,
        payerId: auth.payer?.payer_id,
        accountStatus: auth.payment_source?.paypal?.account_status,
        authorizationStatus: voided.status,
      });
      done.add(4);
      res.end(page(`<p>Step 4 done: hold ${voided.status}.</p><p><a href="/">Back</a></p>`));
    } else if (url.pathname === "/done") {
      res.end(page("<p>Summary printed in the terminal. You can close this tab.</p>"));
      finish();
    } else {
      res.writeHead(404).end();
    }
  } catch (e) {
    const step = url.pathname.startsWith("/hold") ? "4. $1 authorize then void" : "3. Log in with PayPal, then pay that PAYPAL_ID";
    record(step, false, { error: e.message, ...e.detail });
    res.end(page(`<p>Failed: ${e.message}</p><p><a href="/">Back</a></p>`));
  }
});

function finish() {
  console.log("\nSummary:");
  for (const [step, r] of Object.entries(results.steps)) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${step}`);
  console.log("Full results: spikes/out/spike1.json");
  server.close();
  process.exit(0);
}

server.listen(PORT, () => console.log(`\nNow open ${ORIGIN} in a browser for steps 3 and 4.`));
