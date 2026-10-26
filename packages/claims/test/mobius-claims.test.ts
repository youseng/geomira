/**
 * Claims through inversions (Run 14, ADR-0032): images are plain apply(T, X) objects, so the
 * evaluation, both test regimes and the exact rungs work in an inverted layer without anything
 * new. Two things are new: an inversion's literal power is an absolute size the random
 * similarity would change (decision 14: no similarity then, mirroring kept), and `on` honours
 * the two rays `outside` (decision 8), as do the samplers' line gliders.
 */
import { toNumber } from '@geomira/num/rational';
import { describe, expect, it } from 'vitest';
import { evalClaim } from '../src/eval-claim';
import { readFree } from '../src/free';
import { testClaim } from '../src/job';
import { prepare, type Prepared } from '../src/prepare';
import { drawSample } from '../src/sampler';
import type { Verdict } from '../src/verdict';
import { c, Figure, n, REGISTRY } from './helpers/build';

function run(f: Figure, id: number, regime: 'local' | 'global', seed: number): Verdict {
  const r = testClaim(
    { kind: 'testClaim', regime, doc: f.doc, claim: id, seed, n: 100 },
    { registry: REGISTRY },
  );
  if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
  return r.verdict;
}

function prep(f: Figure, id: number): Prepared {
  const p = prepare(f.doc, id, REGISTRY);
  if (!p.ok) throw new Error(p.reason);
  return p.prepared;
}

/** A triangle and an inversion layer `inv` (f is the map, named in the text). */
function triangle(map: (f: Figure) => Figure): Figure {
  return map(new Figure().point('A', 1, 3).point('B', 0, 0).point('C', 4, 0)).derived('inv', 'f');
}

describe('claims in an inverted layer, both regimes', () => {
  it('the √(bc) map: B* = C and C* = B hold locally and globally; B* = B is false', () => {
    const f = triangle((g) => g.def('f', 'sqrt_bc', 'A', 'B', 'C'));
    for (const holds of [f.claim('equal', 'B*', 'C'), f.claim('equal', 'C*', 'B')])
      for (const regime of ['local', 'global'] as const) {
        const v = run(f, holds, regime, 3);
        expect(v.kind, v.text).toBe(regime === 'local' ? 'holds' : 'holds-across');
      }
    expect(run(f, f.claim('equal', 'B*', 'B'), 'local', 3).kind).toBe('false');
  });

  it('the orthocenter inversion: A* lies on line BC, exact over Q in both regimes', () => {
    const f = triangle((g) => g.def('f', 'orthocenter_inversion', 'A', 'B', 'C'));
    const id = f.claim('on', 'A*', c('line', 'B', 'C'));
    expect(evalClaim(f.doc, id, REGISTRY)).toMatchObject({ value: 'true' });
    for (const regime of ['local', 'global'] as const) {
      const v = run(f, id, regime, 5);
      expect(v.text).toMatch(/exact over Q/);
      expect(['holds', 'holds-across']).toContain(v.kind);
    }
  });
});

describe('the samplers and an inversion power (decision 14)', () => {
  it('inversion(O, 4): no random similarity (a fixed size), mirroring kept; the claim holds', () => {
    const f = new Figure()
      .point('O', 0, 0)
      .point('B', 1, 2)
      .def('f', 'inversion', 'O', n(4))
      .derived('inv', 'f');
    const id = f.claim('collinear', 'O', 'B', 'B*');
    expect(prep(f, id).frame).toMatchObject({ similarity: false, mirror: true });
    const v = run(f, id, 'local', 1);
    expect(v.kind, v.text).toBe('holds');
    expect(v.text).toContain('has the fixed size 4 (a length or an area) in inversion(O, 4)');
    // A claim that depends on the power stays true: |OB|·|OB*| = 4 is not scaled away.
    const g = new Figure()
      .point('O', 0, 0)
      .point('B', 1, 2)
      .def('f', 'inversion', 'O', n(4))
      .derived('inv', 'f')
      .def('k', 'mul', c('dist', 'O', 'B'), c('dist', 'O', 'B*'));
    const pid = g.claim('on', 'B*', c('circle', 'O', c('div', n(4), c('dist', 'O', 'B'))));
    expect(run(g, pid, 'local', 2).kind).toBe('holds');
  });

  it('inversion(c) of a circle of the figure: the full frame', () => {
    const f = new Figure()
      .point('O', 0, 0)
      .point('A', 3, 1)
      .point('B', 1, 2)
      .def('f', 'inversion', c('circle', 'O', 'A'))
      .derived('inv', 'f');
    const id = f.claim('collinear', 'O', 'B', 'B*');
    expect(prep(f, id).frame).toMatchObject({ similarity: true, mirror: true });
  });
});

/** R: the image of segment((−1, 0), (2, 0)) under inversion(O, 4), the rays x ≤ −4 and x ≥ 2. */
function rays(): Figure {
  return new Figure()
    .point('O', 0, 0)
    .point('D', -1, 0)
    .point('E', 2, 0)
    .def('R', 'apply', c('inversion', 'O', n(4)), c('segment', 'D', 'E'));
}

describe('the two rays outside in claims (decision 8)', () => {
  it('on(P, R) is true on a ray and false in the gap', () => {
    const f = rays().point('P', 5, 0).point('Q', 1, 0).point('S', -6, 0);
    const [p, sr, qr] = [f.claim('on', 'P', 'R'), f.claim('on', 'S', 'R'), f.claim('on', 'Q', 'R')];
    expect(evalClaim(f.doc, p, REGISTRY)).toMatchObject({ value: 'true' });
    expect(evalClaim(f.doc, sr, REGISTRY)).toMatchObject({ value: 'true' });
    expect(evalClaim(f.doc, qr, REGISTRY)).toMatchObject({ value: 'false' });
  });

  it('a glider on R is drawn on the rays in the global regime, never in the gap', () => {
    // R = p + t·(12, 0), t ≤ −1/3 or t ≥ 1/6.
    const f = rays().def('X', 'on', 'R', n(1));
    const id = f.claim('on', 'X', 'R');
    const p = prep(f, id);
    const X = p.free.find((x) => x.kind === 'line-glider');
    if (X === undefined) throw new Error('no glider');
    let [below, above] = [0, 0];
    for (let seed = 0; seed < 200; seed++) {
      const [t = 0] = (readFree(drawSample(p, 'global', seed, false), X) ?? []).map(toNumber);
      expect(t <= -1 / 3 || t >= 1 / 6, `seed ${String(seed)}: t = ${String(t)}`).toBe(true);
      if (t < 0) below += 1;
      else above += 1;
    }
    expect(Math.min(below, above)).toBeGreaterThan(50);
    expect(run(f, id, 'global', 4).kind).toBe('holds-across');
  });
});
