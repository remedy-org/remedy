import type { AgDefaultWidgetDefinition, AgTypeScriptRegistry, AgTypeScriptWidgetDefinition, AgWidgetDataFormat, AgWidgetFieldReference } from "ag-studio";

// The five custom widget types, as Studio's registry sees them.

export interface RecallProgressDef {
  type: "recall-progress";
  dataMapping: { remedied: AgWidgetFieldReference[]; sold: AgWidgetFieldReference[] };
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

/** PIRG, Too Much to Recall (January 2024): 6-10% of recalled products are ever returned or destroyed. */
export const TYPICAL_RETURN = {
  from: 0.06,
  to: 0.1,
  source: "PIRG, Too Much to Recall, 2024",
  href: "https://publicinterestnetwork.org/wp-content/uploads/2024/01/TOO-MUCH-TO-RECALL-FINAL-1-11-1.pdf",
};
