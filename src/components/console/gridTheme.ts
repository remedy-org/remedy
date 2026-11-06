import { themeQuartz } from "ag-grid-community";

// AG Grid's Quartz theme mapped to the Evidence Room tokens (DESIGN.md). Every colour is a CSS variable, so the one
// theme follows the app's dark and light tokens as data-theme flips: no second theme, no flash on toggle.
export const gridTheme = themeQuartz.withParams({
  browserColorScheme: "inherit",
  fontFamily: "var(--font-sans)",
  headerFontFamily: "var(--font-mono)",
  fontSize: 14,
  dataFontSize: 14,
  headerFontSize: 12,
  headerFontWeight: 500,
  headerHeight: 40,
  rowHeight: 44,
  spacing: 4,
  cellHorizontalPadding: 16,
  borderRadius: 6,
  wrapperBorderRadius: 10,

  backgroundColor: "var(--surface)",
  foregroundColor: "var(--text)",
  textColor: "var(--text)",
  subtleTextColor: "var(--muted)",
  cellTextColor: "var(--text)",
  accentColor: "var(--accent)",
  borderColor: "var(--line)",
  chromeBackgroundColor: "var(--surface-2)",
  headerBackgroundColor: "var(--surface-2)",
  headerTextColor: "var(--muted)",
  iconColor: "var(--muted)",

  // Hairline rows, no column rules, no zebra; the selected row is amber at 10%.
  wrapperBorder: true,
  rowBorder: true,
  columnBorder: false,
  headerColumnBorder: false,
  headerRowBorder: true,
  oddRowBackgroundColor: "var(--surface)",
  rowHoverColor: "color-mix(in oklch, var(--text) 4%, transparent)",
  selectedRowBackgroundColor: "var(--accent-soft)",
  focusShadow: { radius: 0, spread: 2, color: "var(--accent)" },
});
