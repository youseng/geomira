/**
 * What the TeX formats (TikZ, Asymptote) share: world coordinates of the display list's
 * screen points (the canvas's own paths, clipped as the canvas clips them), the size of a
 * CSS pixel (0.75 bp: 1 px = 1/96 in, 1 bp = 1/72 in), the TeX of each label, the anchor
 * a label is placed by, and the `Warning` comment lines.
 */
import type { PlacedLabel } from '@geomira/scene/labels';
import type { DisplayItem, Path } from '@geomira/scene/types';
import { toWorld, type Vec2 } from '@geomira/scene/viewport';
import type { ExportFrame } from './frame';
import { texLabel, texProse } from './tex-label';
import { num, warningText, type ExportWarning } from './paint';

/** One CSS pixel in PostScript points (bp). */
export const BP_PER_PX = 0.75;

/**
 * A positive measure (a unit, a zoom) as text: six decimals from 0.001 on (as before), else
 * seven significant digits in exponent form, which TeX comments and Asymptote's reals read
 * (Run 10 audit: a figure 10^9 wide had `unitsize(0)`).
 */
export function measureText(x: number): string {
  return Math.abs(x) >= 0.001 ? num(x, 6) : x.toExponential(6);
}

/** The world point of a screen point of the frame's view. */
export function world(f: ExportFrame, s: Vec2): Vec2 {
  return toWorld(f.view, s);
}

/** World units per CSS pixel, and one world unit in bp. */
export function unitBp(f: ExportFrame): number {
  return f.view.viewport.zoom * BP_PER_PX;
}

/**
 * Decimals of world coordinates such that the last digit is at most 0.01 bp on paper
 * (between 0 and 12).
 */
export function worldDigits(f: ExportFrame): number {
  const d = Math.ceil(Math.log10(unitBp(f) * 100));
  return Math.min(12, Math.max(0, Number.isFinite(d) ? d : 0));
}

export interface TexLabelOut {
  readonly tex: string;
  readonly name: string;
}

/**
 * The TeX of a placed label: a text object's string is prose, any other label is a name
 * (math) when it reads as one (tex-label.ts). Characters TeX cannot write become warnings.
 */
export function labelTex(f: ExportFrame, l: PlacedLabel, warnings: ExportWarning[]): TexLabelOut {
  const p = f.scene.primitives.find((q) => q.id === l.id);
  const name = p?.name ?? '';
  const r = p?.shape.kind === 'text' ? texProse(l.runs) : texLabel(l.runs, { star: f.star });
  for (const w of r.warnings)
    warnings.push({ kind: 'character', object: name, char: w.char, codePoint: w.codePoint });
  return { tex: r.tex, name };
}

/**
 * Where the label's box sits relative to its reference point, as a direction: x = +1 when
 * the text starts there (align left), −1 when it ends there, 0 centred; y = +1 when the
 * text stands on it (baseline bottom), −1 when it hangs from it, 0 centred.
 */
export function labelSide(l: PlacedLabel): { readonly x: -1 | 0 | 1; readonly y: -1 | 0 | 1 } {
  return {
    x: l.align === 'left' ? 1 : l.align === 'right' ? -1 : 0,
    y: l.baseline === 'bottom' ? 1 : l.baseline === 'top' ? -1 : 0,
  };
}

/**
 * The paths of an item TikZ and Asymptote draw: all of them, except a text's handle (a
 * radius-0 dot at its anchor that the canvas never paints; the text is its label, ADR-0028).
 */
export function inkPaths(item: DisplayItem): readonly Path[] {
  return item.kind === 'text' ? [] : item.paths;
}

/** The `Warning` comment lines of an export (`%` for TikZ, `//` for Asymptote). */
export function warningLines(ws: readonly ExportWarning[], comment: string): string[] {
  return ws.map((w) => `${comment} Warning: ${warningText(w)}`);
}
