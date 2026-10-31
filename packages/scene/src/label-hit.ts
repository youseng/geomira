/**
 * Label hit-testing (ADR-0049, amending ADR-0010 decision 13 "labels are not hit-tested"):
 * one geometry for drawing and picking. `labelGlyphs` places a label's runs from their
 * MEASURED advance widths, exactly as the canvas renderer draws them (it calls this function:
 * apps/web render.ts), and gives the box the drawn text occupies; `hitLabel` tests that same
 * box. So what is drawn is what is hit (law L8's structure for labels), with the widths the
 * renderer measures: the host passes its measurement (`RunWidth`, the canvas's measureText at
 * the label font); without one, the scene's estimate (label-box.ts: 0.62 em per character),
 * which is what Node tests and exports have.
 *
 * Vertical metrics are the renderer's: a run's em box spans ASCENT_EM above its baseline and
 * DESCENT_EM below; the baseline sits ASCENT_EM below a `top` reference point, DESCENT_EM above
 * a `bottom` one, and MIDDLE_EM below a `middle` one; subscripts are lowered SUB_EM and
 * superscripts raised SUP_EM (of the base size), at SMALL_SCALE of the size rounded to whole px.
 *
 * Which labels are picked: every placed label with text, except a text object's (its string is
 * the object itself, dragged by its handle, ADR-0028). Overlapping labels: the one drawn last
 * (on top) is hit. A press is on a label when it is inside the box grown by LABEL_PICK_PX.
 */
import type { DisplayList } from './display';
import { labelBox, LABEL_FONT_PX, type BoxedLabel } from './label-box';
import type { LabelRun } from './label-text';
import type { PlacedLabel } from './labels';
import type { Rect, Vec2 } from './viewport';

/** The advance width (CSS px) of one run of a label, as the renderer measures it. */
export type RunWidth = (run: LabelRun) => number;

/** A press this close (px) outside a label's drawn box is still on the label. */
export const LABEL_PICK_PX = 2;

/** The renderer's vertical metrics, in em of the base size (see the module comment). */
const ASCENT_EM = 0.8;
const DESCENT_EM = 0.2;
const MIDDLE_EM = 0.3;
const SUB_EM = 0.25;
const SUP_EM = 0.4;
const SMALL_SCALE = 0.7;

/** One run of a label as drawn: its text at (x, y) (baseline, left end), font size px. */
export interface Glyph {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly px: number;
}

export interface LabelGlyphs {
  readonly glyphs: readonly Glyph[];
  /** The box the drawn runs occupy (their advance widths and em boxes), screen px. */
  readonly box: Rect;
}

/** The font size of a run: the base size, or the small size of sub- and superscripts. */
export function runPx(pos: LabelRun['pos'], px: number): number {
  return pos === 'base' ? px : Math.round(px * SMALL_SCALE);
}

/** The scene's estimate of a run's width at LABEL_FONT_PX (label-box.ts's measure). */
export const estimatedWidth: RunWidth = (run) => {
  const b = labelBox({ runs: [run], at: { x: 0, y: 0 }, align: 'left', baseline: 'top' });
  return b.maxX - b.minX;
};

/**
 * The runs of a label placed from their widths (`widths[i]` is run i's advance; a missing or
 * non-finite width counts as 0) at base font size `px`, and their box. Degenerate: no runs →
 * no glyphs and an empty box at the reference point.
 */
export function labelGlyphs(l: BoxedLabel, widths: readonly number[], px: number): LabelGlyphs {
  const w = l.runs.map((_, i) => {
    const x = widths[i] ?? 0;
    return Number.isFinite(x) && x > 0 ? x : 0;
  });
  const total = w.reduce((a, x) => a + x, 0);
  let x = l.at.x - (l.align === 'left' ? 0 : l.align === 'right' ? total : total / 2);
  const y =
    l.baseline === 'top'
      ? l.at.y + px * ASCENT_EM
      : l.baseline === 'bottom'
        ? l.at.y - px * DESCENT_EM
        : l.at.y + px * MIDDLE_EM;
  const minX = x;
  let [minY, maxY] = [l.at.y, l.at.y];
  const glyphs: Glyph[] = [];
  for (const [i, r] of l.runs.entries()) {
    const dy = r.pos === 'sub' ? px * SUB_EM : r.pos === 'sup' ? -px * SUP_EM : 0;
    const size = runPx(r.pos, px);
    glyphs.push({ text: r.text, x, y: y + dy, px: size });
    minY = Math.min(minY, y + dy - size * ASCENT_EM);
    maxY = Math.max(maxY, y + dy + size * DESCENT_EM);
    x += w[i] ?? 0;
  }
  if (glyphs.length === 0) return { glyphs, box: { minX, minY, maxX: minX, maxY: minY } };
  return { glyphs, box: { minX, minY, maxX: x, maxY } };
}

/** A label under the cursor: its object, the placed label and its drawn box. */
export interface LabelHit {
  readonly id: number;
  readonly label: PlacedLabel;
  readonly box: Rect;
}

function within(b: Rect, q: Vec2, pad: number): boolean {
  return q.x >= b.minX - pad && q.x <= b.maxX + pad && q.y >= b.minY - pad && q.y <= b.maxY + pad;
}

/**
 * The topmost label whose drawn box (grown by LABEL_PICK_PX) contains `q`, or undefined
 * (see the module comment). `width` measures runs as the renderer does; `px` is the
 * renderer's base label size. Degenerate: a refused view or a non-finite cursor → undefined.
 */
export function hitLabel(
  display: DisplayList,
  q: Vec2,
  width: RunWidth = estimatedWidth,
  px: number = LABEL_FONT_PX,
): LabelHit | undefined {
  if (display.problem !== null || !Number.isFinite(q.x) || !Number.isFinite(q.y)) return undefined;
  const texts = new Set(display.items.filter((i) => i.kind === 'text').map((i) => i.id));
  for (let i = display.labels.length - 1; i >= 0; i--) {
    const l = display.labels[i];
    if (l === undefined || texts.has(l.id) || l.runs.length === 0) continue;
    const { box } = labelGlyphs(l, l.runs.map(width), px);
    if (within(box, q, LABEL_PICK_PX)) return { id: l.id, label: l, box };
  }
  return undefined;
}

/**
 * The offset (angle in degrees counter-clockwise as seen, in [0, 360); distance in px) that
 * puts the label's reference point at `at`: the inverse of the placement (labels.ts places it
 * `dist` px from the anchor in direction `angle`). Degenerate: `at` on the anchor (or not
 * finite) → distance 0 and the label's current angle.
 */
export function labelOffset(label: PlacedLabel, at: Vec2): { angle: number; dist: number } {
  const dx = at.x - label.anchor.x;
  const dy = label.anchor.y - at.y;
  const dist = Math.hypot(dx, dy);
  if (!(dist > 0) || !Number.isFinite(dist)) return { angle: label.angle, dist: 0 };
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { angle: ((deg % 360) + 360) % 360, dist };
}
