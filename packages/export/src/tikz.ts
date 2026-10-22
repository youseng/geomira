/**
 * TikZ export (SPEC §14): a snippet (a `tikzpicture`, needing `\usepackage{tikz}` and
 * `\usepackage{amssymb}`) and a standalone document around it. It draws the export frame's
 * display list, the canvas's own clipped paths, in WORLD coordinates (x = y = one world unit
 * = zoom × 0.75 bp, so the picture has the screen's size: one CSS pixel is 0.75 bp), clipped
 * to the view's rectangle: what the canvas shows, at the canvas's size. Colours are
 * six-digit (`\definecolor{gmcN}{HTML}{RRGGBB}`) with the alpha as an opacity; widths, dot
 * radii, dash patterns and mark sizes are the canvas's pixels in bp. Labels are nodes
 * anchored where the canvas anchors them (labelSide), their TeX from tex-label.ts.
 *
 * Coordinates are world coordinates, except where TeX's fixed-point numbers cannot hold them
 * (|x| ≤ 16383.99, resolution 2^−16): a view less than 1 or more than 1000 world units wide is
 * written in world units × a power of ten (the unit divided by it), so the unit stays a few bp
 * and coordinates a few hundred; and when a coordinate or a dimension would exceed 15000 (the
 * view far from the origin), all are relative to the view's centre. Comments state both.
 */
import { assertNever } from '@geomira/num/assert';
import { dashPattern } from '@geomira/scene/style';
import type { DisplayItem, Path } from '@geomira/scene/types';
import type { Vec2 } from '@geomira/scene/viewport';
import type { ExportFrame } from './frame';
import { undefinedWarnings } from './undefined-objects';
import {
  num,
  paintOf,
  uniqueWarnings,
  type ExportText,
  type ExportWarning,
  type Paint,
} from './paint';
import {
  BP_PER_PX,
  labelSide,
  labelTex,
  measureText,
  unitBp,
  warningLines,
  world,
  worldDigits,
} from './tex-common';

/** Coordinates are made relative to the view's centre when one exceeds this many bp. */
const MAX_DIMENSION_BP = 15000;
/** ... or when a coordinate NUMBER would exceed this (TeX's numbers stop at 16383.99). */
const MAX_NUMBER = 15000;

/**
 * The power of ten the world coordinates are multiplied by: 1 for a view 1 to 1000 world
 * units wide, else the one that makes its width 100 to 1000 units (Run 10 audit: a fitted
 * figure 0.001 wide had x=300000bp, beyond TeX's largest dimension; one 10^9 wide x=0bp).
 */
function coordinateScale(f: ExportFrame): number {
  const span = Math.max(f.view.size.width, f.view.size.height) / f.view.viewport.zoom;
  return span >= 1 && span <= 1000 ? 1 : 10 ** (2 - Math.floor(Math.log10(span)));
}

/** One TikZ picture under construction: colours by first use, coordinates, warnings. */
class Writer {
  readonly colours = new Map<string, string>();
  readonly warnings: ExportWarning[] = [];
  readonly digits: number;
  readonly origin: Vec2;
  /** Coordinates are world coordinates × scale (coordinateScale); one unit is `unit` bp. */
  readonly scale: number;
  readonly unit: number;

  constructor(readonly f: ExportFrame) {
    this.scale = coordinateScale(f);
    this.unit = unitBp(f) / this.scale;
    // As worldDigits: the last digit is at most 0.01 bp on paper.
    this.digits =
      this.scale === 1 ? worldDigits(f) : Math.max(0, Math.ceil(Math.log10(this.unit * 100)));
    const { viewport, size } = f.view;
    const reach = (c: number, extent: number) => Math.abs(c) + extent / viewport.zoom;
    const far = [reach(viewport.cx, size.width), reach(viewport.cy, size.height)].some(
      (r) => r * unitBp(f) > MAX_DIMENSION_BP || r * this.scale > MAX_NUMBER,
    );
    this.origin = far ? { x: viewport.cx, y: viewport.cy } : { x: 0, y: 0 };
  }

  colour(hex: string): string {
    let c = this.colours.get(hex);
    if (c === undefined) {
      c = `gmc${String(this.colours.size)}`;
      this.colours.set(hex, c);
    }
    return c;
  }

  /** A screen point as a world coordinate `(x,y)`. */
  at(s: Vec2): string {
    const w = world(this.f, s);
    const d = this.digits;
    const k = this.scale;
    return `(${num((w.x - this.origin.x) * k, d)},${num((w.y - this.origin.y) * k, d)})`;
  }

  /** A length of `px` CSS pixels in world units. */
  len(px: number): string {
    return num((px / this.f.view.viewport.zoom) * this.scale, this.digits + 1);
  }
}

const bp = (px: number) => `${num(px * BP_PER_PX, 4)}bp`;

function opacity(key: string, a: number): string {
  return a < 1 ? `, ${key}=${num(a, 4)}` : '';
}

function strokeOptions(w: Writer, item: DisplayItem, paint: Paint): string {
  const dash = dashPattern(item.style.dash, item.style.width);
  const pattern =
    dash.length === 0
      ? ''
      : `, dash pattern=${dash.map((x, i) => `${i % 2 === 0 ? 'on' : 'off'} ${bp(x)}`).join(' ')}`;
  return `${w.colour(paint.hex)}, line width=${bp(item.style.width)}${pattern}${opacity('draw opacity', paint.alpha)}`;
}

function pathLine(w: Writer, p: Path, item: DisplayItem, paint: Paint): string {
  switch (p.kind) {
    case 'dot': {
      const fill = w.colour(paint.hex);
      const paper = w.colour(paperHex(w));
      return `\\filldraw[fill=${fill}, draw=${paper}, line width=${bp(1)}${opacity('opacity', paint.alpha)}] ${w.at(p.c)} circle[radius=${bp(p.r)}];`;
    }
    case 'poly':
      return `\\draw[${strokeOptions(w, item, paint)}] ${p.pts.map((q) => w.at(q)).join(' -- ')}${p.closed ? ' -- cycle' : ''};`;
    case 'arc': {
      const start = { x: p.c.x + p.r * Math.cos(p.from), y: p.c.y - p.r * Math.sin(p.from) };
      const deg = (a: number) => num((a * 180) / Math.PI, 4);
      return `\\draw[${strokeOptions(w, item, paint)}] ${w.at(start)} arc[start angle=${deg(p.from)}, end angle=${deg(p.to)}, radius=${w.len(p.r)}];`;
    }
    default:
      return assertNever(p, 'path');
  }
}

function paperHex(w: Writer): string {
  return paintOf(w.f.theme.paper, 1, w.f.theme, 'the paper', w.warnings).hex;
}

function itemLines(w: Writer, item: DisplayItem): string[] {
  const paint = paintOf(item.style.color, item.style.opacity, w.f.theme, item.name, w.warnings);
  const out = [`% ${item.name}`];
  if (item.fill !== null)
    out.push(
      `\\fill[${w.colour(paint.hex)}${opacity('fill opacity', paint.alpha * w.f.theme.fillAlpha)}] ${item.fill.map((q) => w.at(q)).join(' -- ')} -- cycle;`,
    );
  for (const p of item.paths) out.push(pathLine(w, p, item, paint));
  return out;
}

const ANCHORS: Readonly<Record<string, string>> = {
  '1,1': 'south west',
  '0,1': 'south',
  '-1,1': 'south east',
  '1,0': 'west',
  '0,0': 'center',
  '-1,0': 'east',
  '1,-1': 'north west',
  '0,-1': 'north',
  '-1,-1': 'north east',
};

function labelLines(w: Writer): string[] {
  return w.f.display.labels.map((l) => {
    const t = labelTex(w.f, l, w.warnings);
    const side = labelSide(l);
    const paint = paintOf(l.color, l.opacity, w.f.theme, t.name, w.warnings);
    const anchor = ANCHORS[`${String(side.x)},${String(side.y)}`] ?? 'center';
    return `\\node[anchor=${anchor}, inner sep=0pt, text=${w.colour(paint.hex)}${opacity('text opacity', paint.alpha)}] at ${w.at(l.at)} {${t.tex}}; % label of ${t.name}`;
  });
}

function picture(f: ExportFrame): { lines: string[]; warnings: ExportWarning[] } {
  const w = new Writer(f);
  const unit = `${num(w.unit, 6)}bp`;
  const { width, height } = f.view.size;
  const body = [
    `\\clip ${w.at({ x: 0, y: height })} rectangle ${w.at({ x: width, y: 0 })};`,
    ...f.display.items.flatMap((item) => itemLines(w, item)),
    ...labelLines(w),
  ];
  const warnings = uniqueWarnings([...undefinedWarnings(f.scene), ...w.warnings]);
  const header = [
    `% GEOMIRA export: TikZ. One unit is ${unit} (${measureText(f.view.viewport.zoom)} px on screen).`,
    '% Needs \\usepackage{tikz} and \\usepackage{amssymb}.',
    ...(w.scale === 1
      ? []
      : [
          `% Coordinates are world coordinates × ${String(w.scale)} (TeX's numbers stay in range).`,
        ]),
    ...(w.origin.x === 0 && w.origin.y === 0
      ? []
      : [
          `% Coordinates are relative to (${num(w.origin.x, w.digits)}, ${num(w.origin.y, w.digits)}), the center of the view.`,
        ]),
    ...warningLines(warnings, '%'),
  ];
  return {
    lines: [
      ...header,
      `\\begin{tikzpicture}[x=${unit}, y=${unit}, line cap=round, line join=round]`,
      ...[...w.colours].map(([hex, name]) => `\\definecolor{${name}}{HTML}{${hex}}`),
      ...body,
      '\\end{tikzpicture}',
    ],
    warnings,
  };
}

/** The TikZ snippet of the frame (module comment). */
export function toTikz(f: ExportFrame): ExportText {
  const p = picture(f);
  return {
    text: [...p.lines, ''].join('\n'),
    warnings: p.warnings,
    drawn: f.display.items.map((i) => i.id),
  };
}

/** A standalone LaTeX document around the snippet (compiles with pdflatex). */
export function toTikzStandalone(f: ExportFrame): ExportText {
  const p = picture(f);
  const text = [
    '\\documentclass[11pt]{standalone}',
    '\\usepackage{tikz}',
    '\\usepackage{amssymb}',
    '\\begin{document}',
    ...p.lines,
    '\\end{document}',
    '',
  ].join('\n');
  return { text, warnings: p.warnings, drawn: f.display.items.map((i) => i.id) };
}
