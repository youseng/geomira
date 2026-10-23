/**
 * ADR-0029: an object's own opacity reaches every format through the scene (the layer's
 * opacity times the style's), and a document without it exports exactly as before (the
 * golden snapshots of the examples and fixtures stay byte-identical; `opacity=1` changes
 * nothing either). tests/fixtures/export/opacity.geo is compiled by tex.yml.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Document } from '@geomira/kernel/document';
import { toAsymptote } from '../src/asy';
import { exportFrame, type ExportFrame } from '../src/frame';
import { toSvg } from '../src/svg';
import { toTikz, toTikzStandalone } from '../src/tikz';
import { examples, figure, frameOf, REGISTRY } from './helpers/figure';

const FIXTURE = readFileSync('tests/fixtures/export/opacity.geo', 'utf8');

/** The SVG group of one object. */
function group(svg: string, name: string): string {
  const m = new RegExp(`<g data-id="\\d+" data-name="${name.replace('*', '\\*')}">[^]*?</g>`, 'u');
  return m.exec(svg)?.[0] ?? '';
}

function outputs(f: ExportFrame): string[] {
  return [
    toSvg(f).text,
    toTikz(f).text,
    toTikzStandalone(f).text,
    toAsymptote(f, REGISTRY, 'standalone').text,
    toAsymptote(f, REGISTRY, 'aops').text,
  ];
}

describe('the style opacity in the exports (ADR-0029)', () => {
  const f = frameOf(FIXTURE);

  it('the frame: own opacity times the layer opacity; images inherit it', () => {
    const op = (n: string) => f.display.items.find((i) => i.name === n)?.style.opacity;
    expect(op('A')).toBe(0.6);
    expect(op('B')).toBe(0.25);
    expect(op('C')).toBe(1);
    // D: opacity 0.5 in the layer faint of opacity 0.5.
    expect(op('D')).toBe(0.25);
    expect(op('l')).toBe(0.3);
    expect(op('l*')).toBe(0.3);
    expect(op('tri*')).toBe(0.4);
    expect(op('t1')).toBe(0.55);
  });

  it('SVG: strokes, dots, fills and labels', () => {
    const svg = toSvg(f).text;
    expect(group(svg, 'l')).toContain('stroke-opacity="0.3"');
    expect(group(svg, 'l*')).toContain('stroke-opacity="0.3"');
    expect(group(svg, 'B')).toContain('fill-opacity="0.25"');
    expect(group(svg, 'D')).toContain('fill-opacity="0.25"');
    expect(group(svg, 'C')).toContain('fill-opacity="1"');
    expect(group(svg, 'tri')).toContain('stroke-opacity="0.4"');
    // The polygon's fill: the theme's fill alpha (0.08) of the object's opacity.
    expect(group(svg, 'tri')).toContain('fill-opacity="0.032"');
    expect(group(svg, 'a1')).toContain('stroke-opacity="0.5"');
    expect(group(svg, 'm1')).toContain('stroke-opacity="0.35"');
    expect(svg).toMatch(/fill="#D9730D" fill-opacity="0\.45"><tspan font-size="15">k</u);
    expect(svg).toMatch(/fill-opacity="0\.55"><tspan font-size="15">faded</u);
  });

  it('TikZ: draw, fill and text opacities', () => {
    const tikz = toTikz(f).text;
    expect(tikz).toMatch(/draw opacity=0\.3\] \(-8\.64,-0\.82\)/u);
    expect(tikz).toContain('fill=gmc5, draw=gmc4, line width=0.75bp, opacity=0.25] (6,0)');
    expect(tikz).toContain('fill opacity=0.032]');
    expect(tikz).toContain('text opacity=0.55] at (4,6) {faded}');
    // C has no opacity: no opacity key at all.
    expect(tikz).toContain('\\filldraw[fill=gmc3, draw=gmc4, line width=0.75bp] (1,4)');
  });

  it('Asymptote: opacity pens', () => {
    for (const mode of ['standalone', 'aops'] as const) {
      const asy = toAsymptote(f, REGISTRY, mode).text;
      expect(asy, mode).toContain('opacity(0.3)');
      expect(asy, mode).toContain('opacity(0.45)');
      expect(asy, mode).toContain('opacity(0.032)');
    }
  });
});

describe('documents without an opacity export as before (ADR-0029)', () => {
  /** The document with `opacity=1` written on every object that has no opacity. */
  function withOpacity1(doc: Document): Document {
    return {
      ...doc,
      objects: doc.objects.map((o) => ({ ...o, style: { ...o.style, opacity: 1 } })),
    };
  }

  const inputs = [
    ...examples(),
    ...['constructions', 'display', 'numeric', 'dashed-polygons'].map((n) => ({
      name: n,
      text: readFileSync(`tests/fixtures/export/${n}.geo`, 'utf8'),
    })),
  ];
  for (const input of inputs)
    it(`${input.name}: opacity=1 everywhere gives the same bytes in every format`, () => {
      const { doc, values } = figure(input.text);
      const plain = exportFrame(doc, values);
      const ones = exportFrame(withOpacity1(doc), values);
      if (!plain.ok || !ones.ok) throw new Error('no frame');
      expect(outputs(ones.frame)).toEqual(outputs(plain.frame));
    });
});
