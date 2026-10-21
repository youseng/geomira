/**
 * What every format draws with: the theme (the canvas's: apps/web LIGHT_THEME, checked by
 * a web test), colours resolved as the canvas resolves them (a style colour the export
 * cannot read is drawn in the ink and reported, decision in color.ts), opacities, and the
 * warnings an export reports (characters TeX cannot write, colours it cannot read).
 */
import { hex6, parseCssColor } from './color';

export interface ExportTheme {
  /** Colour of objects without a colour, and of labels (CSS). */
  readonly ink: string;
  /** Background (CSS); also the outline of point dots, as on the canvas. */
  readonly paper: string;
  /** Opacity of polygon fills, relative to the object's opacity. */
  readonly fillAlpha: number;
  /** Label font size, CSS px, and the label font family (SVG). */
  readonly fontPx: number;
  readonly fontFamily: string;
}

/** The canvas's light theme (apps/web LIGHT_THEME). */
export const EXPORT_THEME: ExportTheme = Object.freeze({
  ink: '#1b1f24',
  paper: '#fbfbf8',
  fillAlpha: 0.08,
  fontPx: 15,
  fontFamily:
    '"Geomira Math", "Latin Modern Roman", "CMU Serif", "Liberation Serif", "Times New Roman", serif',
});

/** A text export: the file's contents, its warnings, the ids of the objects drawn (back to front). */
export interface ExportText {
  readonly text: string;
  readonly warnings: readonly ExportWarning[];
  readonly drawn: readonly number[];
}

/** A reason an export differs from what the user might expect, shown in the UI. */
export type ExportWarning =
  | {
      readonly kind: 'character';
      readonly object: string;
      readonly char: string;
      readonly codePoint: number;
    }
  | { readonly kind: 'colour'; readonly object: string; readonly colour: string };

/** The warning as one sentence (the UI and the `% Warning` lines show it). */
export function warningText(w: ExportWarning): string {
  if (w.kind === 'character') {
    const code = `U+${w.codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
    return `the label of ${w.object} has a character TeX cannot write (${JSON.stringify(w.char)}, ${code}): written as ?`;
  }
  return `the colour ${JSON.stringify(w.colour)} of ${w.object} cannot be read: drawn in the default ink`;
}

export interface Paint {
  /** Six upper-case hexadecimal digits. */
  readonly hex: string;
  /** Opacity in [0, 1]: the layer's opacity times the colour's alpha. */
  readonly alpha: number;
}

/**
 * The paint of a colour (null: the ink) at a layer opacity. A colour that cannot be read
 * is the ink, with a warning pushed to `warnings`.
 */
export function paintOf(
  color: string | null,
  opacity: number,
  theme: ExportTheme,
  object: string,
  warnings: ExportWarning[],
): Paint {
  const ink = parseCssColor(theme.ink) ?? { r: 0, g: 0, b: 0, a: 1 };
  let c = ink;
  if (color !== null) {
    const parsed = parseCssColor(color);
    if (parsed === undefined) warnings.push({ kind: 'colour', object, colour: color });
    else c = parsed;
  }
  return { hex: hex6(c), alpha: Math.min(1, Math.max(0, opacity * c.a)) };
}

/** Distinct warnings in first-seen order (one per object and character or colour). */
export function uniqueWarnings(ws: readonly ExportWarning[]): ExportWarning[] {
  const seen = new Set<string>();
  return ws.filter((w) => {
    const k = JSON.stringify(w);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * A number for text formats: rounded to `digits` decimals, without trailing zeros or a
 * negative zero (`1.5`, `-0.25`, `3`).
 */
export function num(x: number, digits: number): string {
  const s = x.toFixed(digits);
  const t = s.includes('.') ? s.replace(/0+$/u, '').replace(/\.$/u, '') : s;
  return t === '-0' ? '0' : t;
}
