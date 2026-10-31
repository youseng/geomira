/**
 * ADR-0048: shown measurements in every export format. The fixture
 * tests/fixtures/export/measurements.geo (compiled by tex.yml through scripts/export-tex.ts)
 * gets golden snapshots like the other fixtures; every format exports exactly the measurements
 * the canvas draws and labels (note A of Run 9a); the values reach TeX through texText (° and
 * Greek letters escaped); an Undefined shown measurement is a warning, never drawn; a document
 * without shown measurements exports as before (its numbers are not drawn).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildScene } from '@geomira/scene/build';
import { layout } from '@geomira/scene/display';
import { toAsymptote } from '../src/asy';
import { pngPlan } from '../src/png';
import { toSvg } from '../src/svg';
import { toTikz, toTikzStandalone } from '../src/tikz';
import { figure, frameOf, REGISTRY } from './helpers/figure';

const TEXT = readFileSync('tests/fixtures/export/measurements.geo', 'utf8');

describe('the measurements fixture (ADR-0048)', () => {
  it('golden snapshots in every format', async () => {
    const f = frameOf(TEXT);
    const dir = './__snapshots__/fixture-measurements';
    await expect(toSvg(f).text).toMatchFileSnapshot(`${dir}/figure.svg`);
    await expect(toTikz(f).text).toMatchFileSnapshot(`${dir}/snippet.tikz.tex`);
    await expect(toTikzStandalone(f).text).toMatchFileSnapshot(`${dir}/standalone.tex`);
    await expect(toAsymptote(f, REGISTRY, 'standalone').text).toMatchFileSnapshot(
      `${dir}/standalone.asy`,
    );
    await expect(toAsymptote(f, REGISTRY, 'aops').text).toMatchFileSnapshot(`${dir}/aops.asy`);
  });

  it('the canvas draws and labels the shown measurements, and every format exports the same', () => {
    const f = frameOf(TEXT);
    const { doc, values } = figure(TEXT);
    const scene = buildScene(doc, values);
    const d = layout(scene, f.view);
    const name = new Map(scene.primitives.map((p) => [p.id, p.name]));
    const items = d.items.map((i) => i.name);
    const labels = d.labels.map((l) => name.get(l.id) ?? '?');
    for (const m of ['d', 'e', 'h', 'α', 'β', 'γ']) {
      expect(items, m).toContain(m);
      expect(labels, m).toContain(m);
    }
    for (const m of ['n', 'r', 'u']) expect(items, m).not.toContain(m);
    const svg = toSvg(f).text;
    const ids = (re: RegExp) => [...svg.matchAll(re)].map((x) => name.get(Number(x[1])) ?? '?');
    expect(ids(/<g data-id="(\d+)"/gu)).toEqual(items);
    expect(ids(/<text data-id="(\d+)"/gu)).toEqual(labels);
    expect(pngPlan(f).drawn.map((id) => name.get(id))).toEqual(items);
    const text = (n: string) => d.labels.find((l) => name.get(l.id) === n)?.text;
    expect(text('d')).toBe('6.00');
    expect(text('e')).toBe(`b_1 = ${Math.hypot(1, 4).toFixed(3)}`);
    expect(text('β')).toMatch(/^\\beta = \d+°$/u);
    expect(text('γ')).toMatch(/^\d+\.\d°$/u);
  });

  it('TikZ and Asymptote write the values through texText; the Undefined angle is a warning', () => {
    const f = frameOf(TEXT);
    const tikz = toTikzStandalone(f).text;
    expect(tikz).toContain('{6.00}; % label of d');
    expect(tikz).toContain('75.96$^{\\circ}$}; % label of α');
    expect(tikz).toContain('{$\\beta$ = 65$^{\\circ}$}; % label of β');
    const asy = toAsymptote(f, REGISTRY, 'standalone');
    expect(asy.text).toContain('label of α');
    for (const out of [toTikz(f), toAsymptote(f, REGISTRY, 'aops'), toSvg(f)])
      expect(out.warnings.map((w) => w.kind)).toContain('undefined');
    expect(tikz).toMatch(/% Warning: u is undefined in this figure/u);
  });

  it('without show, the same document draws no measurement (old documents unchanged)', () => {
    const plain = TEXT.replaceAll(', show', '').replaceAll(' [show]', '').replaceAll('show, ', '');
    expect(plain).not.toMatch(/\bshow\b/u);
    const f = frameOf(plain);
    const svg = toSvg(f).text;
    const { doc } = figure(plain);
    const numbers = doc.objects.filter(
      (o) => /^[a-zαβγ]/u.test(o.name) && !['s', 'l'].includes(o.name),
    );
    for (const o of numbers) expect(svg).not.toContain(`data-id="${String(o.id)}"`);
  });
});
