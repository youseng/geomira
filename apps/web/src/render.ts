/**
 * The canvas renderer (SPEC §13, ADR-0010 decision 14): a pure function of the display list
 * (itself a function of the scene and the view) and of the UI state (hover, selection). It
 * draws exactly the display list's paths, the same paths hit-testing uses (law L8), and
 * writes only to the 2D context it is given. HiDPI: the canvas has css size × dpr device
 * pixels and every frame starts with setTransform(dpr, …), so all drawing is in CSS px.
 */
import { assertNever } from '@geomira/num/assert';
import type { DisplayList } from '@geomira/scene/display';
import type { PlacedLabel } from '@geomira/scene/labels';
import { dashPattern } from '@geomira/scene/style';
import type { DisplayItem, Path } from '@geomira/scene/types';

/** The subset of CanvasRenderingContext2D the renderer uses (tests record it). */
export type Canvas2D = Pick<
  CanvasRenderingContext2D,
  | 'setTransform'
  | 'fillRect'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'arc'
  | 'closePath'
  | 'stroke'
  | 'fill'
  | 'fillText'
  | 'measureText'
  | 'setLineDash'
  | 'globalAlpha'
  | 'lineWidth'
  | 'strokeStyle'
  | 'fillStyle'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'lineCap'
  | 'lineJoin'
>;

export interface Theme {
  readonly background: string;
  /** The colour of objects without a colour, and of labels. */
  readonly foreground: string;
  readonly hover: string;
  readonly selection: string;
  /** Opacity of polygon fills, relative to the item's opacity. */
  readonly fillAlpha: number;
  readonly fontFamily: string;
  /** Label font size, CSS px. */
  readonly fontSize: number;
}

/**
 * The canvas (Run 9b, Geomdraw's look): near-white paper and near-black ink (the values the
 * exports pin), Geomdraw's highlight blue for hover and its selection blue (a light ring at
 * the halo's opacity), italic serif labels.
 * "Geomira Math" is the italic face of the first serif the platform has (styles.css,
 * @font-face with local() sources); the families after it are the upright fallbacks.
 * packages/export draws with the same values (EXPORT_THEME, checked by a test).
 */
export const LIGHT_THEME: Theme = {
  background: '#fbfbf8',
  foreground: '#1b1f24',
  hover: '#1f6fd1',
  selection: '#2f5fb3',
  fillAlpha: 0.08,
  fontFamily:
    '"Geomira Math", "Latin Modern Roman", "CMU Serif", "Liberation Serif", "Times New Roman", serif',
  fontSize: 15,
};

export interface UiState {
  readonly hover: number | null;
  readonly selection: ReadonlySet<number>;
}

export const NO_UI: UiState = { hover: null, selection: new Set() };

/** Halo widths around hovered and selected items, CSS px on each side. */
const HALO = 4;

/** Traces one stroked path (dots are drawn by drawDot). */
export function tracePath(ctx: Canvas2D, p: Path): void {
  switch (p.kind) {
    case 'dot':
      ctx.moveTo(p.c.x + p.r, p.c.y);
      ctx.arc(p.c.x, p.c.y, p.r, 0, 2 * Math.PI);
      return;
    case 'arc':
      // Spans are counter-clockwise as seen; the canvas's angles run clockwise (y down).
      ctx.moveTo(p.c.x + p.r * Math.cos(p.from), p.c.y - p.r * Math.sin(p.from));
      ctx.arc(p.c.x, p.c.y, p.r, -p.from, -p.to, true);
      return;
    case 'poly': {
      const [first, ...rest] = p.pts;
      if (first === undefined) return;
      ctx.moveTo(first.x, first.y);
      for (const q of rest) ctx.lineTo(q.x, q.y);
      if (p.closed) ctx.closePath();
      return;
    }
    default:
      assertNever(p, 'path');
  }
}

/** Sets a colour: the default first, since the canvas ignores an invalid CSS colour. */
function colour(ctx: Canvas2D, key: 'strokeStyle' | 'fillStyle', c: string | null, theme: Theme) {
  ctx[key] = theme.foreground;
  if (c !== null) ctx[key] = c;
}

function halo(ctx: Canvas2D, item: DisplayItem, ui: UiState, theme: Theme): void {
  const selected = ui.selection.has(item.id);
  if (!selected && ui.hover !== item.id) return;
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = selected ? theme.selection : theme.hover;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.setLineDash([]);
  for (const p of item.paths) {
    ctx.beginPath();
    if (p.kind === 'dot') {
      ctx.arc(p.c.x, p.c.y, p.r + HALO, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.lineWidth = item.style.width + 2 * HALO;
      tracePath(ctx, p);
      ctx.stroke();
    }
  }
}

function drawItem(ctx: Canvas2D, item: DisplayItem, theme: Theme): void {
  const { style } = item;
  if (item.fill !== null) {
    ctx.globalAlpha = style.opacity * theme.fillAlpha;
    colour(ctx, 'fillStyle', style.color, theme);
    ctx.beginPath();
    tracePath(ctx, { kind: 'poly', pts: item.fill, closed: true });
    ctx.fill();
  }
  ctx.globalAlpha = style.opacity;
  colour(ctx, 'strokeStyle', style.color, theme);
  colour(ctx, 'fillStyle', style.color, theme);
  for (const p of item.paths) {
    ctx.beginPath();
    tracePath(ctx, p);
    if (p.kind === 'dot') {
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = theme.background;
      ctx.stroke();
      colour(ctx, 'strokeStyle', style.color, theme);
    } else {
      ctx.lineWidth = style.width;
      ctx.setLineDash(dashPattern(style.dash, style.width));
      ctx.stroke();
    }
  }
}

/**
 * Sets the canvas font only when it changes: the font setter parses its string, and labels
 * switch between two sizes (note F of Run 9a: hundreds of labels on every drag frame).
 */
class FontState {
  private current = '';
  constructor(private readonly ctx: Canvas2D) {}
  set(font: string): void {
    if (font === this.current) return;
    this.ctx.font = font;
    this.current = font;
  }
}

function drawLabel(ctx: Canvas2D, l: PlacedLabel, theme: Theme, fonts: FontState): void {
  const size = theme.fontSize;
  const small = Math.round(size * 0.7);
  const fontOf = (pos: string) => `${String(pos === 'base' ? size : small)}px ${theme.fontFamily}`;
  const widths = l.runs.map((r) => {
    fonts.set(fontOf(r.pos));
    return ctx.measureText(r.text).width;
  });
  const total = widths.reduce((a, w) => a + w, 0);
  let x = l.at.x - (l.align === 'left' ? 0 : l.align === 'right' ? total : total / 2);
  const y =
    l.baseline === 'top'
      ? l.at.y + size * 0.8
      : l.baseline === 'bottom'
        ? l.at.y - size * 0.2
        : l.at.y + size * 0.3;
  ctx.globalAlpha = l.opacity;
  colour(ctx, 'fillStyle', l.color, theme);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const [i, r] of l.runs.entries()) {
    fonts.set(fontOf(r.pos));
    const dy = r.pos === 'sub' ? size * 0.25 : r.pos === 'sup' ? -size * 0.4 : 0;
    ctx.fillText(r.text, x, y + dy);
    x += widths[i] ?? 0;
  }
}

/** Draws a display list on a surface of css size × dpr pixels (see the module comment). */
export function drawDisplay(
  ctx: Canvas2D,
  display: DisplayList,
  ui: UiState,
  theme: Theme,
  dpr: number,
): void {
  const scale = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const { width, height } = display.view.size;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (display.problem !== null) {
    ctx.fillStyle = theme.foreground;
    ctx.font = `${String(theme.fontSize)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Not drawn: ${display.problem}`, width / 2, height / 2);
    return;
  }
  for (const item of display.items) halo(ctx, item, ui, theme);
  for (const item of display.items) drawItem(ctx, item, theme);
  const fonts = new FontState(ctx);
  for (const l of display.labels) drawLabel(ctx, l, theme, fonts);
  ctx.globalAlpha = 1;
}
