# Final rehearsal and recording

Prepared 10 November 2026. These are manual checks for the project owner. Running the claim steps creates persisted application records and sandbox payments; they were not performed during the read-only submission audit. Do not mark them complete from UI tests or historical evidence.

## One final operational run

Use **https://remedy-recalls.vercel.app** after the refined release is promoted. Keep one browser for the entire run so its demo-round cookie follows the claims into the company view.

| Check | Steps | Passing evidence |
| --- | --- | --- |
| Canonical journey | Open `/r/kikea-x-vesolje/try`. Copy the displayed sandbox credentials; log in with PayPal. | PayPal returns to `remedy-recalls.vercel.app`, the owner is signed in, and **Choose a claim** appears. No real personal account is used. |
| Genuine prepared claim | Select **A genuine claim**, continue to its photo and submit it for checking. | All five checks pass and the refund amount is $29.99. Retain the new claim ID. |
| Confirmed payment | Keep the result open until PayPal reports success; inspect the payout reference. | A completed/confirmed PayPal sandbox status for that new claim, not just an accepted batch, approved claim or homepage receipt. If it remains pending/held, record that actual state. |
| Reused photo | Return to the picker in the same round; run **A photo used before** after the genuine claim. | Blocked at **Photo not used before**, naming the earlier claim; no new payout. |
| Wrong code | Run **Wrong code on the tag**. | The evidence says K7Q on the tag and K7P required; rejected on the code; no payout. |
| Outside session | Run **A photo from the web**. | Blocked at **Sent in the camera session**, before the model; no payout. This demonstrates admission enforcement, not AI-generated-image detection. |
| Company evidence | Follow the result's company link. If asked, expand **Explore with the demo account** on `/signin` and log in with the same sandbox account. Search/open the new genuine claim. | Same claim ID, photo, decision and PayPal reference/status as the owner's receipt. Distinguish it from the seven built-in claims. |
| Reporting | Open Insights and the report. Ask the Recall analyst to explain the just-created claim, using its ID. | Chart/report figures and the answer agree with the evidence. The analyst explains or drafts; it does not approve or pay. |

Record only the evidence needed for the video and final check. Do not repeatedly start fresh rounds just to obtain nicer footage. **Start over** creates a new demo round; it does not cancel an already sent payout or erase the stored claim.

## Real phone and handwriting check

This remains a separate gap until performed. The prepared sample does not validate a camera, real handwriting or capture under ordinary lighting.

1. Open `/r/kikea-x-vesolje` on a phone, or use its desktop-to-phone QR handoff. Log in with the sandbox account.
2. Note the freshly issued three-character code. Follow the recall page's instructions for a matching test item and write the requested product name and code on a paper tag.
3. Allow camera access and take a real photo showing the item, tag and required destruction together. Verify the preview shows the same item and readable tag, then send it within the ten-minute session.
4. Save a sanitized record of the phone/browser, lighting, claim ID, model's code transcription, visible-step answers, decision and actual payout state. Do not record credentials, session/capture keys or full account identifiers.
5. If capture or recognition fails, retain that outcome and its reason. Do not change the pitch to “validated real capture” until the test supports it. If a matching test item is unavailable, keep the limitation explicit and demonstrate the prepared flow instead.

## Under-three-minute video beat sheet

Target **2:40–2:50**, with room for an ending. Use actual product footage, English narration or captions, and clearly label sandbox and prepared content. AI voiceover is allowed by the organizer's [video guidance](https://paypalaihackathon.devpost.com/updates/47306-lights-camera-paypal-video-tips-and-how-judging-works).

| Time | Screen/action | Main point |
| --- | --- | --- |
| 0:00–0:15 | Brief animated product story or recall page | “A recall asks an owner to destroy a product and email a photo. Remedy connects that evidence to an inspectable decision and a PayPal refund.” |
| 0:15–0:55 | Prepared owner flow, real model check, new receipt | State that photos are prepared and payments are sandbox. Show the actual new claim ID and confirmed payout; cut waiting time transparently. |
| 0:55–1:15 | Wrong-code and pre-AI blocked results | One exact mismatch, one admission/reuse block. Explain why each stops without claiming universal fraud detection. |
| 1:15–1:45 | Same claim in company AG Grid queue and evidence panel | Show one shared trail: photo, quoted model answers, rule and PayPal status. Briefly show the held case and human-review path without sending an unnecessary second payment. |
| 1:45–2:15 | AG Studio Insights and Recall analyst | Show custom widgets and one useful explanation tied to a claim. Mention that the analyst has no payment tools. |
| 2:15–2:35 | Recall import preview or printable report | Explain that companies draft checks from the public CPSC notice and review them before publication. Avoid publishing a new recall just for a visual cut. |
| 2:35–2:50 | Product and final links | State the boundary: evidence review with fixed rules and traceable payouts, not a guarantee against generated images. Give the website and public source. |

Do not show password entry, provider keys or private account details. Do not substitute the illustrative RM-0442 homepage payout for the fresh transaction. If real phone testing is not complete, show `/try` and name it accurately. A long feature tour is less useful than one completed owner-to-company story.

## Record the final outcome

Fill this table after the manual run; empty means unverified.

| Evidence | Result |
| --- | --- |
| Final release commit and canonical URL | |
| Rehearsal date/time | |
| New genuine claim ID and sanitized confirmed payout reference/status | |
| Wrong-code claim ID and decision | |
| Outside-session claim ID and decision | |
| Repost claim ID and earlier-claim match | |
| Same claim verified in company evidence | |
| Real phone/handwriting result, or explicitly still pending | |
| Public YouTube URL and processed duration | |

Upload early enough for YouTube processing, then verify the video and repository while signed out. The [submission deadline](https://paypalaihackathon.devpost.com/updates/47308-3-days-left-submissions-close-thursday-at-noon-pst) is **13 November 2026 at 01:30 IST**. After it, freeze the linked repository, README and video until the announcement.
