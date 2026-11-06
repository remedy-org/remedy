"use client";

import type { CpscSummary } from "@/app/console/_lib/recalls";
import { CpscNotice } from "@/components/console/CpscNotice";
import { PublishForm } from "@/components/console/PublishForm";
import type { CheckSpec } from "@/lib/types";

// The import's edit step with a fixed draft, so the gate can screenshot it without a model call. Publishing is off.
export function PublishPreview({ notice, spec }: { notice: CpscSummary; spec: CheckSpec }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      <div className="order-2 min-w-0 lg:order-1">
        <PublishForm cpscRef={notice.id} notice={notice} initial={spec} drafted onPublished={() => {}} onStartOver={() => {}} />
      </div>
      <aside className="order-1 lg:order-2">
        <CpscNotice notice={notice} />
      </aside>
    </div>
  );
}
