/**
 * The drawing of an Asymptote export: the display list's items back to front, as the canvas
 * draws them. Points, lines, full circles and polygons are drawn through their variables
 * (`gm_dot(A, …)`, `draw(gm_path(l), …)` clipped to the canvas's drawn region,
 * `draw(circle(w.c, w.r), …)`, `fill`/`draw` of a polygon's path); marks, texts and arcs
 * from the display list's own paths in world coordinates. Asymptote's circle is unitcircle,
 * four Bézier pieces off by up to r/3600: a circle whose screen radius makes that more than
 * ARC_BEZIER_PX is drawn from the display list's arcs as enough explicit Bézier pieces
 * (arc-bezier.ts, ADR-0028), and one the canvas samples as a polyline as that polyline. Pens carry the six-digit colour,
 * the width in bp, the dash pattern and the opacity; labels are placed by their reference
 * point and side (tex-common.ts) with `labelmargin = 0`.
 */
import { assertNever } from '@geomira/num/assert';
import { dashPattern } from '@geomira/scene/style';
import type { DisplayItem, Path } from '@geomira/scene/types';
import type { Vec2 } from '@geomira/scene/viewport';
import { arcBeziers, bezierPieces } from './arc-bezier';
import type { AsyPlan } from './asy-plan';
import type { ExportFrame } from './frame';
import { num, paintOf, type ExportWarning, type Paint } from './paint';
import { BP_PER_PX, inkPaths, labelSide, labelTex, world, worldDigits } from './tex-common';

/** The drawing statements under construction: pens by colour, helpers used, warnings. */
export class AsyDrawer {
  readonly pens = new Map<string, string>();
  readonly helpers = new Set<string>();
  readonly warnings: ExportWarning[] = [];
  readonly digits: number;

  constructor(
    readonly f: ExportFrame,
    readonly plan: AsyPlan,
  ) {
    this.digits = worldDigits(f) + 2;
  }

  pen(hex: string): string {
    let p = this.pens.get(hex);
    if (p === undefined) {
      p = `gmc${String(this.pens.size)}`;
      this.pens.set(hex, p);
    }
    return p;
  }

  at(s: Vec2): string {
    const w = world(this.f, s);
    return `(${num(w.x, this.digits)}, ${num(w.y, this.digits)})`;
  }

  /** Screen pixels as world units. */
  len(px: number): string {
    return num(px / this.f.view.viewport.zoom, this.digits + 1);
  }
}

/** Asymptote's string literal: only `"` is escaped (backslashes reach TeX unchanged). */
export function asyString(s: string): string {
  return `"${s.replaceAll('"', '\\"')}"`;
}

const opac = (a: number) => (a < 1 ? ` + opacity(${num(a, 4)})` : '');

function strokePen(d: AsyDrawer, item: DisplayItem, paint: Paint): string {
  const dash = dashPattern(item.style.dash, item.style.width);
  const type =
    dash.length === 0
      ? ''
      : ` + linetype(new real[] {${dash.map((x) => num(x * BP_PER_PX, 4)).join(', ')}}, false)`;
  return `${d.pen(paint.hex)} + linewidth(${num(item.style.width * BP_PER_PX, 4)})${type}${opac(paint.alpha)}`;
}

/**
 * Whether Asymptote's own circle and arc (unitcircle's four quarter pieces, or parts of them)
 * stay within ARC_BEZIER_PX of a circle of screen radius rPx; a larger arc is written as
 * enough Bézier pieces (arc-bezier.ts, ADR-0028).
 */
function unitcircleOk(rPx: number): boolean {
  return bezierPieces(rPx, 2 * Math.PI) <= 4;
}

function pathCode(d: AsyDrawer, p: Path, item: DisplayItem, paint: Paint): string {
  switch (p.kind) {
    case 'dot':
      d.helpers.add('dot');
      return `gm_dot(${d.at(p.c)}, ${d.len(p.r)}, ${d.pen(paint.hex)}, ${num(paint.alpha, 4)});`;
    case 'poly':
      return `draw(${p.pts.map((q) => d.at(q)).join('--')}${p.closed ? '--cycle' : ''}, ${strokePen(d, item, paint)});`;
    case 'arc': {
      const c = world(d.f, p.c);
      const deg = (a: number) => num((a * 180) / Math.PI, 4);
      if (unitcircleOk(p.r))
        return `draw(arc((${num(c.x, d.digits)}, ${num(c.y, d.digits)}), ${d.len(p.r)}, ${deg(p.from)}, ${deg(p.to)}), ${strokePen(d, item, paint)});`;
      const bs = arcBeziers(p);
      const pieces = bs.map((b) => `..controls ${d.at(b.c0)} and ${d.at(b.c1)}..${d.at(b.p1)}`);
      return `draw(${d.at(bs[0]?.p0 ?? p.c)}${pieces.join('')}, ${strokePen(d, item, paint)});`;
    }
    default:
      return assertNever(p, 'path');
  }
}

/** The statements of one item, through its variable when it has one (module comment). */
function itemCode(d: AsyDrawer, item: DisplayItem): string[] {
  const paint = paintOf(item.style.color, item.style.opacity, d.f.theme, item.name, d.warnings);
  const v = d.plan.byId.get(item.id);
  const value = d.f.values.get(item.id);
  const out = [`// ${item.name}`];
  const r = item.paths[0]?.kind === 'dot' ? item.paths[0].r : 0;
  // A circle is drawn through its variable when unitcircle is accurate enough at its size.
  const near = item.paths.every((p) => p.kind === 'arc' && unitcircleOk(p.r));
  if (v !== undefined && item.kind === 'point') {
    d.helpers.add('dot');
    out.push(`gm_dot(${v.ident}, ${d.len(r)}, ${d.pen(paint.hex)}, ${num(paint.alpha, 4)});`);
  } else if (v !== undefined && item.kind === 'line') {
    d.helpers.add('path');
    out.push(`draw(gm_path(${v.ident}), ${strokePen(d, item, paint)});`);
  } else if (
    v !== undefined &&
    item.kind === 'circle' &&
    value?.kind === 'circle' &&
    value.arc === null &&
    near
  ) {
    out.push(`draw(circle(${v.ident}.c, ${v.ident}.r), ${strokePen(d, item, paint)});`);
  } else if (v !== undefined && item.kind === 'polygon') {
    if (item.fill !== null)
      out.push(`fill(${v.ident}, ${d.pen(paint.hex)}${opac(paint.alpha * d.f.theme.fillAlpha)});`);
    // Dashes restart at every vertex, as the canvas strokes each edge on its own (ADR-0028).
    out.push(
      dashPattern(item.style.dash, item.style.width).length === 0
        ? `draw(${v.ident}, ${strokePen(d, item, paint)});`
        : `for (int i = 0; i < length(${v.ident}); ++i) draw(subpath(${v.ident}, i, i + 1), ${strokePen(d, item, paint)});`,
    );
  } else {
    if (item.fill !== null)
      out.push(
        `fill(${item.fill.map((q) => d.at(q)).join('--')}--cycle, ${d.pen(paint.hex)}${opac(paint.alpha * d.f.theme.fillAlpha)});`,
      );
    for (const p of inkPaths(item)) out.push(pathCode(d, p, item, paint));
  }
  return out;
}

function labelCode(d: AsyDrawer): string[] {
  return d.f.display.labels.map((l) => {
    const t = labelTex(d.f, l, d.warnings);
    const side = labelSide(l);
    const paint = paintOf(l.color, l.opacity, d.f.theme, t.name, d.warnings);
    return `label(${asyString(t.tex)}, ${d.at(l.at)}, (${String(side.x)}, ${String(side.y)}), ${d.pen(paint.hex)}${opac(paint.alpha)}); // label of ${t.name}`;
  });
}

/** The drawing statements: items, labels, then the picture's frame and clip (the view). */
export function drawingCode(d: AsyDrawer): string[] {
  const { width, height } = d.f.view.size;
  const view = `box(${d.at({ x: 0, y: height })}, ${d.at({ x: width, y: 0 })})`;
  return [
    ...d.f.display.items.flatMap((item) => itemCode(d, item)),
    ...labelCode(d),
    `draw(${view}, invisible); // the picture is the view: all of it, nothing outside`,
    `clip(${view});`,
  ];
}
