/**
 * ADR-0051: the new kinds through the tester (L12's style): true theorems HOLD in the local test
 * with zero flakes, on the exact rung; false claims are FALSE or MIXED; degenerate claims are
 * never true or false. L17: length_sum (not a polynomial kind) never uses the mod-p rung, even
 * with an exact budget so small that every eligible sample falls through to it.
 */
import { webcrypto } from 'node:crypto';
import { cryptoSource } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { testClaim } from '../../src/job';
import { prepare } from '../../src/prepare';
import { c, n, other, REGISTRY } from '../helpers/build';
import { baseFigure, type Entry } from '../helpers/corpus';
import { currentValue, expectHolds, localVerdict } from '../helpers/l12';
import { lawCount } from '../helpers/laws';

const Q = 'exact over Q' as const;
const SEEDS = Array.from({ length: lawCount(10) }, (_, i) => i + 1);

const foot = (p: string, a: string, b: string) => c('foot', p, c('line', a, b));
const mirror = (p: string) => c('reflect', p, c('line', 'D', 'E'));

const TRUE: readonly Entry[] = [
  {
    name: 'the medial triangle is directly similar to ABC (homothety −1/2 at G)',
    rung: Q,
    build: (f) => f.claim('similar_direct', 'A', 'B', 'C', 'M_a', 'M_b', 'M_c'),
  },
  {
    name: 'the medial triangle is similar to ABC',
    rung: Q,
    build: (f) => f.claim('similar', 'A', 'B', 'C', 'M_a', 'M_b', 'M_c'),
  },
  {
    name: 'AEF ∼ ABC oppositely (E, F feet of the altitudes from B, C)',
    rung: Q,
    build: (f) =>
      f.claim('similar_opposite', 'A', foot('B', 'C', 'A'), foot('C', 'A', 'B'), 'A', 'B', 'C'),
  },
  {
    name: 'the triangles of the medial subdivision are directly congruent (AM_cM_b, M_cBM_a)',
    rung: Q,
    build: (f) => f.claim('congruent_direct', 'A', 'M_c', 'M_b', 'M_c', 'B', 'M_a'),
  },
  {
    name: 'a mirror image is oppositely congruent',
    rung: Q,
    build: (f) =>
      f.claim('congruent_opposite', 'A', 'B', 'C', mirror('A'), mirror('B'), mirror('C')),
  },
  {
    name: 'a mirror image is congruent',
    rung: Q,
    build: (f) => f.claim('congruent', 'A', 'B', 'C', mirror('A'), mirror('B'), mirror('C')),
  },
  {
    name: 'the power of D: DA·DX = DB·DY on two secants of ω',
    rung: Q,
    build: (f) => {
      f.def('X', 'intersect', c('line', 'D', 'A'), 'w', other('A'));
      f.def('Y', 'intersect', c('line', 'D', 'B'), 'w', other('B'));
      return f.claim('length_product', 'D', 'A', 'D', 'X', 'D', 'B', 'D', 'Y');
    },
  },
  {
    name: 'AP + PB = AB for P on the segment AB',
    rung: Q,
    build: (f) => {
      f.add('P', c('on', c('line', 'A', 'B'), n('1/3')));
      return f.claim('length_sum', 'A', 'P', 'P', 'B', 'A', 'B');
    },
  },
];

const FALSE: readonly Entry[] = [
  {
    name: 'ABC and DEF are not similar',
    build: (f) => f.claim('similar', 'A', 'B', 'C', 'D', 'E', 'F'),
  },
  {
    name: 'AEF is not directly similar to ABC',
    build: (f) =>
      f.claim('similar_direct', 'A', foot('B', 'C', 'A'), foot('C', 'A', 'B'), 'A', 'B', 'C'),
  },
  {
    name: 'the medial triangle is not congruent to ABC',
    build: (f) => f.claim('congruent', 'A', 'B', 'C', 'M_a', 'M_b', 'M_c'),
  },
  {
    name: 'a mirror image is not directly congruent',
    build: (f) => f.claim('congruent_direct', 'A', 'B', 'C', mirror('A'), mirror('B'), mirror('C')),
  },
  {
    name: 'DA·DB = DC·DE is false',
    build: (f) => f.claim('length_product', 'D', 'A', 'D', 'B', 'D', 'C', 'D', 'E'),
  },
  {
    name: 'AB + BC = AC is false in a triangle',
    build: (f) => f.claim('length_sum', 'A', 'B', 'B', 'C', 'A', 'C'),
  },
];

const DEGENERATE: readonly Entry[] = [
  {
    name: 'a flat triangle (A, B, M_c) is never similar or not',
    build: (f) => f.claim('similar', 'A', 'B', 'M_c', 'D', 'E', 'F'),
  },
  {
    name: 'a flat second triangle is never congruent or not',
    build: (f) => f.claim('congruent_opposite', 'D', 'E', 'F', 'B', 'M_a', 'C'),
  },
  {
    name: 'a null segment in a product',
    build: (f) => f.claim('length_product', 'A', 'A', 'B', 'C', 'D', 'E', 'F', 'G'),
  },
  {
    name: 'a null segment in a sum',
    build: (f) => f.claim('length_sum', 'A', 'B', 'C', 'C', 'A', 'B'),
  },
];

describe('ADR-0051 kinds: true theorems HOLD (local, exact over Q, zero flakes)', () => {
  for (const e of TRUE)
    it(e.name, () => {
      expectHolds(e, SEEDS);
    });
});

describe('ADR-0051 kinds: false claims are FALSE or MIXED', () => {
  for (const e of FALSE)
    it(e.name, () => {
      for (const seed of SEEDS.slice(0, 5)) {
        const v = localVerdict(e, seed);
        expect(['false', 'mixed'], `${e.name}, seed ${String(seed)}: ${v.text}`).toContain(v.kind);
      }
      expect(currentValue(e).value).toBe('false');
    });
});

describe('ADR-0051 kinds: degenerate claims are never true or false', () => {
  for (const e of DEGENERATE)
    it(e.name, () => {
      expect(currentValue(e).value).toBe('undefined');
      for (const seed of [1, 2, 3]) {
        const v = localVerdict(e, seed);
        expect(v.kind).toBe('inconclusive');
        expect([v.tally.true, v.tally.false]).toEqual([0, 0]);
      }
    });
});

describe('L17: length_sum never uses the mod-p rung', () => {
  const ENTROPY = cryptoSource((b) => webcrypto.getRandomValues(b));

  it('it is excluded statically, and a tiny exact budget falls through to numeric only', () => {
    const f = baseFigure();
    f.add('P', c('on', c('line', 'A', 'B'), n('1/3')));
    const id = f.claim('length_sum', 'A', 'P', 'P', 'B', 'A', 'B');
    const p = prepare(f.doc, id, REGISTRY);
    if (!p.ok) throw new Error(p.reason);
    expect(p.prepared.analysis.modpExclusions.join(' ')).toContain('length_sum');
    const r = testClaim(
      { kind: 'testClaim', regime: 'local', doc: f.doc, claim: id, seed: 3, n: 12 },
      { registry: REGISTRY, entropy: ENTROPY, budgetBits: 8 },
    );
    if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
    expect(r.verdict.kind).toBe('holds');
    expect(Object.keys(r.verdict.rungs)).toEqual(['numeric']);
  });

  it('length_product is eligible: with the same budget it uses the mod-p rung', () => {
    const f = baseFigure();
    f.def('X', 'intersect', c('line', 'D', 'A'), 'w', other('A'));
    f.def('Y', 'intersect', c('line', 'D', 'B'), 'w', other('B'));
    const id = f.claim('length_product', 'D', 'A', 'D', 'X', 'D', 'B', 'D', 'Y');
    const r = testClaim(
      { kind: 'testClaim', regime: 'local', doc: f.doc, claim: id, seed: 3, n: 12 },
      { registry: REGISTRY, entropy: ENTROPY, budgetBits: 8 },
    );
    if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
    expect(r.verdict.kind).toBe('holds');
    expect(Object.keys(r.verdict.rungs)).toEqual(['exact mod p']);
  });
});
