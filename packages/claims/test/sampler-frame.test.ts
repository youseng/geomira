import { describe, expect, it } from 'vitest';
import { toNumber } from '@geomira/num/rational';
import { prepareFigure } from '../src/figure-prep';
import { readFree } from '../src/free';
import { testClaim } from '../src/job';
import { prepare, type Prepared } from '../src/prepare';
import { drawSample } from '../src/sampler';
import type { Verdict } from '../src/verdict';
import { verdictLine } from '../src/verdict-line';
import { c, Figure, n, REGISTRY } from './helpers/build';

/**
 * Bug found in the pre-beta review (claims, item 1): the samplers' random similarity moved
 * only the free literals (point(lit, lit), glider parameters, literal radii of the figure).
 * A point with computed coordinates (C = (2, 2·sqrt(3))), a param used as a radius or an
 * angle, and a length written in a claim or an assumption stayed put while the rest was
 * scaled, rotated and translated, so TRUE theorems were reported MIXED: ∠BHC + ∠BAC = 180 in
 * the equilateral triangle with a computed apex gave "MIXED 114/86", and P on w = circle(O,
 * 5) gave "MIXED 1/199" for `on(P, circle(O, 5))`. A figure the similarity cannot map
 * entirely is now sampled without it (noise only), and without mirroring when mirroring has
 * the same problem (frame.ts); the verdict says so.
 */
function prep(f: Figure, id: number): Prepared {
  const p = prepare(f.doc, id, REGISTRY);
  if (!p.ok) throw new Error(p.reason);
  return p.prepared;
}

function run(f: Figure, id: number, regime: 'local' | 'global', seed: number): Verdict {
  const r = testClaim(
    { kind: 'testClaim', regime, doc: f.doc, claim: id, seed, n: 200 },
    { registry: REGISTRY },
  );
  if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
  return r.verdict;
}

/** The orthocenter theorem in the equilateral triangle with the computed apex C. */
function computedApex(): { f: Figure; id: number } {
  const f = new Figure()
    .point('A', 0, 0)
    .point('B', 4, 0)
    .def('C', 'point', n(2), c('mul', n(2), c('sqrt', n(3))))
    .def('H', 'orthocenter', 'A', 'B', 'C');
  return { f, id: f.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(180)) };
}

function fixedRadiusClaim(): { f: Figure; id: number } {
  const f = new Figure().point('O', 0, 0).def('w', 'circle', 'O', n(5)).def('P', 'on', 'w', n(30));
  return { f, id: f.claim('on', 'P', c('circle', 'O', n(5))) };
}

describe('the review repros: true theorems HOLD in the local test (review item 1)', () => {
  for (const seed of [1, 2, 3]) {
    it(`computed apex C = (2, 2·sqrt(3)): HOLDS, without the similarity (seed ${String(seed)})`, () => {
      const { f, id } = computedApex();
      const v = run(f, id, 'local', seed);
      expect(v.kind, v.text).toBe('holds');
      expect(v.frame).toMatchObject({ similarity: false, mirror: false });
      expect(v.text).toContain(' · no random similarity (C has the fixed coordinates ');
      expect(verdictLine(v).detail).toContain('no random similarity (C has the fixed coordinates ');
    });

    it(`on(P, circle(O, 5)) for P on circle(O, 5): HOLDS (seed ${String(seed)})`, () => {
      const { f, id } = fixedRadiusClaim();
      const v = run(f, id, 'local', seed);
      expect(v.kind, v.text).toBe('holds');
      expect(v.text).toContain('no random similarity (the claim has the fixed radius 5');
    });

    it(`a param as a radius: X on segment OA HOLDS (seed ${String(seed)})`, () => {
      const f = new Figure()
        .point('O', 0, 0)
        .point('A', 3, 0)
        .def('r', 'param', n(1), n(5), n('2.5'))
        .def('c', 'circle', 'O', 'r')
        .def('X', 'intersect', 'c', c('ray', 'O', 'A'));
      const v = run(f, f.claim('on', 'X', c('segment', 'O', 'A')), 'local', seed);
      expect(v.kind, v.text).toBe('holds');
    });

    it(`a param as an angle: X on segment AB HOLDS (seed ${String(seed)})`, () => {
      const f = new Figure()
        .point('O', 0, 0)
        .point('A', 5, 0)
        .point('B', 0, 5)
        .def('c', 'circle', 'O', 'A')
        .def('t', 'param', n(0), n(90), n(45))
        .def('P', 'on', 'c', 't')
        .def('X', 'intersect', c('line', 'O', 'P'), c('line', 'A', 'B'));
      const v = run(f, f.claim('on', 'X', c('segment', 'A', 'B')), 'local', seed);
      expect(v.kind, v.text).toBe('holds');
    });
  }

  it('without the similarity a local sample moves the free points by the noise only', () => {
    const { f, id } = computedApex();
    const p = prep(f, id);
    const A = p.free.find((x) => x.kind === 'point');
    if (A === undefined) throw new Error('no free point');
    for (let seed = 0; seed < 200; seed++) {
      const [x, y] = (readFree(drawSample(p, 'local', seed, false), A) ?? []).map(toNumber);
      // σ = 0.02 · size (size 4): ten σ is 0.8; a similarity would move A by up to the size.
      expect(Math.hypot(x ?? 99, y ?? 99)).toBeLessThan(0.8);
    }
  });

  it('global: a figure that cannot be mirrored is not mirrored, and the verdict says why', () => {
    const { f, id } = computedApex();
    const v = run(f, id, 'global', 1);
    expect(v.mirrored).toBe(0);
    expect(v.text).toContain(' · no random similarity or mirroring (C has the fixed coordinates ');
    expect(verdictLine(v).detail).toContain('no random similarity or mirroring (');
  });

  it('global: a fixed length does not stop the mirroring (an isometry keeps lengths)', () => {
    const { f, id } = fixedRadiusClaim();
    const v = run(f, id, 'global', 1);
    expect(v.kind, v.text).toBe('holds-across');
    expect(v.mirrored).toBe(100);
    expect(v.frame).toMatchObject({ similarity: false, mirror: true });
    expect(v.text).toContain(' · no random similarity (the claim has the fixed radius 5');
    expect(v.text).not.toContain('mirroring (');
  });

  it('a figure the similarity maps entirely keeps it, and its verdict has no frame note', () => {
    const f = new Figure()
      .point('A', 1, 3)
      .point('B', 0, 0)
      .point('C', 4, 0)
      .def('H', 'orthocenter', 'A', 'B', 'C');
    const id = f.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(180));
    expect(prep(f, id).frame).toEqual({ similarity: true, mirror: true });
    const v = run(f, id, 'local', 1);
    expect(v.kind).toBe('holds');
    expect(v.frame).toBeUndefined();
    expect(v.text).not.toContain('similarity');
    expect(verdictLine(v).detail).not.toContain('similarity');
  });
});

/** The frame of claim `claim` added to figure `f` (default: collinear(A, B, A)). */
function frameOf(f: Figure, claim?: (g: Figure) => number) {
  const id = claim === undefined ? f.claim('collinear', 'A', 'B', 'X') : claim(f);
  return prep(f, id).frame;
}

const base = () => new Figure().point('A', 0, 0).point('B', 4, 0).point('C', 1, 3);
const FULL = { similarity: true, mirror: true };

describe('the frame rule (frame.ts), case by case', () => {
  it('free points, literal radii and glider parameters, relative numbers: full frame', () => {
    expect(frameOf(base().def('X', 'midpoint', 'A', 'B'))).toEqual(FULL);
    expect(frameOf(base().def('w', 'circle', 'C', n(2)).def('X', 'on', 'w', n(30)))).toEqual(FULL);
    expect(frameOf(base().def('w', 'circle', 'C', 'A').def('X', 'on', 'w', n(1), n(2)))).toEqual(
      FULL,
    );
    expect(frameOf(base().def('X', 'rotate', 'B', 'A', n(-60)))).toEqual(FULL);
    expect(
      frameOf(base().def('k', 'param', n(0), n(1), n('0.5')).def('X', 'divide', 'A', 'B', 'k')),
    ).toEqual(FULL);
    expect(
      frameOf(
        base()
          .def('t', 'param', n(-1), n(1), n(0))
          .def('X', 'on', c('line', 'A', 'B'), 't'),
      ),
    ).toEqual(FULL);
    expect(
      frameOf(
        base()
          .def('k', 'param', n(1), n(3), n(2))
          .def('X', 'homothety', 'C', 'A', c('mul', 'k', c('sqrt', n(2)))),
      ),
    ).toEqual(FULL);
  });

  it('absolute positions: no similarity, no mirroring', () => {
    const f = base().def('X', 'point', n(2), c('sqrt', n(3)));
    expect(frameOf(f)).toMatchObject({ similarity: false, mirror: false });
    expect(frameOf(f).noSimilarity).toBe('X has the fixed coordinates point(2, sqrt(3))');
    const inClaim = base().def('X', 'midpoint', 'A', 'B');
    expect(
      frameOf(inClaim, (g) => g.claim('collinear', 'A', 'X', c('point', n(9), n(0)))),
    ).toMatchObject({ similarity: false, mirror: false });
  });

  it('absolute lengths: no similarity, mirroring kept', () => {
    const param = base()
      .def('r', 'param', n(1), n(5), n(2))
      .def('w', 'circle', 'A', 'r')
      .def('X', 'on', 'w', n(30));
    expect(frameOf(param)).toMatchObject({ similarity: false, mirror: true });
    // Conservative: a radius computed from the figure is not shown to scale.
    const measured = base()
      .def('w', 'circle', 'C', c('dist', 'A', 'B'))
      .def('X', 'on', 'w', n(30));
    expect(frameOf(measured)).toMatchObject({ similarity: false, mirror: true });
    const assumed = base()
      .def('X', 'midpoint', 'A', 'B')
      .assume('less', c('dist', 'A', 'B'), n(5));
    const fr = frameOf(assumed);
    expect(fr).toMatchObject({ similarity: false, mirror: true });
    expect(fr.noSimilarity).toBe('assume AB < 5 compares a length with a fixed number');
    const angle = base()
      .def('X', 'midpoint', 'A', 'B')
      .assume('less', c('angle', 'B', 'A', 'C'), n(90));
    expect(frameOf(angle)).toEqual(FULL);
  });

  it('absolute directions and figure-dependent relative numbers', () => {
    const dir = base()
      .def('t', 'param', n(0), n(90), n(45))
      .def('w', 'circle', 'C', 'A')
      .def('X', 'on', 'w', 't');
    expect(frameOf(dir)).toMatchObject({ similarity: false, mirror: false });
    const anchored = base()
      .def('t', 'param', n(0), n(2), n(1))
      .def('w', 'circle', 'C', 'A')
      .def('X', 'on', 'w', 't', n(1));
    expect(frameOf(anchored)).toMatchObject({ similarity: true, mirror: false });
    const sized = base().def('X', 'homothety', 'C', 'A', c('dist', 'A', 'B'));
    expect(frameOf(sized)).toMatchObject({ similarity: false, mirror: true });
  });

  it('only the objects the claim and the hypotheses use count', () => {
    const f = base()
      .def('Z', 'point', n(2), c('sqrt', n(3)))
      .def('X', 'midpoint', 'A', 'B');
    expect(frameOf(f)).toEqual(FULL);
  });

  it('Randomize decides the same for the whole figure (its claims included)', () => {
    const f = base().def('Z', 'point', n(2), c('sqrt', n(3)));
    const r = prepareFigure(f.doc, REGISTRY);
    if (!r.ok) throw new Error(r.reason);
    expect(r.figure.frame).toMatchObject({ similarity: false, mirror: false });
    const g = base();
    g.claim('on', 'A', c('circle', 'B', n(4)));
    const s = prepareFigure(g.doc, REGISTRY);
    if (!s.ok) throw new Error(s.reason);
    expect(s.figure.frame).toMatchObject({ similarity: false, mirror: true });
    const h = prepareFigure(base().doc, REGISTRY);
    if (!h.ok) throw new Error(h.reason);
    expect(h.figure.frame).toEqual(FULL);
  });
});
