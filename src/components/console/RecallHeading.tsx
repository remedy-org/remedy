import type { ReactNode } from "react";
import { ExhibitLabel, NoBreakHyphens } from "@/components/ui";
import type { Recall } from "@/lib/types";
import { formatMoney } from "@/app/console/_lib/view";
import { formatDate } from "./format";
import { RecallPicker } from "./RecallPicker";

export interface RecallHeadingProps {
  recall: Recall;
  recalls: Recall[];
  basePath: string;
  actions?: ReactNode;
}

/** The recall a console page is about: CPSC number, product, refund and auto-pay, with a switcher when there are several. */
export function RecallHeading({ recall, recalls, basePath, actions }: RecallHeadingProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        <ExhibitLabel leader="none">
          CPSC {recall.id} · Recalled {formatDate(recall.recallDate)}
        </ExhibitLabel>
        <h1 className="mt-3 text-h2 font-semibold text-balance">
          <NoBreakHyphens>{recall.product}</NoBreakHyphens>
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui text-muted">
          <span>
            <span className="font-mono text-text">{formatMoney(recall.refund)}</span> refund
          </span>
          <span aria-hidden="true" className="text-faint">·</span>
          <span>Auto-pay {recall.autoPay ? "on" : "off"}</span>
          <span aria-hidden="true" className="text-faint">·</span>
          <span className="font-mono">/r/{recall.slug}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {recalls.length > 1 && <RecallPicker recalls={recalls.map((r) => ({ id: r.id, product: r.product }))} current={recall.id} basePath={basePath} />}
        {actions}
      </div>
    </div>
  );
}
