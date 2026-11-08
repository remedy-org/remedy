import { themeQuartz } from "ag-grid-community";

// AG Grid's Quartz theme mapped to the Evidence Room tokens (DESIGN.md). Every colour is a CSS variable, so the one
// theme follows the app's dark and light tokens as data-theme flips: no second theme, no flash on toggle.
// The header is a quiet sentence-case label row in the sans face, one surface step up (--surface-2, DESIGN.md's console
// layers): mono is for data. Rows are 52px for two-line cells with thumbnails (Mercury 51, HR 65). claims-grid.css adds
// the open row's ink edge and the filter icons that show on hover. The filter popups, inputs and checkboxes use the same tokens:
// ink, not amber, since amber is the one action's.
export const gridTheme = themeQuartz.withParams({
  browserColorScheme: "inherit",
  fontFamily: "var(--font-sans)",
  headerFontFamily: "var(--font-sans)",
  fontSize: 14,
  dataFontSize: 14,
  headerFontSize: 12,
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
  headerBackgroundColor: "var(--surface-2)",
  headerTextColor: "var(--muted)",
  headerCellHoverBackgroundColor: "color-mix(in oklch, var(--text) 3%, transparent)",
  iconColor: "var(--faint)",

  // Hairline rows, no column rules, no zebra. The open claim is one surface step up (--surface-2), with a 2px ink edge
  // (claims-grid.css).
  wrapperBorder: true,
  rowBorder: true,
  columnBorder: false,
  headerColumnBorder: false,
  headerRowBorder: true,
  pinnedColumnBorder: false,
  oddRowBackgroundColor: "var(--surface)",
  rowHoverColor: "color-mix(in oklch, var(--text) 3%, transparent)",
  selectedRowBackgroundColor: "var(--surface-2)",
  pinnedRowBackgroundColor: "var(--surface-2)",
  pinnedRowBorder: { color: "var(--line)" },
  headerColumnResizeHandleColor: "var(--line-2)",
  iconButtonHoverBackgroundColor: "color-mix(in oklch, var(--text) 6%, transparent)",
  iconButtonHoverColor: "var(--text)",
  iconButtonActiveColor: "var(--text)",
  iconButtonActiveBackgroundColor: "color-mix(in oklch, var(--text) 8%, transparent)",
  iconButtonActiveIndicatorColor: "var(--text)",
  menuBackgroundColor: "var(--surface)",
  menuTextColor: "var(--text-2)",
  menuBorder: { color: "var(--line)" },
  popupShadow: "var(--float-shadow)",
  inputBackgroundColor: "var(--bg)",
  inputBorder: { color: "var(--line-2)" },
  inputFocusBorder: { color: "var(--text-2)" },
  inputFocusShadow: "none",
  inputPlaceholderTextColor: "var(--faint)",
  inputHeight: 32,
  checkboxCheckedBackgroundColor: "var(--text)",
  checkboxCheckedBorderColor: "var(--text)",
  checkboxCheckedShapeColor: "var(--bg)",
  checkboxUncheckedBorderColor: "var(--line-strong)",
  checkboxUncheckedBackgroundColor: "transparent",
  pickerListBackgroundColor: "var(--surface)",

  // A payout settling at PayPal that lands flashes its cell in the paid colour.
  valueChangeValueHighlightBackgroundColor: "var(--pay-soft)",
  focusShadow: { radius: 0, spread: 2, color: "var(--focus)" },
});

// The homepage's still: the same grid, its header labels in the UI's sans face, sentence case, muted (claims-grid.css
// drops the uppercase for it), so mono is left to the ids, codes, times and money in the cells.
export const stillTheme = gridTheme.withParams({
  headerFontFamily: "var(--font-sans)",
  headerFontSize: 13,
  headerTextColor: "var(--muted)",
});
