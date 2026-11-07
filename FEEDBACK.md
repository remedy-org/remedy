# Feedback on PayPal's developer tools

What we hit while building Remedy on the PayPal sandbox, 5–11 November 2026. Each item says what happened, what we expected, and what we did instead.

## Log in with PayPal

1. **A `localhost` Return URL can't be saved.** Saving `http://localhost:8787/callback` in the app's Log in with PayPal settings fails with "Something went wrong saving the application" (HTTP 520). `http://127.0.0.1:8787/callback` saves fine. Expected: either accept `localhost` or say why not. Workaround: use `127.0.0.1` everywhere, and redirect `localhost` to it in our login start route.
2. **The app owner's own account gets a bare 401 from userinfo.** Logging in with the US business sandbox account that owns the app completes PayPal's consent and the authorization-code exchange, but then both `GET /v1/identity/oauth2/userinfo?schema=paypalv1.1` and `GET /v1/identity/openidconnect/userinfo?schema=openid` return 401 with an empty body. Personal sandbox accounts work. Expected: an error name and message, or a refusal on the consent page before the code is issued. Workaround: our sign-in page now says this account can't sign in and to use another.
3. **`verified_account` is the string `"true"`**, not a boolean, in the userinfo response. Our schema accepts both.
4. **The Return URL dialog's text is about the wrong feature.** It says "Users are redirected to this URL after live transactions. Allow up to three hours for the change to take effect." For Log in with PayPal it's the OAuth redirect URI, and in the sandbox our change worked within minutes.
5. **Signing in to the sandbox with a developer account fails silently.** Entering the developer account's real email on `sandbox.paypal.com` gives "Please check your entries and try again". A hint that the sandbox only accepts sandbox test accounts would have saved time.
6. **The consent page links to `example.com`.** The privacy policy and user agreement URLs default to `https://example.com/privacy` and `/terms`, and the consent page shows them as links.

## Payouts

7. **India sandbox accounts can't send Payouts.** A payout from the default India business sandbox account fails with `USER_COUNTRY_NOT_ALLOWED`. The sandbox account page doesn't mention this, and India-based developers get India accounts by default. Workaround: create US sandbox accounts and build the app under the US business account.
## Orders v2

8. **A sandbox checkout looped into a stale consent session.** In spike 1, an Orders v2 approval opened in the same browser after a Log in with PayPal test went back to the old consent session instead of the checkout. We didn't need Orders, so we stopped there.

## Webhooks

9. **Registering a webhook by API was smooth.** `POST /v1/notifications/webhooks` with the `PAYMENT.PAYOUTS-ITEM.*` event types worked first time, with no dashboard step.
