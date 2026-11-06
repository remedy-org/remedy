# Remedy: product map

What we build for the PayPal AI Hackathon (submit 11 Nov 2026), and how each screen behaves. `DESIGN.md` owns how it looks; this file owns what exists and what it does.

**One line:** recall refunds in a minute for people who really destroyed the product, and never for a faked photo.

Remedy is its own website built on PayPal's public APIs. Companies running a recall are the customers; owners of the recalled product never create a Remedy account. Refunds go from the company's PayPal business account straight to the owner's PayPal account; Remedy never holds money.

## Decisions (7 Nov 2026)

| Topic | Decision |
|---|---|
| Stack | One Next.js 16 app (Tailwind 4, AG Grid 36) on Vercel. API in route handlers; no separate backend. |
| Language | TypeScript, strict, for all new code. The `.mjs` spike scripts stay as the record of the experiments. |
| Storage | Vercel Blob: private photos, one JSON file per claim, one index file. No database. |
| Vision | GPT-6.1 Sol at high effort describes; a fixed rule in code decides. |
| Photos | Real claims use the live camera only (laptop webcam or phone). Judges get a labelled "Try with sample photos" demo. |
| Company sign-in | Log in with PayPal (business account). A new company's workspace starts with the Kikea demo recall. |
| Screens | Laptop first everywhere, and fully usable on a phone. |
| Repo | Private until the freeze (Tue 10 Nov 23:59 IST), then public with its history. |

## Routes

| Route | Who | What |
|---|---|---|
| `/` | Everyone, judges first | The homepage that sells the idea. Sign in for companies; a "See a claim" path for judges. |
| `/signin` | Companies | Log in with PayPal, then on to `/console`. |
| `/console` | Companies | Claims grid (AG Grid) with the evidence drawer, overrides and the remedied-against-sold meter. |
| `/console/recalls/new` | Companies | Import a recall from a CPSC URL or number; review the drafted checks; publish. |
| `/console/recalls/[id]` | Companies | Recall settings: refund amount, auto-pay on or off, claim link and QR code. |
| `/console/report` | Companies | The CPSC progress-report draft, generated from the claims. |
| `/r/[recall]` | Owners | The claim flow (below). |
| `/r/[recall]/try` | Judges | Demo mode with sample photos, labelled on every screen. |
| `/api/...` | System | PayPal login callback, claim start, photo capture, PayPal webhooks, recall import. |

## The owner's claim flow

1. **Recall.** What was recalled and why, the refund amount, and the four steps ahead. One action: Log in with PayPal.
2. **PayPal login.** PayPal's own consent page. We get the payer ID and the verified flag.
3. **Code.** A one-time code (letter-digit-letter, no look-alike characters) and how to write it on a tag. The capture session lasts 10 minutes.
4. **Capture.** A live camera with no upload control. On a laptop: the webcam, or a QR code to continue on a phone. Up to 3 photos: the label, the destruction, the code (or one photo with all three).
5. **Checking.** Each check appears as it resolves: live session, photo not seen before, first claim for this account, then the model's answers.
6. **Result.**
   - **Paid:** the amount, PayPal's payout status, and the time.
   - **Held:** what a person will look at, and when.
   - **Rejected:** the exact reason, and what to do instead.

## The company's console

- **Claims grid:** claim, time, PayPal account (masked, verified), decision, reason, payout status, amount. Filter by decision; sort by time.
- **Evidence drawer:** photos, every model answer with its quoted evidence, the pre-checks, the rule's decision, and approve or reject for held claims.
- **Header:** units remedied of units sold, paid out, waiting for review, refused.
- **Recall import:** paste a CPSC URL. The model drafts the checks under the five spec rules (`docs/EVAL.md`); the company edits, then publishes.

## Demo mode for judges

`/r/kikea-x-vesolje/try` runs the real pipeline on sample photos:
- a genuine claim, which pays;
- an AI image sent without a live session, refused before the model;
- a photo reposted from an earlier claim, refused as a duplicate;
- a wrong code, rejected by the model's reading.

Each run states that it is demo mode, and all money is sandbox money.

## States every data view must handle

Empty, loading, error, partial and success. Examples: a console with no claims yet; a claim whose payout is still pending; PayPal or the model being down (the claim is held, never lost).
