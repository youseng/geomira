/**
 * Styles as drawn (SPEC §13, ADR-0010). A managed image is styled like its source unless
 * its own style overrides a field: its effective style is the source's effective style
 * (recursively, for images of images) with the image's own fields on top. The label is the
 * one field that is derived rather than copied: a source label text L gives the image the
 * label L + suffix (the rule's stars), so A and A* never carry the same label; an empty
 * source label (no label) stays empty.
 *
 * Drawing values are sanitised: a width that is missing, not finite or negative takes the
 * kind's default, and widths are capped at MAX_WIDTH; a z that is not finite counts as 0;
 * a label distance that is not finite or negative takes the default. A Style is user data
 * (any document may hold any number), so nothing here assumes the language's checks.
 */
import type { DocObject, Style } from '@geomira/kernel/document';
import type { DocIndex } from './doc-index';
import { parseLabel } from './label-text';
import type { DrawStyle, Label, ShapeKind } from './types';

/** Widths above this many CSS px are drawn at this width. */
export const MAX_WIDTH = 64;

/** Default dot radius of points and stroke width of curves, CSS px. */
export const POINT_RADIUS = 3.5;
export const STROKE_WIDTH = 1.5;

/** Default label distance from its anchor, CSS px (points, other kinds). */
export const POINT_LABEL_DIST = 9;
export const CURVE_LABEL_DIST = 6;

/** Label distances beyond this many CSS px are drawn at this distance. */
export const MAX_LABEL_DIST = 1000;

/** The effective style of an object (images inherit from their sources, see above). */
export function effectiveStyle(index: DocIndex, o: DocObject): Style {
  const chain: DocObject[] = [o];
  const seen = new Set([o.id]);
  for (let s = index.source(o); s !== undefined && !seen.has(s.id); s = index.source(s)) {
    chain.push(s);
    seen.add(s.id);
  }
  let style: Style = {};
  for (const x of chain.reverse()) {
    const suffix = x.managedBy === undefined ? '' : suffixOf(index, x);
    const inherited =
      style.label === undefined || style.label === ''
        ? style
        : { ...style, label: style.label + suffix };
    style = { ...inherited, ...x.style };
  }
  return style;
}

function suffixOf(index: DocIndex, o: DocObject): string {
  return index.layer.get(o.managedBy ?? '')?.rule?.suffix ?? '';
}

function finiteAtLeast0(x: number | undefined): number | undefined {
  return x !== undefined && Number.isFinite(x) && x >= 0 ? x : undefined;
}

/** The style a shape of `kind` is drawn with, in a layer of the given opacity. */
export function drawStyle(style: Style, kind: ShapeKind, opacity: number): DrawStyle {
  const fallback = kind === 'point' ? POINT_RADIUS : STROKE_WIDTH;
  const width = Math.min(MAX_WIDTH, finiteAtLeast0(style.width) ?? fallback);
  const a = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1;
  return {
    color: style.color === undefined || style.color === '' ? null : style.color,
    width,
    dash: style.dash ?? 'solid',
    opacity: a,
  };
}

/** The z of a style (0 when absent or not finite). */
export function zOf(style: Style): number {
  return style.z !== undefined && Number.isFinite(style.z) ? style.z : 0;
}

/**
 * The label of an object: the style's label text, else the name for points; none for other
 * kinds without a label text, and none for an empty text. The angle is in degrees (null =
 * automatic placement), normalised to [0, 360).
 */
export function labelOf(name: string, style: Style, kind: ShapeKind): Label | null {
  const text = style.label ?? (kind === 'point' ? name : '');
  if (text === '') return null;
  const angle =
    style.labelAngle !== undefined && Number.isFinite(style.labelAngle)
      ? ((style.labelAngle % 360) + 360) % 360
      : null;
  const fallback = kind === 'point' ? POINT_LABEL_DIST : CURVE_LABEL_DIST;
  return {
    text,
    runs: parseLabel(text),
    angle,
    dist: Math.min(MAX_LABEL_DIST, finiteAtLeast0(style.labelDist) ?? fallback),
  };
}
