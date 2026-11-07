import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { EASE, Money, Paper, Stamp, ThemeToggle, Wordmark } from "@/components/ui";
import { StampReplay } from "./StampReplay";

// /dev/ui: the foundation pieces from DESIGN.md (Money, Paper, Stamp, the type scale, the mark), for screenshots and
// review. Dev only: a 404 in production. Copy and figures come from the product: the Kikea X-VESOLJE recall (CPSC
// 27-071, $29.99 refund, 19,596 units), claim RM-0442 (demo, 7 Nov: 15 s from photos to payout) and the console's
// sample data (26 paid claims, 26 x $29.99 = $779.74).

export const metadata = { title: "UI foundation", robots: { index: false } };

function Block({ n, title, note, children }: { n: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-6 pb-16 sm:pb-24">
      <header className="mb-10 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h2 className="micro text-accent-text">
          {n} · {title}
        </h2>
        {note && <p className="max-w-[60ch] text-ui text-faint">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function Spec({ name, detail, wide, children }: { name: string; detail: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`grid gap-x-12 gap-y-6 border-b border-line py-8 first:pt-0 last:border-b-0 ${wide ? "" : "md:grid-cols-[12rem_minmax(0,1fr)]"}`}>
      <div className="flex flex-col gap-1">
        <code className="font-mono text-ui text-text">{name}</code>
        <span className="text-ui text-faint">{detail}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// The easing curve drawn from its cubic-bezier points, on a 0..1 square (y up). ease-back overshoots the top edge.
function Curve({ points }: { points: readonly [number, number, number, number] }) {
  const [x1, y1, x2, y2] = points;
  const s = 56;
  const p = (x: number, y: number) => `${(x * s).toFixed(1)} ${((1 - y) * s).toFixed(1)}`;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="overflow-visible" aria-hidden="true">
      <rect width={s} height={s} fill="none" stroke="var(--line)" />
      <path d={`M${p(0, 0)} C${p(x1, y1)} ${p(x2, y2)} ${p(1, 1)}`} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

const CSS_EASE: Record<keyof typeof EASE, { token: string; use: string }> = {
  snap: { token: "--ease-snap", use: "UI state changes, 160ms" },
  outExpo: { token: "--ease-out-expo", use: "Reveals 700–1000ms, panels 160ms" },
  outQuart: { token: "--ease-out-quart", use: "Objects moving, lines drawing" },
  inOutQuart: { token: "--ease-in-out-quart", use: "Threshold flips, the mark's string" },
  back: { token: "--ease-back", use: "Stamps landing, 200ms" },
};

const SWATCHES = [
  { token: "--paper", use: "Tags, sheets, receipts", className: "bg-paper" },
  { token: "--paper-2", use: "Chips and rows on paper, notices", className: "bg-paper-2" },
  { token: "--ink", use: "Text on paper", className: "bg-ink" },
  { token: "--ink-muted", use: "Secondary text on paper", className: "bg-ink-muted" },
  { token: "--pay-ink", use: "Paid, on paper", className: "bg-pay-ink" },
  { token: "--hold-ink", use: "Held, on paper", className: "bg-hold-ink" },
  { token: "--stop-ink", use: "Refused, on paper", className: "bg-stop-ink" },
  { token: "--paper-line", use: "Hairlines and dashed rows on paper", className: "bg-paper [background-image:linear-gradient(var(--paper-line),var(--paper-line))]" },
];

export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="grain min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex items-center gap-4">
            <Wordmark size="md" href="/" />
            <span className="micro hidden text-faint sm:inline">UI foundation · dev only</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-content px-4 pt-12 sm:px-8 sm:pt-16">
        <h1 className="sr-only">UI foundation</h1>
        <p className="mb-12 max-w-[60ch] text-lead text-muted sm:mb-16">
          The pieces every surface shares: money, paper, stamps and type. Paper keeps its colour in both themes, like the
          real thing; switch the theme to check.
        </p>

        <Block n="01" title="Money" note="Cents de-emphasised; tabular figures only in the mono grid size. Screen readers and copy-paste get the plain amount.">
          <Spec name='size="numeral"' detail="Schibsted Grotesk 500 at the display size, 36–56px. One per screen, where the number is the point.">
            <Money value={29.99} size="numeral" />
          </Spec>
          <Spec name='size="amount"' detail="Schibsted Grotesk 500, 56px; 40px on phones. The claim flow's refund.">
            <Money value={29.99} size="amount" />
          </Spec>
          <Spec name='size="inline"' detail="The surrounding text's font and size; cents at 73%.">
            <p className="max-w-[60ch] text-lead text-text">
              Refunded <Money value={29.99} /> to your PayPal account through Remedy for Kikea Store.
            </p>
          </Spec>
          <Spec name='size="grid"' detail="14px JetBrains Mono, tabular, right-aligned in tables.">
            <table className="w-full max-w-md text-ui">
              <caption className="sr-only">Sample payouts</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="micro py-2 font-normal text-faint">Claim</th>
                  <th scope="col" className="micro py-2 text-right font-normal text-faint">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-3 font-mono text-text">RM-0442</td>
                  <td className="py-3 text-right">
                    <Money value={29.99} size="grid" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 text-muted">26 paid sample claims</td>
                  <td className="py-3 text-right">
                    <Money value={779.74} size="grid" />
                  </td>
                </tr>
              </tbody>
            </table>
          </Spec>
        </Block>

        <Block n="02" title="Type" note="Six sizes everywhere: 56 / 40 / 22 / 17 / 14 / 12.">
          <Spec name="text-display" detail="Sans 500, 36–56px, -0.03em, two-tone. Hero h1 only." wide>
            <p className="text-display font-medium">
              Proof it&rsquo;s destroyed.
              <br />
              <span className="text-muted">Paid in a minute.</span>
            </p>
          </Spec>
          <Spec name="text-title-lg" detail="Sans 500, 28–40px, two-tone. Section headings.">
            <p className="text-title-lg font-medium">
              Recall refunds run on an inbox. <span className="text-muted">AI broke the inbox.</span>
            </p>
          </Spec>
          <Spec name="text-head-sm" detail="Sans 500, 20px, two-tone. Small section heads.">
            <p className="text-head-sm font-medium">
              Five checks, in order. <span className="text-muted">The first three need no AI.</span>
            </p>
          </Spec>
          <Spec name="text-title" detail="Sans 600, 32px; 26px on phones. Claim-flow screen titles.">
            <p className="text-title font-medium">Checking your photo</p>
          </Spec>
          <Spec name="text-body · ui · micro" detail="16 / 14 / 12, the running text.">
            <div className="flex max-w-[60ch] flex-col gap-3">
              <p className="text-body text-text">Usually 15 to 40 seconds. Your claim is saved, so you can close this page.</p>
              <p className="text-ui text-muted">Photos are seen only by Remedy and the company running the recall.</p>
              <p className="micro text-faint">Photo 1 · Code M4T</p>
            </div>
          </Spec>
        </Block>

        <Block n="03" title="Paper" note="Tag, receipt, sheet and notice. The hole and the perforation are real cut-outs: the table shows through.">
          <div className="relative -mx-4 overflow-hidden border-y border-line bg-surface px-4 py-12 sm:mx-0 sm:rounded-frame sm:border sm:px-12 sm:py-16">
            {/* The lit table is a dark-surface effect (the homepage is dark only), so the light theme leaves it off. */}
            <div className="pointer-events-none absolute inset-0 in-data-[theme=light]:hidden" style={{ background: "var(--table-glow)" }} aria-hidden="true" />
            <div className="relative grid items-start gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,30rem)] lg:justify-between">
              <div className="flex flex-col gap-12">
                <figure className="m-0 flex flex-col items-start gap-3">
                  <Paper variant="tag" hole tilt={-2} className="w-60">
                    <p className="micro text-ink-muted">CPSC 27-071 · X-VESOLJE</p>
                    <p className="mt-3 font-mono text-[2.5rem] leading-none font-medium tracking-[0.12em]">M4T</p>
                    <p className="mt-3 text-ui text-ink-muted">Write it big, in marker.</p>
                  </Paper>
                  <figcaption className="font-mono text-micro text-faint">variant=&quot;tag&quot; hole tilt=-2</figcaption>
                </figure>
                <figure className="m-0 flex flex-col items-start gap-3">
                  <Paper variant="sheet" padding="lg" className="w-full">
                    <div className="flex items-start justify-between gap-4">
                      <p className="micro text-ink-muted">Verdict sheet</p>
                      <Stamp tone="hold">Held for review</Stamp>
                    </div>
                    <p className="mt-6 text-body font-medium">A person at Kikea Store will look at this.</p>
                    <p className="mt-2 text-ui text-ink-muted">It&rsquo;s saved and nothing is lost. Kikea Store&rsquo;s recall team reviews held claims within 2 business days.</p>
                  </Paper>
                  <figcaption className="font-mono text-micro text-faint">variant=&quot;sheet&quot;</figcaption>
                </figure>
              </div>

              <figure className="m-0 flex flex-col items-start gap-3">
                <Paper variant="receipt" perforated padding="lg" tilt={1} className="w-full">
                  <div className="flex justify-between gap-4">
                    <p className="micro text-ink-muted">Refund receipt</p>
                    <p className="font-mono text-micro text-ink-muted">Claim RM-0442</p>
                  </div>
                  <div className="mt-8 flex items-end justify-between gap-4">
                    <Money value={29.99} size="amount" />
                    <Stamp tone="pay" className="mb-2">
                      Paid · sandbox
                    </Stamp>
                  </div>
                  <p className="mt-3 text-body text-ink-muted">Refunded to your PayPal account through Remedy for Kikea Store, in PayPal sandbox money.</p>
                  <p className="mt-6 inline-flex h-7 items-center rounded-control bg-paper-2 px-2.5 font-mono text-micro">Paid 15 s after your photo</p>
                  <dl className="mt-8 text-ui">
                    {[
                      ["Recall", "CPSC 27-071 · X-VESOLJE"],
                      ["Sent", "7 Nov 2026"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 border-t border-dashed border-paper-line py-3">
                        <dt className="text-ink-muted">{k}</dt>
                        <dd className="text-right font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Paper>
                <figcaption className="font-mono text-micro text-faint">variant=&quot;receipt&quot; perforated tilt=1</figcaption>
              </figure>
            </div>
          </div>

          <div className="mt-12 -mx-4 bg-paper px-4 py-12 text-ink sm:mx-0 sm:rounded-frame sm:px-12 sm:py-16">
            <div className="grid gap-8 lg:grid-cols-2">
              <Paper variant="notice" padding="lg" as="figure" className="m-0">
                <p className="micro text-ink-muted">CPSC 27-071 · Kikea Store · 19,596 units</p>
                <blockquote className="mt-4 text-lead">
                  &ldquo;&hellip;send a photo of the destroyed pillow to <span className="font-mono text-body">z&bull;&bull;&bull;&bull;&bull;929@gmail.com</span>.&rdquo;
                </blockquote>
              </Paper>
              <Paper variant="notice" padding="lg" as="figure" className="m-0">
                <div className="flex items-start justify-between gap-4">
                  <p className="micro text-ink-muted">CPSC-2026-0067 · 15 Apr 2026</p>
                  <Stamp tone="stop" rotate={-6}>
                    Received
                  </Stamp>
                </div>
                <blockquote className="mt-4 text-lead">
                  &ldquo;&hellip;altered, fabricated, or artificially generated images&hellip; purporting to demonstrate product destruction.&rdquo;
                </blockquote>
              </Paper>
            </div>
            <p className="mt-6 font-mono text-micro text-ink-muted">variant=&quot;notice&quot;, on the --paper band</p>
          </div>
        </Block>

        <Block n="04" title="Stamps" note="One ink at 85%, 14px mono, -8°. Always decorative: the status is written out in text too.">
          <StampReplay>
            <div className="flex w-full flex-wrap items-center gap-x-10 gap-y-8 rounded-frame bg-paper px-8 py-10">
              <Stamp tone="pay" land>
                Paid
              </Stamp>
              <Stamp tone="pay" land={80}>
                Paid · sandbox
              </Stamp>
              <Stamp tone="hold" land={160}>
                Held for review
              </Stamp>
              <Stamp tone="stop" land={240}>
                Rejected
              </Stamp>
              <Stamp tone="stop" land={320}>
                Blocked
              </Stamp>
              <Stamp tone="stop" rotate={-6} land={400}>
                Received
              </Stamp>
              <Stamp tone="neutral">Expired</Stamp>
            </div>
          </StampReplay>
        </Block>

        <Block n="05" title="Paper and ink" note="Fixed in both themes. Every ink clears 4.5:1 on paper and paper-2: npx tsx scripts/contrast.ts.">
          <ul className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {SWATCHES.map((s) => (
              <li key={s.token} className="flex items-center gap-4 bg-surface p-4">
                <span className={`size-10 shrink-0 rounded-control shadow-[0_0_0_1px_var(--line)] ${s.className}`} aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <code className="font-mono text-ui text-text">{s.token}</code>
                  <span className="text-ui text-faint">{s.use}</span>
                </span>
              </li>
            ))}
          </ul>
        </Block>

        <Block n="06" title="Motion" note="CSS tokens in globals.css, mirrored as EASE in ui/motion.ts. Springs (SPRING.drop) are Motion only.">
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
            {(Object.keys(EASE) as (keyof typeof EASE)[]).map((k) => (
              <li key={k} className="flex flex-col gap-4">
                <Curve points={EASE[k]} />
                <span className="flex flex-col gap-1">
                  <code className="font-mono text-ui text-text">{CSS_EASE[k].token}</code>
                  <span className="text-ui text-faint">{CSS_EASE[k].use}</span>
                </span>
              </li>
            ))}
          </ul>
        </Block>
      </main>
    </div>
  );
}
