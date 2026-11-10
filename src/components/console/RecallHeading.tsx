import type { ReactNode } from "react";
import type { Recall } from "@/lib/types";
import { formatMoney } from "@/app/console/_lib/view";
import { formatDate, keepHyphens } from "./format";
import { RecallPicker } from "./RecallPicker";

export interface RecallHeadingProps {
  recall: Recall;
  recalls: Recall[];
  basePath: string;
  actions?: ReactNode;
  /** The page shows times: say their zone once, here, rather than in a column's head. */
  times?: boolean;
}

/** The recall a console page is about: CPSC number, product, refund and auto-pay, with a switcher when there are several. */
export function RecallHeading({ recall, recalls, basePath, actions, times }: RecallHeadingProps) {
  // The title and its actions share one row, so the claims start as high on the screen as they can.
  // On a laptop the actions sit at the title row's right; on a phone the title, then what it is, then the actions.
  return (
    <div className="grid grid-cols-1 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-8">
      <h1 className="min-w-0 font-display text-h2 font-semibold text-balance">{keepHyphens(recall.product)}</h1>
      <div className="order-3 mt-2 flex flex-wrap items-center gap-3 sm:order-none sm:col-start-2 sm:row-start-1 sm:mt-0 sm:self-center">
        {recalls.length > 1 && <RecallPicker recalls={recalls.map((r) => ({ id: r.id, product: r.product }))} current={recall.id} basePath={basePath} />}
        {actions}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui text-muted sm:col-span-2">
        <span>
          CPSC <span className="font-mono text-text-2">{recall.id}</span>
        </span>
        <span aria-hidden="true" className="text-faint">·</span>
        <span>Recalled {formatDate(recall.recallDate)}</span>
        <span aria-hidden="true" className="text-faint">·</span>
        <span>
          <span className="font-mono text-text">{formatMoney(recall.refund)}</span> refund
        </span>
        <span aria-hidden="true" className="text-faint">·</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`size-1.5 rounded-full ${recall.autoPay ? "bg-pay" : "bg-faint"}`} />Auto-pay {recall.autoPay ? "on" : "off"}</span>
        {times && (
          <>
            <span aria-hidden="true" className="text-faint">·</span>
            {/* The console's one zone, the report's and the CSV's too. */}
            <span>Times in UTC</span>
          </>
        )}
      </p>
    </div>
  );
}
