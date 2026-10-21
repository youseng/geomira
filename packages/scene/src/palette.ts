/**
 * The named colours of styles (ADR-0016 decision 20): `color=red` is drawn in Geomdraw's red,
 * not the CSS keyword's #FF0000. The layout resolves a style's colour through this palette,
 * so the canvas and every export (SVG, PNG, TikZ, Asymptote) read the same hex value from the
 * display list. The document keeps the name as written.
 *
 * Names are matched ignoring case and surrounding spaces. Anything else (a hex colour, an
 * rgb() value, a CSS name not listed here, an unreadable string) is returned exactly as
 * written; the renderer and the exports resolve or reject it as before.
 */

/** Name → hex, from Geomdraw's palette (blue is its highlight blue). */
export const NAMED_COLOURS: Readonly<Record<string, string>> = Object.freeze({
  black: '#111111',
  red: '#b3261e',
  blue: '#1f6fd1',
  green: '#2e7d32',
  orange: '#d9730d',
  purple: '#7b3fa0',
  brown: '#8d5a3b',
  teal: '#00897b',
  gray: '#777777',
  grey: '#777777',
});

/** The colour a style colour is drawn in (see the module comment); null stays null. */
export function paletteColour(color: string | null): string | null {
  if (color === null) return null;
  const key = color.trim().toLowerCase();
  return Object.hasOwn(NAMED_COLOURS, key) ? (NAMED_COLOURS[key] ?? color) : color;
}
