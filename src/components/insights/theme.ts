import type { StudioLib } from "./studio-lib";

// AG Studio themed to the Evidence Room (DESIGN.md). Every colour is one of the app's own tokens, so the report
// matches the console in both themes. The canvas is the page itself: no frame, graphite widgets with a hairline, and
// subtitles set as exhibit labels (mono, faint) like everywhere else in Remedy: amber is only for what's happening now.
//
// Studio computes with its colours (charts draw them on a canvas), so it can't take var() or oklch(): the client
// resolves each token to sRGB first (resolveColor in InsightsStudio) and rebuilds the theme when the theme toggles.

/** A CSS colour expression in terms of the app's tokens -> a colour Studio can use. */
export type Resolve = (css: string) => string;

/** The font stacks next/font set up, resolved too: charts draw text on a canvas, which can't read var(). */
export interface Fonts {
  sans: string;
  mono: string;
}

// A decision has the same colour in every chart, pill and barcode: paid, held, rejected, blocked, in progress, then
// graphite steps for anything else the analyst charts.
const PALETTE = [
  "var(--pay)",
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

export function buildTheme({ studioTheme }: StudioLib, resolve: Resolve, { sans: SANS, mono: MONO }: Fonts, aiPanelWidth = 400) {
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

  // No frame: the canvas is the page's own background, and widget edges sit on the page's 32px gutter.
  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioWrapperBackgroundColor: token("bg"),
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: token("bg"),
  studioCanvasPadding: 20,
  studioCanvasRowHeight: 16,
  studioCanvasFontFamily: SANS,
  studioCanvasGridLineColor: token("line"),

  studioWidgetBackgroundColor: token("surface"),
  studioWidgetBorder: line("line"),
  studioWidgetBorderRadius: 10,
  studioWidgetPadding: 16,
  studioWidgetTitleFontFamily: SANS,
  studioWidgetTitleFontSize: 14,
  studioWidgetTitleFontWeight: 500,
  studioWidgetTitleTextColor: token("text"),
  studioWidgetSubtitleFontFamily: MONO,
  studioWidgetSubtitleFontSize: 12,
  studioWidgetSubtitleFontWeight: 400,
  studioWidgetSubtitleTextColor: token("faint"),
  studioWidgetCaptionFontFamily: SANS,
  studioWidgetCaptionFontSize: 12,
  studioWidgetCaptionTextColor: token("muted"),
  studioWidgetResizeBorderColor: token("accent"),
  studioWidgetToolbarBackgroundColor: token("surface-2"),
  studioWidgetToolbarBorder: line("line"),
  studioWidgetLoadingOverlayBackgroundColor: token("surface"),
  studioWidgetNoDataOverlayBackgroundColor: token("surface"),
  // title-lg's phone floor on the type scale: the KPI row reads as a ledger, not four display numbers.
  studioValueWidgetFontSize: 28,

  studioPanelContainerBackgroundColor: token("surface"),
  studioPanelContainerBorder: line("line"),
  studioPanelContainerBorderRadius: 0,
  studioPanelDividerColor: token("line"),
  studioPanelDividerActiveColor: token("accent"),
  studioPanelSectionBorderColor: token("line"),
  studioPanelHeaderFontFamily: SANS,
  studioPanelHeaderFontWeight: 500,
  studioPanelChevronButtonHoverBackgroundColor: token("surface-2"),
  studioPanelChevronButtonHoverColor: token("text"),
  studioToggleButtonActiveBackgroundColor: token("accent-soft"),
  studioToggleButtonActiveBorderColor: token("accent"),
  studioToggleButtonActiveColor: token("accent-text"),

  // The analyst's rail: wide enough for a quoted check and a drafted note; the whole width on a phone.
  studioAiPanelWidth: aiPanelWidth,
  // Studio holds 600px by default; on a phone the rail is all there is.
  studioMinWidth: aiPanelWidth < 400 ? aiPanelWidth : 600,
  studioAiPanelInputMessageBackgroundColor: token("surface-2"),
  studioAiPanelButtonHoverBackgroundColor: token("surface-2"),
  studioAiPanelRichTextAccentBackgroundColor: token("accent-soft"),

  // Grid widgets: mono uppercase headers in --faint, hairline rows, no zebra (DESIGN.md, AG Grid).
  gridFontFamily: SANS,
  gridFontSize: 14,
  gridCellTextColor: token("text"),
  gridHeaderBackgroundColor: token("surface"),
  gridHeaderTextColor: token("faint"),
  gridHeaderFontFamily: MONO,
  gridHeaderFontSize: 12,
  gridHeaderFontWeight: 400,
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
