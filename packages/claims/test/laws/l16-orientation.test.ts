/**
 * L16 (SPEC §7, §17): the orientation invariant.
 *   - Corpus: the same construction with orient(+) (or along(±) on a perp_bisector, a
 *     chiral line) is ORIENTATION-DEPENDENT globally, and with on_arc it HOLDS ACROSS; with
 *     two orient selectors of which only one matters, the verdict names that one.
 *   - Random scripts without orientation-dependent selectors (filters, near, other(P), and
 *     along(±) on ACHIRAL lines) never receive ORIENTATION-DEPENDENT.
 *   - Scripts whose only failures come from an orient choice always do.
 */
import { createRng, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { CLAIM_KINDS } from '../../src/kinds';
import { testClaim } from '../../src/job';
import type { Verdict } from '../../src/verdict';
import {
  along,
  c,
  Figure,
  n,
  near,
  onArc,
  orient,
  other,
  REGISTRY,
  sameSide,
  type Arg,
  type Sel,
} from '../helpers/build';

function globalVerdict(f: Figure, id: number, seed: number, nFigures = 100): Verdict {
  const r = testClaim(
    { kind: 'testClaim', regime: 'global', doc: f.doc, claim: id, seed, n: nFigures },
    { registry: REGISTRY },
  );
  if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
  return r.verdict;
}

/** X: apex of an equilateral triangle on BC (selector given); Y: on CA, on B's side. */
function equilateral(ax: number, ay: number, sel: Sel): Figure {
  return new Figure()
    .point('A', ax, ay)
    .point('B', 0, 0)
    .point('C', 4, 0)
    .def('X', 'intersect', c('circle', 'B', 'C'), c('circle', 'C', 'B'), sel)
    .def(
      'Y',
      'intersect',
      c('circle', 'C', 'A'),
      c('circle', 'A', 'C'),
      sameSide('B', c('line', 'C', 'A')),
    );
}

function arcMidpoint(sel: Sel): Figure {
  return new Figure()
    .point('A', 1, 3)
    .point('B', 0, 0)
    .point('C', 4, 0)
    .def('w', 'circumcircle', 'A', 'B', 'C')
    .def('X', 'intersect', c('perp_bisector', 'B', 'C'), 'w', sel);
}

describe('L16 corpus: orient(+) / along on a chiral line versus on_arc', () => {
  for (const seed of [1, 2, 3]) {
    it(`orient(+): ORIENTATION-DEPENDENT naming X's selector; on_arc: HOLDS ACROSS (seed ${String(seed)})`, () => {
      const f = equilateral(1, 3, orient(1));
      const v = globalVerdict(f, f.claim('length', 'A', 'X', 'B', 'Y', n(1)), seed);
      expect(v.kind).toBe('orientation-dependent');
      expect(v.named).toMatchObject({ object: 'X', selector: 'orient(+)' });
      expect(v.text).toMatch(
        /X's `orient\(\+\)` encodes a side; use same_side\(…\) or on_arc\(…\)/,
      );
      const g = equilateral(1, 3, onArc('B', 'C', 'A'));
      expect(globalVerdict(g, g.claim('length', 'A', 'X', 'B', 'Y', n(1)), seed).kind).toBe(
        'holds-across',
      );
    });

    it(`along(−) on perp_bisector (chiral): ORIENTATION-DEPENDENT; on_arc: HOLDS ACROSS (seed ${String(seed)})`, () => {
      const f = arcMidpoint(along(-1));
      const v = globalVerdict(f, f.claim('angle_eq', 'B', 'A', 'X', 'X', 'A', 'C'), seed);
      expect(v.kind).toBe('orientation-dependent');
      expect(v.named).toMatchObject({ object: 'X', selector: 'along(-)' });
      const g = arcMidpoint(onArc('B', 'C', 'A', true));
      expect(globalVerdict(g, g.claim('angle_eq', 'B', 'A', 'X', 'X', 'A', 'C'), seed).kind).toBe(
        'holds-across',
      );
    });

    it(`two orient selectors, only one wrong: the verdict names that one (seed ${String(seed)})`, () => {
      const f = equilateral(1, 3, orient(1)).def(
        'U',
        'intersect',
        c('circle', 'A', 'B'),
        c('circle', 'B', 'A'),
        orient(1),
      );
      const v = globalVerdict(f, f.claim('ratio', 'A', 'X', 'B', 'Y', 'U', 'A', 'U', 'B'), seed);
      expect(v.kind).toBe('orientation-dependent');
      expect(v.named).toMatchObject({ object: 'X', selector: 'orient(+)' });
    });
  }

  it('the local test of the orient(+) script holds (the current figure picks the right side)', () => {
    const f = equilateral(1, 3, orient(1));
    const id = f.claim('length', 'A', 'X', 'B', 'Y', n(1));
    const r = testClaim(
      { kind: 'testClaim', regime: 'local', doc: f.doc, claim: id, seed: 1, n: 60 },
      { registry: REGISTRY },
    );
    expect(r.kind === 'verdict' ? r.verdict.kind : r.kind).toBe('holds');
  });
});

describe('L16: scripts whose only failures come from an orient choice always get ORIENTATION-DEPENDENT', () => {
  it('on 12 random triangles of either orientation', () => {
    const rng = createRng(1616);
    for (let i = 0; i < 12; i++) {
      const [ax, ay] = [
        rng.uniform(0.5, 3.5),
        (rng.nextInt(2) === 0 ? 1 : -1) * rng.uniform(1.5, 4),
      ];
      // orient(+) picks the side of A in the current figure, whichever orientation it has.
      const f = equilateral(
        Math.round(ax * 8) / 8,
        Math.round(ay * 8) / 8,
        orient(ay > 0 ? 1 : -1),
      );
      const v = globalVerdict(f, f.claim('length', 'A', 'X', 'B', 'Y', n(1)), i, 40);
      expect(v.kind, v.text).toBe('orientation-dependent');
    }
  });
});

/** A random script whose selectors are all reflection-equivariant (SPEC §7). */
function randomScript(rng: Rng): { f: Figure; id: number } {
  const f = new Figure();
  const pts = ['A', 'B', 'C', 'D', 'E'];
  for (const p of pts)
    f.point(p, Math.round(rng.uniform(-8, 8) * 4) / 4, Math.round(rng.uniform(-8, 8) * 4) / 4);
  const pick = () => pts[rng.nextInt(pts.length)] ?? 'A';
  const steps: ((name: string) => void)[] = [
    (x) => f.def(x, 'midpoint', pick(), pick()),
    (x) => f.def(x, 'circumcenter', 'A', 'B', 'C'),
    (x) => f.def(x, 'orthocenter', 'A', 'C', 'D'),
    (x) => f.def(x, 'foot', pick(), c('line', 'A', 'E')),
    (x) => f.def(x, 'intersect', c('line', 'A', 'B'), c('line', 'C', 'D')),
    (x) => f.def(x, 'intersect', c('line', 'A', 'D'), c('circumcircle', 'A', 'B', 'C'), other('A')),
    (x) =>
      f.def(
        x,
        'intersect',
        c('line', 'B', 'E'),
        c('circle', 'C', 'D'),
        along(rng.nextInt(2) === 0 ? 1 : -1),
      ),
    (x) =>
      f.def(
        x,
        'intersect',
        c('circle', 'A', 'B'),
        c('circle', 'C', 'B'),
        sameSide('D', c('line', 'A', 'C')),
      ),
    (x) => f.def(x, 'intersect', c('circle', 'A', 'D'), c('circle', 'B', 'D'), near('E')),
    (x) => f.def(x, 'tangent_point', 'E', c('circle', 'A', 'B'), onArc('C', 'D', 'B')),
  ];
  for (let k = 0; k < 4; k++) {
    const x = `X_${String(k)}`;
    (steps[rng.nextInt(steps.length)] ?? steps[0])?.(x);
    pts.push(x);
  }
  const point = (): Arg => pick();
  const kinds = CLAIM_KINDS.filter(
    (k) =>
      k.params.every((p) => p === 'point' || p === 'number' || p === 'integer') &&
      k.rest === undefined,
  );
  const kind = kinds[rng.nextInt(kinds.length)] ?? kinds[0];
  if (kind === undefined) throw new Error('no kind');
  const args = kind.params.map((p) =>
    p === 'point'
      ? point()
      : p === 'integer'
        ? n(1)
        : n(p === 'number' && kind.name.startsWith('angle') ? 90 : 1),
  );
  return { f, id: f.claim(kind.name, ...args) };
}

describe('L16: random scripts without orientation-dependent selectors never get ORIENTATION-DEPENDENT', () => {
  it('120 random scripts (along(±) only on achiral lines, filters, near, other)', () => {
    const rng = createRng(16);
    const kinds: Record<string, number> = {};
    for (let i = 0; i < 120; i++) {
      const { f, id } = randomScript(rng);
      const v = globalVerdict(f, id, i, 20);
      kinds[v.kind] = (kinds[v.kind] ?? 0) + 1;
      expect(v.kind, v.text).not.toBe('orientation-dependent');
    }
    console.warn(`L16 random scripts: ${JSON.stringify(kinds)}`);
    expect(Object.keys(kinds).length).toBeGreaterThan(1);
  });
});
