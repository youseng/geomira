/**
 * Definitions for the model-based fuzzer (Run 4, laws L1/L7/L13): a generated Shape is
 * resolved against the CURRENT document (objects picked by static kind, so maps are built
 * from transforms and images from geometric objects), with degenerate maps on purpose:
 * reflection in a degenerate line, homothety with k = 0 (or 1e-12), rotation about an
 * Undefined centre, spirals with coincident points.
 */
import fc from 'fast-check';
import { assertNever } from '@geomira/num/assert';
import type { Document } from '../../src/document';
import type { KindTable } from '../../src/derived';
import { call, lit, ref, type Expr, type Selector } from '../../src/expr';
import { q as exact } from './doc';
import type { ValueKind } from '../../src/value';

export type Shape =
  | { readonly k: 'point'; readonly x: number; readonly y: number }
  | { readonly k: 'two'; readonly tool: string; readonly a: number; readonly b: number }
  | {
      readonly k: 'three';
      readonly tool: string;
      readonly a: number;
      readonly b: number;
      readonly c: number;
    }
  | { readonly k: 'meet'; readonly a: number; readonly b: number; readonly sel: number }
  | { readonly k: 'glider'; readonly a: number; readonly t: number }
  | { readonly k: 'map'; readonly which: number; readonly p: readonly number[]; readonly n: number }
  | { readonly k: 'image'; readonly t: number; readonly x: number; readonly sugar: boolean }
  | { readonly k: 'measure'; readonly a: number; readonly b: number };

const i = fc.nat({ max: 999 });
const p4 = fc.array(i, { minLength: 4, maxLength: 4 });

/** Coordinates: quarters in [−10, 10], sometimes a hair off a grid point. */
export const coord = fc.oneof(
  { weight: 5, arbitrary: fc.integer({ min: -40, max: 40 }).map((n) => n / 4) },
  { weight: 1, arbitrary: fc.constantFrom(0, 1e-12, -1e-9, 3e-8, 1 + 1e-12) },
);

export const shapeArb: fc.Arbitrary<Shape> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ k: fc.constant('point' as const), x: coord, y: coord }) },
  {
    weight: 3,
    arbitrary: fc.record({
      k: fc.constant('two' as const),
      tool: fc.constantFrom('midpoint', 'line', 'segment', 'ray', 'circle', 'perp_bisector'),
      a: i,
      b: i,
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      k: fc.constant('three' as const),
      tool: fc.constantFrom('circumcircle', 'orthocenter', 'polygon', 'perp', 'foot'),
      a: i,
      b: i,
      c: i,
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ k: fc.constant('meet' as const), a: i, b: i, sel: fc.nat({ max: 4 }) }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      k: fc.constant('glider' as const),
      a: i,
      t: fc.integer({ min: -8, max: 8 }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      k: fc.constant('map' as const),
      which: fc.nat({ max: 10 }),
      p: p4,
      n: fc.nat({ max: 7 }),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({ k: fc.constant('image' as const), t: i, x: i, sugar: fc.boolean() }),
  },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('measure' as const), a: i, b: i }) },
);

/** An exact literal (from a double, exactly, or from "2/3" text). */
function q(x: number | string): Expr {
  return lit(exact(x));
}

const POINT: readonly ValueKind[] = ['point'];
const CURVE: readonly ValueKind[] = ['line', 'circle'];
const MAP: readonly ValueKind[] = ['transform'];
const IMAGED: readonly ValueKind[] = ['point', 'line', 'circle', 'polygon'];

/** Picks objects by static kind; falls back to a literal when there is none. */
export class Picker {
  constructor(
    private readonly doc: Document,
    private readonly kinds: KindTable,
  ) {}

  private pick(want: readonly ValueKind[], n: number): Expr | undefined {
    const ok = this.doc.objects.filter((o) => {
      const k = this.kinds.get(o.id);
      return k !== undefined && k.some((x) => want.includes(x));
    });
    const o = ok[n % Math.max(1, ok.length)];
    return o === undefined ? undefined : ref(o.id);
  }

  point(n: number): Expr {
    return this.pick(POINT, n) ?? call('point', [q((n % 9) - 4), q((n % 7) - 3)]);
  }

  curve(n: number): Expr {
    return this.pick(CURVE, n) ?? call('line', [this.point(n), this.point(n + 1)]);
  }

  map(n: number): Expr {
    return this.pick(MAP, n) ?? call('reflect', [this.point(n)]);
  }

  imaged(n: number): Expr {
    return this.pick(IMAGED, n) ?? this.point(n);
  }
}

const ANGLES = [90, 180, -90, 0, 360, 30, 45, 60];
const RATIOS: readonly (string | number)[] = ['2', '1/2', '-1', '-3/2', '0', '1', '3', 1e-12];

function ratio(n: number): Expr {
  return q(RATIOS[n % RATIOS.length] ?? '2');
}

/** A map from points of the document (degenerate ones included, see the module doc). */
function mapDef(pk: Picker, s: Extract<Shape, { k: 'map' }>): Expr {
  const [a = 0, b = 1, c = 2, d = 3] = s.p;
  const P = (n: number) => pk.point(n);
  switch (s.which) {
    case 0:
      return call('reflect', [call('line', [P(a), P(b)])]);
    case 1:
      return call('reflect', [P(a)]);
    case 2:
      return call('rotate', [P(a), q(ANGLES[s.n % ANGLES.length] ?? 90)]);
    case 3:
      return call('homothety', [P(a), ratio(s.n)]);
    case 4:
      return call('translate', [P(a), P(b)]);
    case 5:
      return call('spiral', [P(a), P(b), P(c), P(d)]);
    case 6:
      return call('compose', [pk.map(a), pk.map(b)]);
    case 7:
      return call('inverse', [pk.map(a)]);
    case 8: // reflection in a degenerate line
      return call('reflect', [call('line', [P(a), P(a)])]);
    case 9: // rotation about an Undefined centre (two parallel lines)
      return call('rotate', [
        call('intersect', [
          call('line', [P(a), P(b)]),
          call('parallel', [P(c), call('line', [P(a), P(b)])]),
        ]),
        q(90),
      ]);
    default:
      return call('spiral', [P(a), P(a), P(c), P(d)]);
  }
}

const SUGAR = ['reflect', 'rotate', 'homothety', 'translate'];

/** The Expr of a shape in the current document. */
export function resolve(doc: Document, kinds: KindTable, s: Shape): Expr {
  const pk = new Picker(doc, kinds);
  switch (s.k) {
    case 'point':
      return call('point', [q(s.x), q(s.y)]);
    case 'two':
      return call(s.tool, [pk.point(s.a), pk.point(s.b)]);
    case 'three':
      return s.tool === 'perp' || s.tool === 'foot'
        ? call(s.tool, [pk.point(s.a), pk.curve(s.b)])
        : call(s.tool, [pk.point(s.a), pk.point(s.b), pk.point(s.c)]);
    case 'meet': {
      const sels: Selector[][] = [
        [],
        [{ kind: 'along', sign: 1 }],
        [{ kind: 'orient', sign: -1 }],
        [{ kind: 'near', p: pk.point(s.a) }],
        [{ kind: 'other', p: pk.point(s.b) }],
      ];
      return call('intersect', [pk.curve(s.a), pk.curve(s.b)], sels[s.sel] ?? []);
    }
    case 'glider':
      return call('on', [pk.curve(s.a), q(s.t / 4)]);
    case 'map':
      return mapDef(pk, s);
    case 'image': {
      if (!s.sugar) return call('apply', [pk.map(s.t), pk.imaged(s.x)]);
      const tool = SUGAR[s.t % SUGAR.length] ?? 'reflect';
      const X = pk.imaged(s.x);
      if (tool === 'reflect') return call('reflect', [X, pk.curve(s.t)]);
      if (tool === 'rotate') return call('rotate', [X, pk.point(s.t), q(90)]);
      if (tool === 'homothety') return call('homothety', [X, pk.point(s.t), ratio(s.t)]);
      return call('translate', [X, pk.point(s.t), pk.point(s.t + 1)]);
    }
    case 'measure':
      return call('dist', [pk.point(s.a), pk.point(s.b)]);
    default:
      return assertNever(s, 'shape');
  }
}
