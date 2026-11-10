# Remedy design system

Updated 10 November 2026. This replaces the previous Lamplight/brass system at the user's request. Reference measurements and full product transformation plan: `../planning/visual-redesign-2026-11-10/`.

## Direction

Product-led marketing; calm evidence and refund operations.
Pure black, violet action, crisp photography, rounded frames, technical display type.
Spacious marketing, comfortable owner flow, dense company workspace; short state transitions.

Remedy uses a black canvas, violet actions and a distinct return-receipt identity.

## Tokens

`src/app/globals.css` owns colors and sizing. Keep semantic token names; do not hard-code old warm values in components.

| Role | Dark |
|---|---|
| Page | #000000 |
| Surface / inset / raised | #19161D / #211D25 / #29242F |
| Structural line / control outline | #352F3D / #82768F |
| Text / secondary / muted | #FAFAFA / #DEDBE2 / #C1BEC6 |
| Violet action / lavender link-focus | #9147FF / #C59EFF |
| Paid / review / stopped | #68DFA1 / #82B2FF / #FF7A88 |

The explicit light app theme uses cool white/violet neutrals and deeper semantic tones. Marketing always renders dark; visiting it must not overwrite the saved app preference. New app visitors start dark. Print reports remain white.

Violet communicates the next action or selection. Green communicates confirmed payment; blue human review; red a refused/blocked claim. Pair every semantic color with an icon and label. Check token contrast with `npx tsx scripts/contrast.ts`.

## Typography

This hackathon deployment uses user-supplied ABC Diatype Regular and Bold for headings, navigation and body/UI, with permission reported by the user on 10 November 2026. These are the standard Diatype faces, not AWS Diatype Rounded Semi Mono. IBM Plex Mono remains for codes and identifiers.

The font binaries live in Git-ignored `public/fonts/diatype/` and are included only in the CLI deployment. `next.config.ts` detects their presence at build time and compiles the same choice into static and dynamic routes. Source checkouts without those files use Inter headings and Work Sans body text, self-hosted by next/font. The fallback never requires private fonts to build.

The user-provided Diatype binaries are not committed to the public repository. Font families are centralized in root layout and the `--font-sans`, `--font-display`, `--font-mono` tokens, including AG Grid and Studio.

Hero 40–60px, section heading 28–40px, feature title 22–25px, body 17px, UI 15px, metadata 12px. Display line height 1.1 with restrained negative tracking; body 1.55. Use medium/semibold headings, not arbitrary bold inline prose. Amounts and data use tabular figures. Always check longest realistic recall title/reason.

## Layout and controls

Fluid 24–64px gutters, 12-column shared alignment, 4/8px rhythm. Desktop marketing navigation 72px; app header remains 64px to match existing viewport offsets. No horizontal page overflow at 375px; grid overflow is scoped to its region.

Radius: 48px showcase, 24px major frame, 16px card/large button, 10–12px controls. Data views keep tight hairline structure. Large violet buttons have white labels, turn white with dark labels on hover in dark mode, and show independent visible keyboard focus. Touch targets are at least 44px. Keep pending labels stable and actions explicit.

No global grain, warm light pools, floor grids, ornamental bevels or forced scroll choreography. Photograph content is never recolored. White code examples remain white for writing legibility. Report sheets remain white for print.

## Identity

The original return-receipt mark is a rounded slip with a negative-space return arrow and a small folded tail. Master paths live in `components/ui/markPaths.ts`; Wordmark, Open Graph and generated icons share them. Run `npx tsx scripts/apple-icon.ts` after changing the paths. Wordmark is lowercase `remedy`; accessible product name is Remedy. One-color white or text-color master.

## States, truth and motion

Every data surface includes empty/loading/error/partial/success states and preserves existing focus, recovery and keyboard behavior. The state models, auth, payment APIs, deterministic rule and AG integrations remain authoritative.

Home previews are illustrative, use prepared data, and must say so. Demo entry/result identifies PayPal sandbox and prepared photos. Never imply a generated-photo detector, camera provenance attestation, guaranteed settlement time, or a real customer deployment. RM-0442's sample payment/timings are not a fresh PayPal transaction. AI describes evidence, the fixed rule decides, and the payment provider confirms the payout.

Controls transition in 150–200ms, panels in 200–300ms. Respect prefers-reduced-motion. Essential content appears without an animation and scrolling stays native. Product view selection is explicit and never overrides the visitor's choice.

## Verification

Headless browser review at 375/390/768/1024/1280/1440 widths; keyboard and reduced-motion checks; dark and explicit light app theme; token contrast; static checks/build and audited pure tests. Use in-memory preview routes, never authenticated GETs that can update claims, under the standing write restriction. A real camera/handwriting/payout run is separate runtime evidence and cannot be certified by fixture screenshots.
