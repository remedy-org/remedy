# UI transformation: verification and handoff

10 November 2026. Implementation is uncommitted. The latest UI and Diatype font files are deployed to https://remedy-recalls.vercel.app.

Deployment: `dpl_DVimJqMNM1uV9NFajWWMKrSfmYue` (production, Ready). Both WOFF2 assets returned HTTP200 and matched the local SHA256; homepage, sign-in and demo entry loaded both weights correctly. No live mobile overflow or page errors were observed. Release evidence is in `../planning/kiro-redesign-2026-11-10/transformation/diatype-release.json`.

## Delivered

- Pure-black/violet theme, cool dark surfaces, semantic status colors, explicit light app theme.
- ABC Diatype Regular/Bold headings and body/UI for the user-authorized hackathon deployment; IBM Plex Mono identifiers. Inter/Work Sans remain the clean-checkout fallback. Open-font notices are in `public/font-licenses/`.
- Original one-color Remedy return-receipt logo, favicon, apple icon and share image.
- Product-led homepage with normal scrolling, keyboard-accessible three-view showcase, recorded evidence drill-down, company previews, four demo cases and precise limitations.
- Owner/judge entry, credentials, code card, photo treatment, results and receipts; existing camera, recovery, review and payout state behavior preserved.
- Company chrome, metrics, status tabs, grid, evidence panel, recall setup and printable report.
- AG Grid and AG Studio themes/fonts, custom widgets, responsive analyst rail and loading state alignment.
- Consistent sample/sandbox disclosures, metadata, README and product/agent-readable notes.

## Verified

| Check | Result |
|---|---|
| Production build, including TypeScript | Pass |
| ESLint | Pass |
| Token contrast, dark and light | Every required pair passes |
| Targeted tests | 8 files, 72 tests passed |
| Source diff whitespace check | Pass |
| Homepage widths | 375, 390, 768, 1024, 1280, 1440px; no horizontal page overflow |
| Claim fixtures | Desktop/mobile code, camera, checking, paid, held, rejected, blocked; camera denial/expiry |
| Product preview interaction | Arrow/Home/End tab behavior, claim drill-down, precheck detail without an empty AI quote, focus moves to evidence panel |
| Navigation | Mobile Escape/focus return, section-link heading focus, correct CTA paths |
| Theme | Dark homepage preserves saved light preference; app restores it; toggle saves choice |
| Company previews | AG Grid and AG Studio rendered with in-memory data; no model turn invoked |
| Production public routes | Homepage, sign-in, try entry, privacy, terms returned 200; no page errors |
| Share image | Rendered 1200 × 630 |

The final font change was followed by another successful build/TypeScript/lint run and six-width homepage check. The 72 targeted tests passed before the font-only change; no domain behavior changed afterward.

Exact targeted test command:

```sh
npx vitest run src/components/claim/CheckList.test.ts src/components/claim/LimitNotice.test.ts src/components/claim/model.test.ts src/components/claim/CheckList.grouping.test.ts src/app/svg-valid.test.ts src/app/skip-links.test.ts src/components/home/companies-copy.test.ts src/components/home/tour-state.test.ts
```

## Review access

- Local visual preview: `http://127.0.0.1:3107/`
- Company/evidence fixtures: `/dev/redesign`
- Insights fixtures: `/dev/redesign?view=insights`
- Print report fixture: `/dev/redesign?view=report`
- Owner fixtures: `/dev/claim?s=code`, `?s=paid-settled`, `?s=held`, `?s=rejected`, `?s=camera-denied`

The review server uses placeholder provider credentials and does not validate PayPal login/payments. Fixture routes return not-found in production. Screenshots and machine-readable verification are in `../planning/kiro-redesign-2026-11-10/transformation/`.

## Boundaries and release notes

No API, auth, payment, rule, storage, or claim-state implementation changed. No authenticated console, fresh claim submission, model evaluation, payout, persisted-store write, AWS/Terraform operation, commit or push was performed. The Vercel deployment was explicitly authorized by the user.

Authenticated console GETs can reconcile stored claims, so they were not used under the standing write restriction. The full test/E2E suites were not run because some write persisted application state. A real phone camera/handwriting run and a fresh PayPal sandbox payout remain separate user-run runtime checks; screenshots of fixtures do not establish those results.

The two downloaded font ZIPs contain ABC Diatype Regular and Bold, not Rounded Semi Mono. On 10 November the user confirmed permission from the font team for hackathon use. The supplied WOFF2 files are included in the CLI deployment and ignored in Git; clean public source builds use the open fallback.

The user explicitly requested deployment after confirming font permission. The Vercel project uses standard Next.js build/install settings; local source inspection found no automatic database/AWS/Terraform write hooks. Preserve the existing PayPal callback origin and deployment environment. The local review build uses placeholder credentials intentionally.
