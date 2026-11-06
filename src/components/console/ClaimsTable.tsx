"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui";
import type { ClaimRow } from "@/app/console/_lib/view";
import { ClaimsGrid } from "./ClaimsGrid";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { StatusTabs, TABS, type Tab } from "./StatusTabs";

const EMPTY_TAB: Record<Exclude<Tab, "all">, { title: string; description: string }> = {
  paid: { title: "No paid claims yet", description: "A claim is paid when every check passes and auto-pay is on, or when a person approves it." },
  held: { title: "Nothing waiting for review", description: "Claims with an unclear answer, or any passing claim while auto-pay is off, wait here for a person." },
  rejected: { title: "No rejected claims", description: "A claim is rejected when the model's answer fails a check, such as a wrong code or label." },
  blocked: { title: "No blocked claims", description: "Blocked claims never reached the model: a reused photo, an expired camera session or a second claim from one account." },
  pending: { title: "Nothing in progress", description: "A claim is in progress from the moment its owner gets a code until the photos are checked." },
};

/** Status tabs over the claims grid, and the evidence drawer for the row that was opened. */
export function ClaimsTable({ rows }: { rows: ClaimRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<Tab, number>;
    c.all = rows.length;
    for (const r of rows) if (r.decision in c) c[r.decision as Tab]++;
    return c;
  }, [rows]);
  const shown = useMemo(() => (tab === "all" ? rows : rows.filter((r) => r.decision === tab)), [rows, tab]);

  return (
    <section aria-label="Claims" className="flex flex-col gap-4">
      <div className="border-b border-line">
        <StatusTabs value={tab} counts={counts} onChange={setTab} controls="claims-panel" />
      </div>
      <div id="claims-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {shown.length ? (
          <ClaimsGrid rows={shown} selected={open} onOpen={setOpen} />
        ) : (
          <EmptyState title={EMPTY_TAB[tab as Exclude<Tab, "all">].title} description={EMPTY_TAB[tab as Exclude<Tab, "all">].description} />
        )}
      </div>
      <EvidenceDrawer claimId={open} onClose={() => setOpen(null)} />
    </section>
  );
}
