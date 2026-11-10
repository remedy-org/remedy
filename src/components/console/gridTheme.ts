import { themeQuartz } from "ag-grid-community";

// One token-driven theme for the live queue and its product previews. Preserve row geometry so keyboard navigation,
// skeletons and the narrow card layout keep the same footprint when the theme changes.
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
  borderRadius: 8,
  wrapperBorderRadius: 16,

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
  rowHoverColor: "var(--surface-2)",
  selectedRowBackgroundColor: "color-mix(in srgb, var(--accent) 9%, var(--surface))",
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
  inputBackgroundColor: "var(--surface-2)",
  inputBorder: { color: "var(--line-strong)" },
  inputFocusBorder: { color: "var(--focus)" },
  inputFocusShadow: "none",
  inputPlaceholderTextColor: "var(--faint)",
  inputHeight: 32,
  checkboxCheckedBackgroundColor: "var(--accent)",
  checkboxCheckedBorderColor: "var(--accent)",
  checkboxCheckedShapeColor: "var(--accent-ink)",
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
