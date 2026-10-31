/**
 * The canvas renderer (SPEC §13, ADR-0010 decision 14): a pure function of the display list
 * (itself a function of the scene and the view) and of the UI state (hover, selection). It
 * draws exactly the display list's paths, the same paths hit-testing uses (law L8), and
 * writes only to the 2D context it is given. HiDPI: the canvas has css size × dpr device
 * pixels and every frame starts with setTransform(dpr, …), so all drawing is in CSS px.
 */
import { assertNever } from '@geomira/num/assert';
import type { DisplayList } from '@geomira/scene/display';
import { labelGlyphs, runPx, type RunWidth } from '@geomira/scene/label-hit';
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
  /** The objects of a hovered discovery fact (ADR-0035): ringed like the hovered object. */
  readonly highlight?: ReadonlySet<number>;
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
  const hovered = ui.hover === item.id || ui.highlight?.has(item.id) === true;
  if (!selected && !hovered) return;
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

/** The label font at a size (CSS px). */
function fontAt(px: number, theme: Theme): string {
  return `${String(px)}px ${theme.fontFamily}`;
}

/**
 * The width of a label run as drawn: measured in its font (the base size, or the small size
 * of sub- and superscripts). drawLabel measures with it, and the canvas's label hit-testing
 * (scene hitLabel, ADR-0049) is given it, so both place the runs from the same widths.
 */
export function measuredWidth(ctx: Canvas2D, theme: Theme, fonts = new FontState(ctx)): RunWidth {
  return (r) => {
    fonts.set(fontAt(runPx(r.pos, theme.fontSize), theme));
    return ctx.measureText(r.text).width;
  };
}

/** Draws a label's runs where scene labelGlyphs places them (the box hitLabel tests). */
function drawLabel(ctx: Canvas2D, l: PlacedLabel, theme: Theme, fonts: FontState): void {
  const width = measuredWidth(ctx, theme, fonts);
  const { glyphs } = labelGlyphs(l, l.runs.map(width), theme.fontSize);
  ctx.globalAlpha = l.opacity;
  colour(ctx, 'fillStyle', l.color, theme);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const g of glyphs) {
    fonts.set(fontAt(g.px, theme));
    ctx.fillText(g.text, g.x, g.y);
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

/**
 * The active tool's live preview (Geomdraw's rubber band, ADR-0024) over a drawn frame: its
 * paths dashed in the selection colour at 0.6 opacity, 1 px, as Geomdraw drew it. It does not
 * clear the frame, and nothing in it is hit (it is not in the figure's display list).
 */
export function drawPreview(ctx: Canvas2D, display: DisplayList, theme: Theme, dpr: number): void {
  const scale = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  if (display.problem !== null) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = theme.selection;
  ctx.fillStyle = theme.selection;
  ctx.lineWidth = 1;
  for (const item of display.items)
    for (const p of item.paths) {
      ctx.beginPath();
      tracePath(ctx, p);
      ctx.setLineDash(p.kind === 'dot' ? [] : [4, 4]);
      if (p.kind === 'dot') ctx.fill();
      else ctx.stroke();
    }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}
