/**
 * The values the style card shows and the controls' draft operations (ADR-0029): sliders
 * show the effective value (the inherited style with the draft on top), the scene's default
 * when nothing sets it; the label's "show" and the "shown" checkbox. Pure and DOM-free.
 *
 * The label uses the language's existing form: `label=""` hides a label (Geomdraw's
 * `@nolabel`), an absent label is the default (points show their name, other kinds none), any
 * other text is shown instead of the name.
 */
import type { Style } from '@geomira/kernel/document';
import { MAX_WIDTH, POINT_RADIUS, STROKE_WIDTH } from '@geomira/scene/style';
import { patchStyle, setField, type CardKind } from './style-draft';

/** A slider's range. */
export interface Range {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** Geomdraw's slider ranges: a point's radius, a curve's width (CSS px), an opacity. */
export const POINT_SIZE: Range = { min: 1, max: 7, step: 0.1 };
export const LINE_WIDTH: Range = { min: 0.4, max: 5, step: 0.1 };
export const OPACITY: Range = { min: 0, max: 1, step: 0.05 };

/** The range, widened to hold `value` (a width set in the text may lie outside it). */
export function rangeFor(r: Range, value: number): Range {
  return { ...r, min: Math.min(r.min, value), max: Math.max(r.max, value) };
}

/** The scene's default width of a kind: a point's radius, else a stroke width. */
export function defaultWidth(kind: CardKind): number {
  return kind === 'point' ? POINT_RADIUS : STROKE_WIDTH;
}

/** The width drawn (scene/style.ts drawStyle): the style's when finite and ≥ 0, capped. */
export function widthShown(s: Style, kind: CardKind): number {
  const w = s.width;
  return w !== undefined && Number.isFinite(w) && w >= 0
    ? Math.min(MAX_WIDTH, w)
    : defaultWidth(kind);
}

/** The style's own opacity as drawn: 1 when absent or not finite, else clamped to [0, 1]. */
export function opacityShown(s: Style): number {
  const a = s.opacity;
  return a !== undefined && Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1;
}

/** A slider's value as the card prints it next to the slider (at most two decimals). */
export function sliderText(x: number): string {
  return String(Math.round(x * 100) / 100);
}

/** Whether a style shows its label: `label=""` hides it; absent shows a point's name only. */
export function labelShown(s: Style, kind: CardKind): boolean {
  if (s.label === '') return false;
  return s.label !== undefined || kind === 'point';
}

/** The text a label shows when the style gives none of its own (the field's placeholder). */
export function defaultLabel(inherited: Style, name: string): string {
  return inherited.label === undefined || inherited.label === '' ? name : inherited.label;
}

/** The label text the field starts with: the draft's own text, if any. */
export function ownLabel(draft: Style): string {
  return draft.label ?? '';
}

/**
 * The draft with its label shown or not: shown with `text` when it is not empty, else with
 * the default (a point's name, or an image's inherited label; the name is written for a kind
 * that shows none by default); hidden as `label=""`. A label the object shows (or hides)
 * anyway is removed instead of written.
 */
export function withLabel(
  draft: Style,
  inherited: Style,
  kind: CardKind,
  name: string,
  show: { readonly on: boolean; readonly text: string },
): Style {
  const without = patchStyle(draft, { label: undefined });
  const byDefault = labelShown({ ...inherited, ...without }, kind);
  if (!show.on) return byDefault ? patchStyle(draft, { label: '' }) : without;
  if (show.text !== '') return patchStyle(draft, { label: show.text });
  return byDefault ? without : patchStyle(draft, { label: defaultLabel(inherited, name) });
}

/** The draft shown or hidden (`hidden`); an image follows its source unless it differs. */
export function withVisible(draft: Style, inherited: Style, shown: boolean): Style {
  return setField(draft, 'hidden', !shown, inherited.hidden === true);
}

/** A typed number: empty removes the field (undefined); anything but a number ≥ min is null. */
export function typedNumber(text: string, min: number): number | undefined | null {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n >= min ? n : null;
}
