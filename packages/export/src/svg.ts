/**
 * SVG export (SPEC §14): the display list of the export frame, drawn as the canvas draws it
 * (apps/web render.ts), in CSS pixels with the view's size: the background, then every item
 * back to front (a polygon's fill at the theme's fill alpha, its strokes with the canvas's
 * dash patterns and round caps; points as dots outlined in the paper colour), then the
 * labels (sub- and superscripts at 0.7 of the font size, shifted as on the canvas). Each
 * object is one group `<g data-id data-name>`, each label a `<text data-id>`, so the set of
 * exported objects can be compared with the set drawn. Colours the export cannot read are
 * drawn in the ink and reported (paint.ts); SVG text is Unicode, so no character is replaced.
 */
import { assertNever } from '@geomira/num/assert';
import type { PlacedLabel } from '@geomira/scene/labels';
import { dashPattern } from '@geomira/scene/style';
import type { DisplayItem, Path } from '@geomira/scene/types';
import type { Vec2 } from '@geomira/scene/viewport';
import type { ExportFrame } from './frame';
import {
  num,
  paintOf,
  uniqueWarnings,
  type ExportText,
  type ExportWarning,
  type Paint,
} from './paint';

/** Decimals of SVG coordinates (CSS px). */
const DIGITS = 3;

/**
 * Whether XML 1.0 allows the code point (its Char production: tab, LF, CR, U+0020–U+D7FF,
 * U+E000–U+FFFD, U+10000 on). Others (C0 controls, U+FFFE, U+FFFF, lone surrogates) are
 * written as U+FFFD so the file stays well-formed (Run 10 audit).
 */
function xmlChar(x: number): boolean {
  return (
    x === 0x9 ||
    x === 0xa ||
    x === 0xd ||
    (x >= 0x20 && x <= 0xd7ff) ||
    (x >= 0xe000 && x <= 0xfffd) ||
    x >= 0x10000
  );
}

export function xml(s: string): string {
  let text = '';
  for (const ch of s) text += xmlChar(ch.codePointAt(0) ?? 0) ? ch : '\ufffd';
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const n = (x: number) => num(x, DIGITS);
const pt = (p: Vec2) => `${n(p.x)},${n(p.y)}`;

function arcPoint(p: Extract<Path, { kind: 'arc' }>, a: number): Vec2 {
  return { x: p.c.x + p.r * Math.cos(a), y: p.c.y - p.r * Math.sin(a) };
}

/** An arc counter-clockwise as seen (sweep flag 0); a full turn is two halves. */
function arcData(p: Extract<Path, { kind: 'arc' }>): string {
  const span = p.to - p.from;
  const r = n(p.r);
  if (span >= 2 * Math.PI) {
    const mid = p.from + Math.PI;
    const [a, b] = [arcPoint(p, p.from), arcPoint(p, mid)];
    return `M${pt(a)} A${r} ${r} 0 1 0 ${pt(b)} A${r} ${r} 0 1 0 ${pt(a)}`;
  }
  const large = span > Math.PI ? 1 : 0;
  return `M${pt(arcPoint(p, p.from))} A${r} ${r} 0 ${String(large)} 0 ${pt(arcPoint(p, p.to))}`;
}

function strokeAttrs(paint: Paint, item: DisplayItem): string {
  const dash = dashPattern(item.style.dash, item.style.width);
  const dashes = dash.length === 0 ? '' : ` stroke-dasharray="${dash.map(n).join(' ')}"`;
  return (
    `fill="none" stroke="#${paint.hex}" stroke-opacity="${n(paint.alpha)}" ` +
    `stroke-width="${n(item.style.width)}"${dashes}`
  );
}

function pathElement(p: Path, item: DisplayItem, paint: Paint, paper: string): string {
  switch (p.kind) {
    case 'dot':
      return (
        `<circle cx="${n(p.c.x)}" cy="${n(p.c.y)}" r="${n(p.r)}" fill="#${paint.hex}" ` +
        `fill-opacity="${n(paint.alpha)}" stroke="${xml(paper)}" stroke-opacity="${n(paint.alpha)}" stroke-width="1"/>`
      );
    case 'poly': {
      const tag = p.closed ? 'polygon' : 'polyline';
      return `<${tag} points="${p.pts.map(pt).join(' ')}" ${strokeAttrs(paint, item)}/>`;
    }
    case 'arc':
      return `<path d="${arcData(p)}" ${strokeAttrs(paint, item)}/>`;
    default:
      return assertNever(p, 'path');
  }
}

function itemElement(f: ExportFrame, item: DisplayItem, warnings: ExportWarning[]): string {
  const paint = paintOf(item.style.color, item.style.opacity, f.theme, item.name, warnings);
  const out = [`<g data-id="${String(item.id)}" data-name="${xml(item.name)}">`];
  if (item.fill !== null)
    out.push(
      `<polygon points="${item.fill.map(pt).join(' ')}" fill="#${paint.hex}" ` +
        `fill-opacity="${n(paint.alpha * f.theme.fillAlpha)}" stroke="none"/>`,
    );
  for (const p of item.paths) out.push(pathElement(p, item, paint, f.theme.paper));
  out.push('</g>');
  return out.join('\n');
}

/** The label as the canvas writes it: runs side by side, scripts smaller and shifted. */
function labelElement(
  f: ExportFrame,
  l: PlacedLabel,
  name: string,
  warnings: ExportWarning[],
): string {
  const size = f.theme.fontPx;
  const small = Math.round(size * 0.7);
  const paint = paintOf(l.color, l.opacity, f.theme, name, warnings);
  const anchor = l.align === 'left' ? 'start' : l.align === 'right' ? 'end' : 'middle';
  const y =
    l.baseline === 'top'
      ? l.at.y + size * 0.8
      : l.baseline === 'bottom'
        ? l.at.y - size * 0.2
        : l.at.y + size * 0.3;
  let shift = 0;
  const spans = l.runs.map((r) => {
    const target = r.pos === 'sub' ? size * 0.25 : r.pos === 'sup' ? -size * 0.4 : 0;
    const dy = target - shift;
    shift = target;
    const fs = r.pos === 'base' ? size : small;
    const dyAttr = dy === 0 ? '' : ` dy="${n(dy)}"`;
    return `<tspan font-size="${String(fs)}"${dyAttr}>${xml(r.text)}</tspan>`;
  });
  return (
    `<text data-id="${String(l.id)}" x="${n(l.at.x)}" y="${n(y)}" text-anchor="${anchor}" ` +
    `fill="#${paint.hex}" fill-opacity="${n(paint.alpha)}">${spans.join('')}</text>`
  );
}

/** The SVG of the frame (module comment). */
export function toSvg(f: ExportFrame): ExportText {
  const { width, height } = f.view.size;
  const warnings: ExportWarning[] = [];
  const names = new Map(f.scene.primitives.map((p) => [p.id, p.name]));
  const title = f.doc.meta.title;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" ` +
      `viewBox="0 0 ${n(width)} ${n(height)}" stroke-linecap="round" stroke-linejoin="round">`,
    ...(title === undefined ? [] : [`<title>${xml(title)}</title>`]),
    `<rect width="${n(width)}" height="${n(height)}" fill="${xml(f.theme.paper)}"/>`,
    ...f.display.items.map((item) => itemElement(f, item, warnings)),
    // Labels are italic serif math, as on the canvas (whose label face is the italic one).
    `<g font-family="${xml(f.theme.fontFamily)}" font-style="italic">`,
    ...f.display.labels.map((l) => labelElement(f, l, names.get(l.id) ?? '', warnings)),
    '</g>',
    '</svg>',
    '',
  ];
  return {
    text: lines.join('\n'),
    warnings: uniqueWarnings(warnings),
    drawn: f.display.items.map((i) => i.id),
  };
}
