import { themeQuartz } from "ag-grid-community";

// AG Grid's Quartz theme mapped to the Evidence Room tokens (DESIGN.md). Every colour is a CSS variable, so the one
// theme follows the app's dark and light tokens as data-theme flips: no second theme, no flash on toggle.
// The header is a quiet mono label row on the grid's own surface (AG Grid's HR demo: no grey header slab); rows are
// 52px for two-line cells with thumbnails (Mercury 51, HR 65). claims-grid.css adds the uppercase tracking and the
// open row's amber edge.
export const gridTheme = themeQuartz.withParams({
  browserColorScheme: "inherit",
  fontFamily: "var(--font-sans)",
  headerFontFamily: "var(--font-mono)",
  fontSize: 14,
  dataFontSize: 14,
  headerFontSize: 11,
  headerFontWeight: 500,
  headerHeight: 36,
  rowHeight: 52,
  spacing: 4,
  cellHorizontalPadding: 12,
  borderRadius: 6,
  wrapperBorderRadius: 10,

  backgroundColor: "var(--surface)",
  foregroundColor: "var(--text)",
  textColor: "var(--text)",
  subtleTextColor: "var(--muted)",
  cellTextColor: "var(--text)",
  accentColor: "var(--accent)",
  borderColor: "var(--line)",
  chromeBackgroundColor: "var(--surface)",
  headerBackgroundColor: "var(--surface)",
  headerTextColor: "var(--faint)",
  headerCellHoverBackgroundColor: "color-mix(in oklch, var(--text) 3%, transparent)",
  iconColor: "var(--faint)",

  // Hairline rows, no column rules, no zebra. The open claim is amber at 8%, with a 2px amber edge (claims-grid.css).
  wrapperBorder: true,
  rowBorder: true,
  columnBorder: false,
  headerColumnBorder: false,
  headerRowBorder: true,
  pinnedColumnBorder: false,
  oddRowBackgroundColor: "var(--surface)",
  rowHoverColor: "color-mix(in oklch, var(--text) 3%, transparent)",
  selectedRowBackgroundColor: "color-mix(in oklch, var(--accent) 8%, transparent)",
  // A payout settling at PayPal that lands flashes its cell in the paid colour.
  valueChangeValueHighlightBackgroundColor: "var(--pay-soft)",
  focusShadow: { radius: 0, spread: 2, color: "var(--accent)" },
});
