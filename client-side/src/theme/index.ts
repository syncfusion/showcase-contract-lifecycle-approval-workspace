/**
 * Theme configuration for Syncfusion components.
 *
 * CSS is loaded from the tailwind3 family in styles/syncfusion-theme.css.
 * Dark mode is applied via `e-dark-mode` plus design tokens in global.css.
 *
 * @module theme
 */

export const SYNC_THEME_LIGHT = "tailwind3";
export const SYNC_THEME_DARK = "tailwind3-dark";

/** Returns the Syncfusion theme name matching the current app theme. */
export function syncThemeFor(mode: "light" | "dark"): string {
  return mode === "dark" ? SYNC_THEME_DARK : SYNC_THEME_LIGHT;
}

