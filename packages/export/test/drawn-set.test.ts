/**
 * Note A of Run 9a: every format exports exactly the objects the canvas draws for the same
 * view, and labels exactly the ones it labels. The expected sets are computed the way the
 * app draws (scene/build + scene/display layout), independently of the exporters; each
 * format's own markers are read back from its output.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildScene } from '@geomira/scene/build';
import { layout } from '@geomira/scene/display';
import type { View } from '@geomira/scene/viewport';
import { toAsymptote } from '../src/asy';
import { pngPlan } from '../src/png';
import { toSvg } from '../src/svg';
import { toTikz, toTikzStandalone } from '../src/tikz';
import { examples, figure, frameOf, REGISTRY } from './helpers/figure';

interface Drawn {
  readonly items: string[];
  readonly labels: string[];
}

/** What the canvas draws for the figure in the view (names, back to front). */
function canvas(text: string, view: View): Drawn {
  const { doc, values } = figure(text);
  const scene = buildScene(doc, values);
  const d = layout(scene, view);
  const name = new Map(scene.primitives.map((p) => [p.id, p.name]));
  return {
    items: d.items.map((i) => i.name),
    labels: d.labels.map((l) => name.get(l.id) ?? '?'),
  };
}

function fromSvg(svg: string, text: string): Drawn {
  const { doc } = figure(text);
  const byId = new Map(doc.objects.map((o) => [String(o.id), o.name]));
  return {
    items: [...svg.matchAll(/<g data-id="(\d+)" data-name="([^"]*)">/gu)].map((m) => {
      expect(byId.get(m[1] ?? '')).toBe(
        (m[2] ?? '').replaceAll('&apos;', "'").replaceAll('&amp;', '&'),
      );
      return byId.get(m[1] ?? '') ?? '?';
    }),
    labels: [...svg.matchAll(/<text data-id="(\d+)"/gu)].map((m) => byId.get(m[1] ?? '') ?? '?'),
  };
}

/** The `<comment> name` markers of the drawing section (after `start`), and the label markers. */
function fromComments(src: string, comment: string, start: RegExp): Drawn {
  const all = src.split('\n');
  const lines = all.slice(all.findIndex((l) => start.test(l)) + 1);
  const prefix = `${comment} `;
  return {
    items: lines.filter((l) => l.startsWith(prefix)).map((l) => l.slice(prefix.length)),
    labels: lines.flatMap((l) => {
      const at = l.lastIndexOf(`${comment} label of `);
      return at < 0 ? [] : [l.slice(at + comment.length + ' label of '.length)];
    }),
  };
}

const TIKZ_START = /^\\clip /u;
const ASY_START = /^\/\/ ---- drawing/u;

const HIDDEN = `@version 1
@layer back [opacity=0.5]
@layer refl = image(s, main)
A = (0, 0)
B = (4, 0)
C = (1, 3)
D = (2, 1) [hidden]
E = midpoint(A, C) [layers=back]
F = midpoint(B, C) [z=-3]
G = (30, 30)
l = line(A, B)
s = reflect(l)
style C* [hidden]
`;

const IMAGE_ONLY = HIDDEN.replace('@version 1\n', '@version 1\n@layer main [visible=false]\n');

describe('the exported objects are the drawn objects (note A)', () => {
  const inputs = [
    ...examples(),
    ...['constructions', 'display'].map((n) => ({
      name: n,
      text: readFileSync(`tests/fixtures/export/${n}.geo`, 'utf8'),
    })),
    { name: 'hidden, layers, z, off-view, coincident images', text: HIDDEN },
    { name: 'image only view', text: IMAGE_ONLY },
  ];

  for (const input of inputs)
    it(input.name, () => {
      const f = frameOf(input.text);
      const want = canvas(input.text, f.view);
      expect(want.items.length).toBeGreaterThan(0);
      expect(fromSvg(toSvg(f).text, input.text)).toEqual(want);
      expect(fromComments(toTikz(f).text, '%', TIKZ_START)).toEqual(want);
      expect(fromComments(toTikzStandalone(f).text, '%', TIKZ_START)).toEqual(want);
      for (const dialect of ['standalone', 'aops'] as const)
        expect(fromComments(toAsymptote(f, REGISTRY, dialect).text, '//', ASY_START)).toEqual(want);
      const ids = new Map(f.scene.primitives.map((p) => [p.id, p.name]));
      expect(pngPlan(f).drawn.map((id) => ids.get(id))).toEqual(want.items);
    });

  it('hidden objects, coincident images and objects off the view are not exported', () => {
    const view: View = { viewport: { cx: 2, cy: 0, zoom: 60 }, size: { width: 480, height: 480 } };
    const f = frameOf(HIDDEN, { view });
    expect(fromSvg(toSvg(f).text, HIDDEN)).toEqual(canvas(HIDDEN, view));
    const names = fromSvg(toSvg(f).text, HIDDEN).items;
    for (const gone of ['D', 'G', 'C*', 'A*', 'B*', 'l*']) expect(names).not.toContain(gone);
    // E is in the layer back, not in the rule's source layer main: it has no image.
    expect(names).toEqual(['F', 'l', 'A', 'B', 'C', 'E', 'F*']);
    // z = -3 puts F under everything else of main; the layer back is drawn above main.
    expect(names.indexOf('F')).toBeLessThan(names.indexOf('A'));
  });

  it('with the source layer hidden, the fixed points are drawn as images', () => {
    const names = fromSvg(toSvg(frameOf(IMAGE_ONLY)).text, IMAGE_ONLY).items;
    expect(names).toEqual(expect.arrayContaining(['A*', 'B*', 'l*']));
    expect(names).not.toContain('A');
  });
});
