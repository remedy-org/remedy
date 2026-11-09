import type { StudioLib } from "./studio-lib";

// AG Studio themed to the Evidence Room (DESIGN.md). Every colour is one of the app's own tokens, so the report
// matches the console in both themes. The canvas is the page itself: no frame, graphite widgets with a hairline, a
// title and no subtitle. Amber is kept for the one action on a page, so nothing in the report uses it.
//
// Studio computes with its colours (charts draw them on a canvas), so it can't take var() or oklch(): the client
// resolves each token to sRGB first (resolveColor in InsightsStudio) and rebuilds the theme when the theme toggles.

/** A CSS colour expression in terms of the app's tokens -> a colour Studio can use. */
export type Resolve = (css: string) => string;

/** The font stacks next/font set up, resolved too: charts draw text on a canvas, which can't read var(). */
export interface Fonts {
  sans: string;
}

// A decision has the same colour in every chart, pill and barcode: paid, held, rejected, blocked, in progress, then
// graphite steps for anything else the analyst charts. Paid as an area is the calmer --pay-fill (in dark a forest green,
// where the glyph's mint was the loudest thing on the page).
const PALETTE = [
  "var(--pay-fill)",
  "var(--hold)",
  "var(--stop)",
  "color-mix(in oklch, var(--stop) 55%, var(--surface))",
  "var(--faint)",
  "color-mix(in oklch, var(--text) 70%, var(--surface))",
  "color-mix(in oklch, var(--text) 55%, var(--surface))",
  "color-mix(in oklch, var(--text) 42%, var(--surface))",
  "color-mix(in oklch, var(--text) 30%, var(--surface))",
  "color-mix(in oklch, var(--text) 20%, var(--surface))",
];

export function buildTheme({ studioTheme }: StudioLib, resolve: Resolve, { sans: SANS }: Fonts) {
  const token = (name: string) => resolve(`var(--${name})`);
  const line = (name: string) => ({ width: 1, color: token(name) });
  const palette = Object.fromEntries(
    PALETTE.flatMap((css, i) => {
      const color = resolve(css);
      return [
        [`chartPaletteFills${i + 1}Color`, color],
        [`chartPaletteStrokes${i + 1}Color`, color],
      ];
    }),
  );
  return studioTheme.withParams({
  fontFamily: SANS,
  fontSize: 14,
  textColor: token("text"),
  foregroundColor: token("text"),
  subtleTextColor: token("muted"),
  backgroundColor: token("surface"),
  borderColor: token("line"),
  // Neutral: links and Send stay in the text colour; amber is kept for the few active states below.
  accentColor: token("text"),
  iconColor: token("muted"),
  rowHoverColor: token("surface-2"),
  invalidColor: token("stop"),
  // The app's focus ring (DESIGN.md: 2px, amber in dark, ink in light, where amber is 2:1 on a card) on everything
  // Studio focuses: grid cells, toolbar buttons, the analyst's rail, inputs.
  focusShadow: `0 0 0 2px ${token("focus")}`,
  borderRadius: 6,
  tooltipBackgroundColor: token("surface-2"),
  tooltipTextColor: token("text"),
  tooltipBorder: line("line"),
  menuBackgroundColor: token("surface-2"),
  menuTextColor: token("text"),
  menuBorder: line("line"),

  // No frame: the canvas is the page's own background, and its 32px padding puts every section's edge on the page's
  // gutter.
  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioWrapperBackgroundColor: token("bg"),
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: token("bg"),
  studioCanvasPadding: 32,
  studioCanvasRowHeight: 16,
  studioCanvasFontFamily: SANS,
  studioCanvasGridLineColor: token("line"),

  // No cards: each panel is a hairline-topped section on the page itself, as the Claims queue and the report are
  // (insights.css draws the rule and the space under it).
  studioWidgetBackgroundColor: token("bg"),
  studioWidgetBorder: false,
  studioWidgetBorderRadius: 0,
  studioWidgetPadding: 0,
  studioWidgetTitleFontFamily: SANS,
  studioWidgetTitleFontSize: 14,
  studioWidgetTitleFontWeight: 500,
  studioWidgetTitleTextColor: token("text"),
  studioWidgetSubtitleFontFamily: SANS,
  studioWidgetSubtitleFontSize: 12,
  studioWidgetSubtitleFontWeight: 400,
  studioWidgetSubtitleTextColor: token("muted"),
  studioWidgetCaptionFontFamily: SANS,
  studioWidgetCaptionFontSize: 12,
  studioWidgetCaptionTextColor: token("muted"),
  studioWidgetResizeBorderColor: token("line-2"),
  studioWidgetToolbarBackgroundColor: token("surface-2"),
  studioWidgetToolbarBorder: line("line"),
  studioWidgetLoadingOverlayBackgroundColor: token("bg"),
  studioWidgetNoDataOverlayBackgroundColor: token("bg"),
  // An analyst's value tile: the ledger's 22, not a display number.
  studioValueWidgetFontSize: 22,

  studioPanelContainerBackgroundColor: token("bg"),
  studioPanelContainerBorder: line("line"),
  studioPanelContainerBorderRadius: 0,
  studioPanelDividerColor: token("line"),
  studioPanelDividerActiveColor: token("text-2"),
  studioPanelSectionBorderColor: token("line"),
  studioPanelHeaderFontFamily: SANS,
  studioPanelHeaderFontWeight: 500,
  studioPanelChevronButtonHoverBackgroundColor: token("surface-2"),
  studioPanelChevronButtonHoverColor: token("text"),
  studioToggleButtonActiveBackgroundColor: token("surface-2"),
  studioToggleButtonActiveBorderColor: token("text-2"),
  studioToggleButtonActiveColor: token("text"),

  // The analyst's rail: wide enough for a quoted check and a drafted note.
  studioAiPanelWidth: 400,
  studioAiPanelInputMessageBackgroundColor: token("surface-2"),
  studioAiPanelButtonHoverBackgroundColor: token("surface-2"),
  studioAiPanelRichTextAccentBackgroundColor: token("surface-2"),

  // Grid widgets: the Claims grid's header row (sentence-case sans labels in --muted on --surface-2), hairline rows,
  // no zebra.
  gridFontFamily: SANS,
  gridFontSize: 14,
  gridCellTextColor: token("text"),
  gridHeaderBackgroundColor: token("surface-2"),
  gridHeaderTextColor: token("muted"),
  gridHeaderFontFamily: SANS,
  gridHeaderFontSize: 12,
  gridHeaderFontWeight: 500,
  gridRowHeight: 44,
  gridRowBorder: line("line"),
  gridHeaderRowBorder: line("line"),
  gridRowHoverColor: token("surface-2"),
  gridWrapperBorder: false,

  chartFontFamily: SANS,
  chartTextColor: token("text"),
  chartSubtleTextColor: token("muted"),
  chartAxisLineColor: token("line"),
  chartGridLineColor: token("line"),
  ...palette,
  });
}
