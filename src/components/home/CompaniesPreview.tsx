import clsx from "clsx";
import { ClaimsGridPreviewLazy } from "@/components/console/ClaimsGridPreviewLazy";
import { PREVIEW_OPEN_ID, previewProps } from "@/components/console/preview";
import styles from "./home.module.css";
import { ConsoleReplica, PREVIEW_ROWS } from "./ConsoleReplica";
import { Enter } from "./Reveal";

/*
 * The seam for "For companies": everything inside the frame comes from here. The frame is P4's real, read-only
 * ClaimsGridPreview on the seeded sample claims, loaded with next/dynamic one viewport ahead (ClaimsGridPreviewLazy),
 * so the homepage's first load carries no grid JS. Until it loads, and for visitors without JS, the static DOM
 * replica stands in at the same size. The grid area's height (577px) makes the two frames the same height at 1440 (809px).
 */
const GRID_HEIGHT = 577;
const panel = clsx(styles.panel, "h-full");

export function CompaniesPreview({ className }: { className?: string }) {
  return (
    <Enter threshold={0.3} className={className}>
      <ClaimsGridPreviewLazy
        {...previewProps(GRID_HEIGHT)}
        panelClassName={panel}
        fallback={<ConsoleReplica rows={PREVIEW_ROWS} openId={PREVIEW_OPEN_ID} panelWrap={(p) => <div className={panel}>{p}</div>} />}
      />
    </Enter>
  );
}
