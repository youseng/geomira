/**
 * The v1 claim kinds' symmetries and finder hints (ADR-0035), as data attached to the kinds
 * (kinds.ts builds CLAIM_KINDS through `withHints`). A symmetry generator is a permutation of
 * the argument positions that gives the same claim; a measure lets the finder pair argument
 * groups by sorting a float measure. Tests check every generator against the claims' own
 * evaluation and every measure against the claim's residual (kind-hints.test.ts).
 */
import { rational, type Rational } from '@geomira/num/rational';
import type { Vec } from '@geomira/kernel/value';
import type { ClaimKindSpec, ClaimSymmetry, FinderHints, MeasureHint } from './kind';

type V = Vec<number>;

function is(lits: readonly Rational[], i: number, n: bigint): boolean {
  const x = lits[i];
  return x !== undefined && x.num === n && x.den === 1n;
}

/** Adjacent transpositions of positions 0..n − 1: every order of n arguments. */
function anyOrder(n: number): ClaimSymmetry[] {
  return Array.from({ length: n - 1 }, (_, i) => ({
    perm: Array.from({ length: n }, (_, j) => (j === i ? i + 1 : j === i + 1 ? i : j)),
  }));
}

function dist(p: V, q: V): number | undefined {
  const d = Math.hypot(p.x - q.x, p.y - q.y);
  return Number.isFinite(d) ? d : undefined;
}

/** ∡ABC (from line BA to line BC) in [0, π), or undefined for a coincident arm. */
function directed(a: V, b: V, c: V): number | undefined {
  const [ux, uy, vx, vy] = [a.x - b.x, a.y - b.y, c.x - b.x, c.y - b.y];
  if ((ux === 0 && uy === 0) || (vx === 0 && vy === 0)) return undefined;
  const t = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const m = t < 0 ? t + Math.PI : t;
  return Number.isFinite(m) && m < Math.PI ? m : 0;
}

/** ∠ABC in [0, π], or undefined for a coincident arm. */
function undirected(a: V, b: V, c: V): number | undefined {
  const [ux, uy, vx, vy] = [a.x - b.x, a.y - b.y, c.x - b.x, c.y - b.y];
  if ((ux === 0 && uy === 0) || (vx === 0 && vy === 0)) return undefined;
  const t = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
  return Number.isFinite(t) ? t : undefined;
}

function three(f: (a: V, b: V, c: V) => number | undefined) {
  return (pts: readonly V[]): number | undefined => {
    const [a, b, c] = pts;
    return a === undefined || b === undefined || c === undefined ? undefined : f(a, b, c);
  };
}

const deg = (x: Rational | undefined): number =>
  x === undefined ? NaN : ((Number(x.num) / Number(x.den)) * Math.PI) / 180;

const LENGTH: MeasureHint = {
  groups: [
    [0, 1],
    [2, 3],
  ],
  measure: (pts) => {
    const [p, q] = pts;
    return p === undefined || q === undefined ? undefined : dist(p, q);
  },
  target: (m, lits) => {
    const k = lits[0];
    return k === undefined ? NaN : (m * Number(k.num)) / Number(k.den);
  },
  unit: 'length',
  trivialAt: [0],
  groupSymmetry: [[1, 0]],
};

const angleGroups: readonly [readonly number[], readonly number[]] = [
  [0, 1, 2],
  [3, 4, 5],
];

/** The v1 kinds' data, by kind name. */
const HINTS: Readonly<Record<string, Pick<ClaimKindSpec, 'symmetry' | 'finder'>>> = {
  collinear: { symmetry: anyOrder(3), finder: { arity: 3 } },
  concyclic: { symmetry: anyOrder(4), finder: { arity: 4 } },
  concurrent: { symmetry: anyOrder(3), finder: { arity: 3 } },
  parallel: { symmetry: anyOrder(2), finder: {} },
  perpendicular: { symmetry: anyOrder(2), finder: {} },
  equal: { symmetry: anyOrder(2), finder: {} },
  on: { symmetry: [], finder: {} },
  tangent: { symmetry: anyOrder(2), finder: {} },
  length: {
    symmetry: [
      { perm: [1, 0, 2, 3, 4] },
      { perm: [0, 1, 3, 2, 4] },
      { perm: [2, 3, 0, 1, 4], when: (lits) => is(lits, 0, 1n) },
    ],
    finder: {
      literals: [[rational(1n)], [rational(2n)]],
      measure: LENGTH,
    },
  },
  ratio: {
    symmetry: [
      { perm: [4, 5, 6, 7, 0, 1, 2, 3] },
      { perm: [1, 0, 2, 3, 4, 5, 6, 7] },
      { perm: [0, 1, 3, 2, 4, 5, 6, 7] },
      { perm: [0, 1, 2, 3, 5, 4, 6, 7] },
      { perm: [0, 1, 2, 3, 4, 5, 7, 6] },
    ],
    finder: { notSearched: 'eight points: too many tuples to search in v1' },
  },
  ratio_value: {
    symmetry: [{ perm: [1, 0, 2, 3, 4] }, { perm: [0, 1, 3, 2, 4] }],
    finder: { notSearched: 'the same facts as length (AB = k·CD)' },
  },
  dangle: {
    symmetry: [
      { perm: [0, 3, 2, 1, 6, 5, 4] },
      { perm: [0, 4, 5, 6, 1, 2, 3], when: (lits) => is(lits, 0, 1n) },
    ],
    finder: {
      literals: [[rational(1n)]],
      measure: {
        groups: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        measure: three(directed),
        // n = 1, the only literal searched: ∡ABC = ∡DEF (mod π).
        target: (m) => m,
        unit: 'angle',
        period: Math.PI,
        trivialAt: [0, Math.PI],
      },
    },
  },
  dangle_lines: {
    symmetry: [],
    finder: { literals: [30n, 45n, 60n, 120n, 135n, 150n].map((d) => [rational(d)]) },
  },
  angle_eq: {
    symmetry: [
      { perm: [2, 1, 0, 3, 4, 5] },
      { perm: [0, 1, 2, 5, 4, 3] },
      { perm: [3, 4, 5, 0, 1, 2] },
    ],
    finder: {
      measure: {
        groups: angleGroups,
        measure: three(undirected),
        target: (m) => m,
        unit: 'angle',
        trivialAt: [0, Math.PI],
        groupSymmetry: [[2, 1, 0]],
      },
    },
  },
  angle_sum: {
    symmetry: [
      { perm: [2, 1, 0, 3, 4, 5, 6] },
      { perm: [0, 1, 2, 5, 4, 3, 6] },
      { perm: [3, 4, 5, 0, 1, 2, 6] },
    ],
    finder: {
      literals: [[rational(90n)], [rational(180n)]],
      measure: {
        groups: angleGroups,
        measure: three(undirected),
        target: (m, lits) => deg(lits[0]) - m,
        unit: 'angle',
        trivialAt: [0, Math.PI],
        groupSymmetry: [[2, 1, 0]],
      },
    },
  },
  angle_diff: {
    symmetry: [{ perm: [2, 1, 0, 3, 4, 5, 6] }, { perm: [0, 1, 2, 5, 4, 3, 6] }],
    finder: {
      literals: [[rational(90n)]],
      measure: {
        groups: angleGroups,
        measure: three(undirected),
        target: (m, lits) => deg(lits[0]) + m,
        unit: 'angle',
        trivialAt: [0, Math.PI],
        groupSymmetry: [[2, 1, 0]],
      },
    },
  },
};

/** The names the hints table covers (a test checks it against the kinds). */
export const HINTED_KINDS: readonly string[] = Object.freeze(Object.keys(HINTS));

/** The kind with its symmetries and finder hints attached (unchanged when the table has none). */
export function withHints(spec: ClaimKindSpec): ClaimKindSpec {
  const h = HINTS[spec.name];
  return h === undefined ? spec : { ...spec, ...h };
}

/** For tests: a hint's finder data, or undefined. */
export function hintsOf(name: string): FinderHints | undefined {
  return HINTS[name]?.finder;
}
