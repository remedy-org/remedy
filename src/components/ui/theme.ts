// Shared by the root layout's pre-paint script and ThemeToggle. Dark is the default. A visitor's choice is stored
// ("dark" or "light"); with nothing stored, prefers-color-scheme decides.
export const THEME_STORAGE_KEY = "remedy-theme";
export type Theme = "dark" | "light";
