import clsx from "clsx";
import styles from "./home.module.css";
import { ConsoleReplica, PREVIEW_ROWS } from "./ConsoleReplica";
import { Enter } from "./Reveal";

/*
 * The seam for "For companies": everything inside the frame comes from here. Today it is the static DOM replica.
 * When P4's ClaimsGridPreview lands (src/components/console/ClaimsGridPreview.tsx, props { rows, openId, height }),
 * replace the body of CompaniesPreview with a client wrapper that starts
 *   dynamic(() => import("@/components/console/ClaimsGridPreview").then((m) => m.ClaimsGridPreview), { ssr: false })
 * one viewport ahead (IntersectionObserver, rootMargin "100% 0px"), with a same-size skeleton until it loads, so the
 * homepage's initial JS doesn't change. PREVIEW_ROWS and OPEN_ID already match its props.
 */
export const OPEN_ID = "RM-9629";

export function CompaniesPreview({ className }: { className?: string }) {
  return (
    <Enter threshold={0.3} className={className}>
      <ConsoleReplica rows={PREVIEW_ROWS} openId={OPEN_ID} panelWrap={(panel) => <div className={clsx(styles.panel, "h-full")}>{panel}</div>} />
    </Enter>
  );
}
