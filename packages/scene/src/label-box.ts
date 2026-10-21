/**
 * The box a placed label occupies on the screen (CSS px), ESTIMATED from its text: the scene
 * does not know the renderer's font metrics (ADR-0010 decision 13), so the box is computed
 * from the character counts of the label's runs at the renderer's default size
 * (LABEL_FONT_PX, sub- and superscripts at SMALL_SCALE of it) with an average advance of
 * CHAR_EM em per character. The estimate is used for one decision only: whether two labels
 * would overlap (labels.ts tries other directions when they do, note C of Run 8b). It is a
 * pure function of the placed label, so placement stays deterministic.
 *
 * The box follows the label's alignment: `left` starts at the reference point, `right` ends
 * there, `center` is centred on it; `bottom` sits on it, `top` hangs from it, `middle` is
 * centred on it vertically.
 */
import type { LabelRun } from './label-text';
import type { Rect, Vec2 } from './viewport';

/** The renderer's default label font size (apps/web LIGHT_THEME.fontSize), CSS px. */
export const LABEL_FONT_PX = 15;

/** Size of sub- and superscript runs relative to the base font (as the renderer draws them). */
const SMALL_SCALE = 0.7;

/** Average advance of one character, in em (a serif font's lowercase and capitals). */
const CHAR_EM = 0.62;

/** Extra height for a run raised or lowered off the baseline, in em. */
const SHIFT_EM = 0.3;

/**
 * A direction tried instead of the best one, to avoid another label, keeps at least this
 * angle (degrees) from the curves through the point (labels.ts).
 */
export const MIN_CLEAR_DEG = 20;

/** Two boxes closer than this (px) count as overlapping. */
export const LABEL_GAP_PX = 1;

export interface BoxedLabel {
  readonly runs: readonly LabelRun[];
  readonly at: Vec2;
  readonly align: 'left' | 'center' | 'right';
  readonly baseline: 'top' | 'middle' | 'bottom';
}

/** The number of code points of a string (a Greek letter or a prime counts once). */
function codePoints(s: string): number {
  let n = 0;
  for (const c of s) if (c !== '') n++;
  return n;
}

/** The estimated width and height of a label's text, px. */
function extent(runs: readonly LabelRun[]): { w: number; h: number } {
  let w = 0;
  let shifted = false;
  for (const r of runs) {
    const scale = r.pos === 'base' ? 1 : SMALL_SCALE;
    w += codePoints(r.text) * CHAR_EM * LABEL_FONT_PX * scale;
    if (r.pos !== 'base') shifted = true;
  }
  return { w, h: LABEL_FONT_PX * (1 + (shifted ? SHIFT_EM : 0)) };
}

/** The estimated screen box of a placed label. */
export function labelBox(l: BoxedLabel): Rect {
  const { w, h } = extent(l.runs);
  const minX = l.align === 'left' ? l.at.x : l.align === 'right' ? l.at.x - w : l.at.x - w / 2;
  const minY =
    l.baseline === 'bottom' ? l.at.y - h : l.baseline === 'top' ? l.at.y : l.at.y - h / 2;
  return { minX, minY, maxX: minX + w, maxY: minY + h };
}

/** Whether two boxes overlap (closer than LABEL_GAP_PX). */
export function boxesOverlap(a: Rect, b: Rect): boolean {
  return (
    a.minX < b.maxX + LABEL_GAP_PX &&
    b.minX < a.maxX + LABEL_GAP_PX &&
    a.minY < b.maxY + LABEL_GAP_PX &&
    b.minY < a.maxY + LABEL_GAP_PX
  );
}
