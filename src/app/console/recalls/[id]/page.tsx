import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClaimQr } from "@/components/console/ClaimQr";
import { CopyField } from "@/components/console/CopyField";
import { formatCount } from "@/components/console/format";
import { RecallHeading } from "@/components/console/RecallHeading";
import { RecallSettingsForm } from "@/components/console/RecallSettingsForm";
import { Button, Card, CardHeader, CheckIcon } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { claimUrl } from "../../_lib/links";
import { loadRecallFor } from "../../_lib/workspace";

export async function generateMetadata({ params }: PageProps<"/console/recalls/[id]">): Promise<Metadata> {
  return { title: `Recall ${(await params).id}` };
}

export default async function RecallPage({ params, searchParams }: PageProps<"/console/recalls/[id]">) {
  const { id } = await params;
  const session = await requireSession("company", `/console/recalls/${id}`);
  const found = await loadRecallFor(session, id);
  if (!found) notFound();
  const { recall } = found;
  const published = (await searchParams).published === "1";
  const url = claimUrl(recall.slug);

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
          <Button href={`/console?recall=${recall.id}`} variant="secondary" size="sm">
            Claims
          </Button>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card as="section" padding="lg" className="flex flex-col gap-6">
          <CardHeader title="Claim link" description="Owners start here. There is no account to create: they log in with PayPal and are paid there." />
          <CopyField value={url} label="Claim link" />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <ClaimQr url={url} name={recall.slug} />
            <Button href={`/r/${recall.slug}`} variant="tertiary" size="sm" target="_blank">
              Open the claim page
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card as="section" padding="lg" className="flex flex-col gap-6">
            <CardHeader title="Settings" description="Changes apply to new claims; decided claims keep their amount." />
            <RecallSettingsForm recallId={recall.id} refund={recall.refund.value} autoPay={recall.autoPay} />
          </Card>

          <Card as="section" padding="lg" className="flex flex-col gap-4">
            <CardHeader title="Photo checks" description="What every claim's photos must show. Set when the recall was published." />
            <dl className="flex flex-col gap-4 text-ui">
              <div>
                <dt className="text-muted">Product</dt>
                <dd className="mt-1">{recall.spec.product}</dd>
              </div>
              <div>
                <dt className="text-muted">The label must show</dt>
                <dd className="mt-1">
                  {recall.spec.label_must_show.length ? (
                    <ul className="flex flex-col gap-1">
                      {recall.spec.label_must_show.map((l) => (
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
                  <ol className="flex flex-col gap-1">
                    {recall.spec.proof_steps.map((s, i) => (
                      <li key={s} className="flex gap-3">
                        <span className="font-mono text-micro leading-5 text-muted">{String(i + 1).padStart(2, "0")}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </dd>
              </div>
              <div className="border-t border-line pt-4">
                <dt className="text-muted">From CPSC</dt>
                <dd className="mt-1">
                  {recall.unitsSold ? `${formatCount(recall.unitsSold)} units sold.` : "CPSC gives no unit count."}{" "}
                  <a href={recall.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-accent-text">
                    Read the notice
                  </a>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </main>
  );
}
