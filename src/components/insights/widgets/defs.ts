import type { CSSProperties } from "react";
import type { AgDefaultWidgetDefinition, AgTypeScriptRegistry, AgTypeScriptWidgetDefinition, AgWidgetDataFormat, AgWidgetFieldReference } from "ag-studio";

// The five custom widget types, as Studio's registry sees them.

export interface RecallProgressDef {
  type: "recall-progress";
  // days: the recall's days so far, for the pace beside the share (the homepage's still leaves it out).
  dataMapping: { remedied: AgWidgetFieldReference[]; sold: AgWidgetFieldReference[]; days?: AgWidgetFieldReference[] };
  format?: AgWidgetDataFormat<Record<string, never>>;
}

export interface CheckFunnelDef {
  type: "check-funnel";
  dataMapping: { stage: AgWidgetFieldReference[]; reason: AgWidgetFieldReference[]; decision?: AgWidgetFieldReference[]; count: AgWidgetFieldReference[] };
  format?: AgWidgetDataFormat<Record<string, never>>;
}

export interface RefusalReasonsDef {
  type: "refusal-reasons";
  dataMapping: { reason: AgWidgetFieldReference[]; gate: AgWidgetFieldReference[]; count: AgWidgetFieldReference[] };
  format?: AgWidgetDataFormat<Record<string, never>>;
}

export interface DecisionMixDef {
  type: "decision-mix";
  dataMapping: { decision: AgWidgetFieldReference[]; count: AgWidgetFieldReference[] };
  format?: AgWidgetDataFormat<Record<string, never>>;
}

export interface MedianTimeDef {
  type: "median-time";
  /** per: one row each (claims.id); seconds: that row's time, e.g. max(claims.timeToSendSec). */
  dataMapping: { per: AgWidgetFieldReference[]; seconds: AgWidgetFieldReference[] };
  format?: AgWidgetDataFormat<Record<string, never>>;
}

export interface InsightsRegistry extends AgTypeScriptRegistry {
  widgets: readonly (
    | AgDefaultWidgetDefinition
    | AgTypeScriptWidgetDefinition<"recall-progress", RecallProgressDef>
    | AgTypeScriptWidgetDefinition<"check-funnel", CheckFunnelDef>
    | AgTypeScriptWidgetDefinition<"refusal-reasons", RefusalReasonsDef>
    | AgTypeScriptWidgetDefinition<"decision-mix", DecisionMixDef>
    | AgTypeScriptWidgetDefinition<"median-time", MedianTimeDef>
  )[];
}

/** PIRG, Too Much to Recall (January 2024), in its words: "Only 6 to 10 percent of recalled products are returned or discarded." */
// The "typical over a whole recall" band's hatch, one for Insights and the report, on screen and in print: a 6px tile with
// a 1px diagonal drawn on whole pixels (crispEdges), its ends carried into the next tile, so every stroke is the same
// width at any zoom, where a diagonal gradient's fractional stops shimmer. Its colour is --hatch (else --faint), painted
// through the tile as a mask, so it follows the theme and prints with the element's print-color-adjust.
const HATCH_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6' shape-rendering='crispEdges'><path d='M0 6L6 0M-1 1L1 -1M5 7L7 5' stroke='black'/></svg>",
)}")`;
export const HATCH: CSSProperties = {
  backgroundColor: "var(--hatch, var(--faint))",
  maskImage: HATCH_TILE,
  maskSize: "6px 6px",
  maskRepeat: "repeat",
  WebkitMaskImage: HATCH_TILE,
  WebkitMaskSize: "6px 6px",
  WebkitMaskRepeat: "repeat",
};

export const TYPICAL_RETURN = {
  from: 0.06,
  to: 0.1,
  source: "PIRG, Too Much to Recall, 2024",
  href: "https://publicinterestnetwork.org/wp-content/uploads/2024/01/TOO-MUCH-TO-RECALL-FINAL-1-11-1.pdf",
};
