import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClaimQr } from "@/components/console/ClaimQr";
import { CopyField } from "@/components/console/CopyField";
import { formatCount } from "@/components/console/format";
import { RecallHeading } from "@/components/console/RecallHeading";
import { RecallSettingsForm } from "@/components/console/RecallSettingsForm";
import type { ReactNode } from "react";
import { Button, CheckIcon } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { claimUrl } from "../../_lib/links";
import { formatMoney, shownSpec } from "../../_lib/view";
import { loadRecallFor } from "../../_lib/workspace";

export async function generateMetadata({ params }: PageProps<"/console/recalls/[id]">): Promise<Metadata> {
  return { title: `Recall ${(await params).id}` };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 className="text-body font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default async function RecallPage({ params, searchParams }: PageProps<"/console/recalls/[id]">) {
  const { id } = await params;
  const session = await requireSession("company", `/console/recalls/${id}`);
  const found = await loadRecallFor(session, id);
  if (!found) notFound();
  const { recall } = found;
  const published = (await searchParams).published === "1";
  const url = claimUrl(recall.slug);
  const spec = shownSpec(recall.spec);

  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {published && (
        <div role="status" className="flex items-start gap-3 rounded-card border border-line bg-pay-soft px-4 py-3 text-ui">
          <CheckIcon className="mt-0.5 shrink-0 text-pay" />
          <p className="text-text">Recall {recall.id} is live. Put the claim link or the QR code on the notice, your site and the receipt emails.</p>
        </div>
      )}
      <RecallHeading
        recall={recall}
        recalls={[recall]}
        basePath="/console"
        actions={
          <Button href={`/console?recall=${recall.id}`} variant="tertiary" size="sm">
            Claims
          </Button>
        }
      />

      {/* Two columns from 1024px: the link owners use on the left, what the recall pays and what a photo must show on the
          right. One column of hairline sections below. */}
      <div className="grid gap-x-16 lg:grid-cols-2">
        <div className="flex flex-col">
          <Section title="Claim link">
            <CopyField value={url} label="Claim link" />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <ClaimQr url={url} name={recall.slug} />
              <Button href={`/r/${recall.slug}`} variant="tertiary" size="sm" target="_blank" className="self-start sm:self-auto">
                Open the claim page
              </Button>
            </div>
          </Section>
        </div>

        <div className="flex flex-col max-lg:border-t max-lg:border-line max-lg:pt-8">
          <Section title="Refund">
            {recall.owner === null ? (
              <p className="text-ui text-text-2">
                <span className="font-mono text-text">{formatMoney(recall.refund)}</span> per unit, auto-pay {recall.autoPay ? "on" : "off"}. Both are fixed for
                this recall.
              </p>
            ) : (
              <RecallSettingsForm recallId={recall.id} refund={recall.refund.value} autoPay={recall.autoPay} />
            )}
          </Section>

          <Section title="Photo checks">
            <dl className="flex flex-col gap-5 text-ui">
              <div>
                <dt className="text-muted">Product</dt>
                <dd className="mt-1 max-w-read">{spec.product}</dd>
              </div>
              <div>
                <dt className="text-muted">The label must show</dt>
                <dd className="mt-1">
                  {spec.label_must_show.length ? (
                    <ul className="flex flex-col gap-1">
                      {spec.label_must_show.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  ) : (
                    "No label: matched on its look"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Proof steps</dt>
                <dd className="mt-1">
                  <ul className="flex flex-col gap-1">
                    {recall.spec.proof_steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="text-muted">From CPSC</dt>
                <dd className="mt-1">
                  {recall.unitsSold ? `About ${formatCount(recall.unitsSold)} units sold.` : "CPSC gives no unit count."}{" "}
                  <a href={recall.url} target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-4 hover:decoration-text">
                    Read the notice
                  </a>
                </dd>
              </div>
            </dl>
          </Section>
        </div>
      </div>
    </main>
  );
}
