import type { AgBaseWidgetDefinition, AgDefaultRegistry, AgFormatShapeParams, AgWidgetData, AgWidgetDataFormat, AgWidgetsConfig, AgWidgetFormParams } from "ag-studio";
import { CheckFunnel } from "./CheckFunnel";
import { DecisionMix } from "./DecisionMix";
import type { CheckFunnelDef, DecisionMixDef, InsightsRegistry, RecallProgressDef, RefusalReasonsDef } from "./defs";
import { RecallProgress } from "./RecallProgress";
import { RefusalReasons } from "./RefusalReasons";
import { reactComp } from "../reactComp";
import type { StudioLib } from "../studio-lib";

// Remedy's custom widgets, registered with Studio alongside its own. Each one reads through widgetApi.getData (so page
// filters and cross-filters apply) and declares a format shape and an AI description, so the analyst's widget agent
// can place and configure them like any built-in widget.

export type { InsightsRegistry } from "./defs";

// The format these widgets keep: a title, an exhibit-label subtitle and a caption. Built with Studio's own shape
// builder (through a command, the public way to get one), so the AI sees a real schema.
const formatShape = ({ api }: AgFormatShapeParams) =>
  api.defineAiCommand((s) => {
    const title = s.object({ enabled: s.boolean().optional(), text: s.string().optional() }).optional();
    return {
      input: s.object({ title, subtitle: title, caption: title }),
      execute: () => ({ success: true as const, value: null }),
    };
  }).shape;

// The report is read, not built: Studio runs in edit mode only because the analyst's rail lives there. So no widget
// keeps Studio's duplicate and delete, which left out of a toolbar are off for the Delete key too; the grid's CSV and a
// chart's image download stay, named for a screen reader (Studio reads a button's label out as-is, not as a locale key).
const ACTIONS: Record<string, string> = { export: "Download CSV", download: "Download image" };
const readOnly = <T extends Pick<AgBaseWidgetDefinition, "toolbar">>(def: T): T => ({
  ...def,
  toolbar: (def.toolbar ?? []).flatMap((item) => (typeof item === "string" ? [] : [{ ...item, label: ACTIONS[item.id] ?? item.label }])),
});

const titles = <T extends AgWidgetData<unknown, AgWidgetDataFormat<unknown>>>(params: AgWidgetFormParams<T>, items: { key: string; label: string }[]) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params.createDefaults({ dataMappingItems: items as any, supportsCrossHighlight: false });

export const insightsWidgets =
  ({ createWidgets }: StudioLib) =>
  (defaults: AgWidgetsConfig<AgDefaultRegistry>): AgWidgetsConfig<InsightsRegistry> => {
  const config = createWidgets<InsightsRegistry>({
    additionalTypes: [
      {
        id: "recall-progress",
        label: "Recall progress",
        dataMapping: {
          remedied: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true, aiDescription: "Units remedied: sum of claims.remedied." },
          sold: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true, aiDescription: "Units sold: max of recall.unitsSold." },
          samples: {
            type: "field",
            supportedRoles: ["numeric"],
            requires: { cardinality: "one" },
            aiDescription: "Units remedied by sample claims, which never paid a real owner: sum of claims.remediedSample.",
          },
        },
        formatShape,
        form: (params: AgWidgetFormParams<RecallProgressDef>) =>
          titles(params, [
            { key: "remedied", label: "Units remedied" },
            { key: "sold", label: "Units sold" },
            { key: "samples", label: "Of which samples" },
          ]),
        comp: reactComp(RecallProgress),
        defaultSize: { width: 640, height: 200 },
        minSize: { width: 360, height: 160 },
        ai: {
          label: "Recall progress",
          description: "A ruler of units remedied against units sold, with the 6-10% share recalls typically reach (PIRG) as an amber band.",
          usage: "Use for how far the recall has got. Not for counts over time.",
          configuration: "Map remedied to sum(claims.remedied), sold to max(recall.unitsSold) and samples to sum(claims.remediedSample).",
        },
      },
      {
        id: "check-funnel",
        label: "Check funnel",
        dataMapping: {
          stage: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "The claim's furthest stage: claims.stage." },
          reason: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "Why it stopped: claims.stopReason." },
          decision: {
            type: "field",
            supportedRoles: ["category"],
            requires: { cardinality: "many" },
            aiDescription: "The rule's decision, claims.decision: splits each drop into refused (Rejected, Blocked), held for a person, and in progress.",
          },
          count: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true, aiDescription: "Claims: countd(claims.id)." },
        },
        formatShape,
        form: (params: AgWidgetFormParams<CheckFunnelDef>) =>
          titles(params, [
            { key: "stage", label: "Stage" },
            { key: "reason", label: "Stop reason" },
            { key: "decision", label: "Decision" },
            { key: "count", label: "Claims" },
          ]),
        comp: reactComp(CheckFunnel),
        defaultSize: { width: 560, height: 300 },
        minSize: { width: 420, height: 240 },
        featureConfig: { crossFilter: { supportsHighlight: true } },
        ai: {
          label: "Check funnel",
          description:
            "Claims at each stage from filed to paid. Each drop is split into claims refused there and claims held for a person (waiting, not refused), with their reasons and counts. Clicking a drop filters the page to those claims.",
          usage: "Use to show where claims fall out of the process.",
          configuration: "Map stage to claims.stage, reason to claims.stopReason, decision to claims.decision, count to countd(claims.id).",
        },
      },
      {
        id: "refusal-reasons",
        label: "Refusal reasons",
        dataMapping: {
          reason: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "claims.refusalReason." },
          gate: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "claims.refusalGate: No AI, Model reads or Person." },
          count: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true, aiDescription: "Claims: countd(claims.id)." },
        },
        formatShape,
        form: (params: AgWidgetFormParams<RefusalReasonsDef>) =>
          titles(params, [
            { key: "reason", label: "Reason" },
            { key: "gate", label: "Check kind" },
            { key: "count", label: "Claims" },
          ]),
        comp: reactComp(RefusalReasons),
        defaultSize: { width: 420, height: 300 },
        minSize: { width: 320, height: 200 },
        featureConfig: { crossFilter: { supportsHighlight: true } },
        ai: {
          label: "Refusal reasons",
          description: "Refused claims by reason, each tagged with the kind of check that caught it (NO AI, MODEL READS, PERSON), in red bars.",
          usage: "Use for why claims were refused.",
          configuration: "Map reason to claims.refusalReason, gate to claims.refusalGate, count to countd(claims.id).",
        },
      },
      {
        id: "decision-mix",
        label: "Decisions",
        dataMapping: {
          decision: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "claims.decision." },
          count: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true, aiDescription: "Claims: countd(claims.id)." },
        },
        formatShape,
        form: (params: AgWidgetFormParams<DecisionMixDef>) =>
          titles(params, [
            { key: "decision", label: "Decision" },
            { key: "count", label: "Claims" },
          ]),
        comp: reactComp(DecisionMix),
        defaultSize: { width: 360, height: 220 },
        minSize: { width: 260, height: 180 },
        featureConfig: { crossFilter: { supportsHighlight: true } },
        ai: {
          label: "Decisions",
          description: "One 100% bar of claims by the rule's decision (Paid, Held, Rejected, Blocked, In progress) in Remedy's fixed state colours, with counts and shares. Clicking a decision filters the page.",
          usage: "Use for the split of decisions. Prefer it to a pie or donut: its colours always match the decision.",
          configuration: "Map decision to claims.decision and count to countd(claims.id).",
        },
      },
    ],
    menu: [{ label: "Remedy", widgetIds: ["recall-progress", "decision-mix", "check-funnel", "refusal-reasons"] }, ...defaults.menu],
  });
  return { ...config, widgets: config.widgets.map((w) => (w.id === "grid" ? claimLinks(readOnly(w)) : readOnly(w))) };
};

// The grid's claim ids (sources.ts gives that field a claimOf context: the recall) are mono links to the claim in the
// queue, as every claim id in the console is.
const claimLinks = <T extends AgBaseWidgetDefinition>(def: T): T => ({
  ...def,
  options: {
    ...(def.options as object | undefined),
    createCellRenderer: (field: { context?: { claimOf?: string } }) => {
      const recall = field.context?.claimOf;
      if (!recall) return undefined;
      return ({ value }: { value: unknown }) => {
        if (typeof value !== "string" || !value) return "";
        const a = document.createElement("a");
        a.href = `/console?recall=${encodeURIComponent(recall)}&claim=${encodeURIComponent(value)}`;
        a.textContent = value;
        a.className = "font-mono font-medium whitespace-nowrap text-text underline decoration-line-strong underline-offset-2 hover:decoration-text";
        return a;
      };
    },
  },
});
