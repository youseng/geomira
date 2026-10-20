import { toNumber, type Rational } from '@geomira/num/rational';
import { describe, expect, it } from 'vitest';
import type { Document } from '@geomira/kernel/document';
import { exprAt } from '../src/expr-path';
import { readFree } from '../src/free';
import { prepare, type Prepared } from '../src/prepare';
import { drawSample, dyadic } from '../src/sampler';
import { c, Figure, n, REGISTRY } from './helpers/build';

function prep(f: Figure, id: number): Prepared {
  const p = prepare(f.doc, id, REGISTRY);
  if (!p.ok) throw new Error(p.reason);
  return p.prepared;
}

function values(p: Prepared, doc: Document, kind: string): Rational[][] {
  return p.free.filter((x) => x.kind === kind).map((x) => readFree(doc, x) ?? []);
}

const isPow2 = (d: bigint) => d > 0n && (d & (d - 1n)) === 0n;

function triangle(): { f: Figure; id: number } {
  const f = new Figure().point('A', 1, 3).point('B', 0, 0).point('C', 4, 0);
  return { f, id: f.claim('collinear', 'A', 'B', 'C') };
}

function cross(pts: Rational[][]): number {
  const [a, b, cc] = pts.map((p) => p.map(toNumber));
  if (a === undefined || b === undefined || cc === undefined) return NaN;
  return (
    ((b[0] ?? 0) - (a[0] ?? 0)) * ((cc[1] ?? 0) - (a[1] ?? 0)) -
    ((b[1] ?? 0) - (a[1] ?? 0)) * ((cc[0] ?? 0) - (a[0] ?? 0))
  );
}

describe('samplers (SPEC §10.4)', () => {
  it('dyadic rounding is exact', () => {
    expect(dyadic(1.3, -2)).toEqual({ num: 5n, den: 4n });
    expect(dyadic(13, 2)).toEqual({ num: 12n, den: 1n });
    expect(dyadic(-0.1, -10)).toEqual({ num: -51n, den: 512n });
  });

  it('LOCAL: a similarity plus small noise; never mirrored, so orientation is kept; the mirror flag is ignored', () => {
    const { f, id } = triangle();
    const p = prep(f, id);
    for (let s = 0; s < 300; s++) {
      const doc = drawSample(p, 'local', s, true);
      expect(drawSample(p, 'local', s, false)).toEqual(doc);
      expect(cross(values(p, doc, 'point'))).toBeGreaterThan(0);
    }
  });

  it('LOCAL stays in the configuration; GLOBAL leaves it (the acute triangle becomes obtuse)', () => {
    const { f, id } = triangle();
    const p = prep(f, id);
    const obtuse = (doc: Document) => {
      const [a, b, cc] = values(p, doc, 'point').map((x) => x.map(toNumber));
      const dot = (u: number[] | undefined, v: number[] | undefined, w: number[] | undefined) =>
        ((v?.[0] ?? 0) - (u?.[0] ?? 0)) * ((w?.[0] ?? 0) - (u?.[0] ?? 0)) +
        ((v?.[1] ?? 0) - (u?.[1] ?? 0)) * ((w?.[1] ?? 0) - (u?.[1] ?? 0));
      return dot(a, b, cc) < 0 || dot(b, a, cc) < 0 || dot(cc, a, b) < 0;
    };
    const seeds = Array.from({ length: 300 }, (_, i) => i);
    expect(seeds.filter((s) => obtuse(drawSample(p, 'local', s, false)))).toEqual([]);
    expect(seeds.filter((s) => obtuse(drawSample(p, 'global', s, false))).length).toBeGreaterThan(
      30,
    );
  });

  it('GLOBAL: a mirrored sample reverses the orientation of a figure (the same draws otherwise)', () => {
    const f = new Figure().point('A', 0, 10).point('B', 0, 0).point('C', 10, 0);
    const p = prep(f, f.claim('collinear', 'A', 'B', 'C'));
    let flips = 0;
    for (let s = 0; s < 200; s++) {
      const a = cross(values(p, drawSample(p, 'global', s, false), 'point'));
      const b = cross(values(p, drawSample(p, 'global', s, true), 'point'));
      if (Math.sign(a) !== Math.sign(b)) flips++;
    }
    // Noise of 0.3·scale reverses some figures by itself; most pairs differ.
    expect(flips).toBeGreaterThan(120);
  });

  it('samples are on a coarse dyadic grid (denominators at most about 2^10 / scale)', () => {
    const f = new Figure()
      .point('A', 1, 3)
      .point('B', 0, 0)
      .point('C', 4, 0)
      .def('w', 'circumcircle', 'A', 'B', 'C')
      .add('P', c('on', 'w', n(1), n(2)))
      .add('Q', c('on', c('segment', 'A', 'B'), n('1/3')))
      .add('k', c('param', n(0), n(3), n(1)))
      .add('r', c('circle', 'A', n(2)));
    const p = prep(f, f.claim('on', 'P', 'w'));
    expect(p.free.map((x) => x.kind)).toEqual([
      'point',
      'point',
      'point',
      'stereo',
      'line-glider',
      'param',
      'radius',
    ]);
    for (const regime of ['local', 'global'] as const) {
      for (let s = 0; s < 50; s++) {
        const doc = drawSample(p, regime, s, s % 2 === 1);
        for (const xy of values(p, doc, 'point'))
          for (const x of xy) expect(isPow2(x.den) && x.den <= 256n).toBe(true);
        for (const uv of values(p, doc, 'stereo'))
          for (const x of uv) expect(isPow2(x.den) && x.den <= 1024n).toBe(true);
        const [t] = values(p, doc, 'line-glider')[0] ?? [];
        if (regime === 'global')
          expect(toNumber(t ?? { num: -1n, den: 1n })).toBeGreaterThanOrEqual(0);
        const [lo, hi, v] = values(p, doc, 'param')[0] ?? [];
        expect(lo).toEqual({ num: 0n, den: 1n });
        expect(hi).toEqual({ num: 3n, den: 1n });
        expect(toNumber(v ?? lo ?? { num: -1n, den: 1n })).toBeGreaterThanOrEqual(0);
        expect(toNumber(v ?? hi ?? { num: 9n, den: 1n })).toBeLessThanOrEqual(3);
        const [r] = values(p, doc, 'radius')[0] ?? [];
        expect(toNumber(r ?? { num: 0n, den: 1n })).toBeGreaterThan(0.9);
      }
    }
  });

  it('gliders named by an in_order hypothesis on one circle are drawn sorted (global)', () => {
    const f = new Figure().point('O', 0, 0).point('X', 5, 0).def('w', 'circle', 'O', 'X');
    for (const [name, u] of [
      ['P', 1],
      ['Q', 2],
      ['R', 3],
      ['S', 5],
    ] as const)
      f.add(name, c('on', 'w', n(u), n(1)));
    f.assume('in_order', 'P', 'Q', 'R', 'S', 'w');
    const p = prep(f, f.claim('concyclic', 'P', 'Q', 'R', 'S'));
    expect(p.ordered.length).toBe(1);
    expect(p.ordered[0]?.inputs.length).toBe(4);
    for (let s = 0; s < 100; s++) {
      const doc = drawSample(p, 'global', s, false);
      const phis = values(p, doc, 'stereo').map(
        ([u, v]) =>
          2 *
          Math.atan2(toNumber(v ?? u ?? { num: 0n, den: 1n }), toNumber(u ?? { num: 1n, den: 1n })),
      );
      const norm = phis.map((x) => (x < 0 ? x + 2 * Math.PI : x));
      expect([...norm].sort((a, b) => a - b)).toEqual(norm);
    }
  });

  it('images in derived layers are never sampled: only free inputs change', () => {
    const f = new Figure()
      .point('A', 1, 3)
      .point('B', 0, 0)
      .point('C', 4, 0)
      .def('t', 'reflect', c('line', 'B', 'C'))
      .derived('ref', 't');
    const p = prep(f, f.claim('collinear', 'A', 'B', 'C'));
    const doc = drawSample(p, 'global', 4, true);
    const managed = (d: Document) => d.objects.filter((o) => o.managedBy !== undefined);
    expect(managed(doc)).toEqual(managed(p.doc));
    expect(managed(doc).length).toBe(3);
    expect(exprAt(doc.objects[0]?.def ?? n(0), [0])).not.toEqual(
      exprAt(p.doc.objects[0]?.def ?? n(0), [0]),
    );
  });
});
