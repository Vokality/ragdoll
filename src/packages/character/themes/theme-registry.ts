import type { RagdollTheme } from './types';
import { defaultTheme, robotTheme, alienTheme, monochromeTheme } from './default-themes';

/**
 * Registry of all available themes
 */
const themes = new Map<string, RagdollTheme>([
  [defaultTheme.id, defaultTheme],
  [robotTheme.id, robotTheme],
  [alienTheme.id, alienTheme],
  [monochromeTheme.id, monochromeTheme],
]);

/**
 * Get a theme by ID
 */
export function getTheme(themeId: string): RagdollTheme {
  const theme = themes.get(themeId);
  if (!theme) {
    console.warn(`Theme "${themeId}" not found, using default`);
    return defaultTheme;
  }
  return theme;
}

/**
 * Get all available themes
 */
export function getAllThemes(): RagdollTheme[] {
  return Array.from(themes.values());
}

/**
 * Get the default theme
 */
export function getDefaultTheme(): RagdollTheme {
  return defaultTheme;
}

/**
 * Check if a theme exists
 */
export function hasTheme(themeId: string): boolean {
  return themes.has(themeId);
}

/**
 * Register a custom theme (for future extensibility)
 */
export function registerTheme(theme: RagdollTheme): void {
  themes.set(theme.id, theme);
}

