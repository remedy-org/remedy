import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConsoleSkeleton, SkeletonGrid } from "@/components/console/ConsoleSkeleton";
import { CopyField } from "@/components/console/CopyField";
import { DrawerSkeleton } from "@/components/console/EvidenceDrawer";
import { PartialNotice } from "@/components/console/PartialNotice";
import { CheckList } from "@/components/console/CheckList";
import { Button, EmptyState, ErrorState } from "@/components/ui";
import cpsc27071 from "@/lib/__fixtures__/cpsc-27071.json";
import { CpscRecord } from "@/lib/cpsc";
import { DEMO_SPEC } from "@/lib/demo";
import { requireSession } from "@/lib/session";
import { summarizeCpsc } from "../_lib/recalls";
import { shownSpec } from "../_lib/view";
import { PublishPreview } from "./PublishPreview";

export const metadata = { title: "States" };

// Dev only: every console view's empty, loading, error and partial state on one page, for the design gate's
// screenshots. The success states are the real pages. Not routable in production.
export default async function StatesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  await requireSession("company", "/console/states");
  return (
    <main className="page flex flex-col gap-12 py-8">
      <h1 className="text-h2 font-medium">Console states</h1>

      <State name="Claims · empty (a recall with no claims)">
        <EmptyState
          title="No claims yet"
          description="Claims appear here as owners file them. Share the claim link on the recall notice, your site and the receipt emails."
          action={
            <div className="flex w-[min(28rem,80vw)] flex-col gap-3">
              <CopyField value="http://127.0.0.1:3000/r/dreo-tower-fan" label="Claim link" />
            </div>
          }
        />
      </State>

      <State name="Claims · empty tab">
        <EmptyState title="Nothing waiting for review" description="Claims with an unclear answer, or any passing claim while auto-pay is off, wait here for a person." />
      </State>

      <State name="Claims · partial">
        <PartialNotice what="claims" ids={["RM-2210", "RM-0918"]} total={40} />
      </State>

      <State name="Claims · loading">
        <div className="overflow-hidden rounded-card border border-line">
          <ConsoleSkeleton />
        </div>
      </State>

      <State name="Claims · error">
        <ErrorState
          title="Remedy couldn't load this page"
          description="The claim store didn't answer. Nothing was changed and no money moved: claims that arrive meanwhile are held, never lost. Try again in a moment."
          reference="2817305542"
          action={
            <Button variant="secondary" size="sm">
              Try again
            </Button>
          }
        />
      </State>

      <div className="grid gap-12 lg:grid-cols-2">
        <State name="Drawer · loading">
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <DrawerSkeleton />
          </div>
        </State>
        <State name="Drawer · error, and a payout PayPal refused">
          <div className="flex flex-col gap-6">
            <ErrorState title="No claim with that id in this workspace." description="The claim itself is safe: opening it only reads it." />
            <ErrorState variant="inline" title="PayPal didn't take the payout. The claim is still held and nothing was paid; try again." reference="f2b8c1e4a9d07" />
          </div>
        </State>
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        <State name="Import · drafting">
          <CheckList
            label="Import progress"
            steps={[
              { id: "cpsc", label: "Read CPSC's record", state: "pass", detail: "Recall 26-412, about 1,200,000 units" },
              { id: "draft", label: "Draft the photo checks", state: "running", detail: "Drafting the photo checks from the notice, about 15 seconds" },
              { id: "review", label: "You review and publish", state: "waiting", detail: "Nothing goes live until you publish" },
            ]}
          />
        </State>
        <State name="Import · errors">
          <div className="flex flex-col gap-4">
            <ErrorState variant="inline" title="CPSC's recall service didn't answer. Try again in a minute." />
            <p className="text-ui text-text-2">
              <span className="font-mono">27-071</span> is already in your workspace.{" "}
              <Link href="/console/recalls/27-071" className="font-medium text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">
                Open it <span aria-hidden="true">→</span>
              </Link>
            </p>
          </div>
        </State>
      </div>

      <State name="Import · edit the draft (publishing does nothing here)">
        <PublishPreview notice={{ ...summarizeCpsc(CpscRecord.parse(cpsc27071)), slug: "x-vesolje-nursing-pillows" }} spec={shownSpec({ ...DEMO_SPEC, note: DEMO_SPEC.note ?? "" })} />
      </State>

      <State name="Report · loading grid rows">
        <SkeletonGrid rows={3} />
      </State>
    </main>
  );
}

function State({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ui font-medium text-muted">{name}</h2>
      {children}
    </section>
  );
}
