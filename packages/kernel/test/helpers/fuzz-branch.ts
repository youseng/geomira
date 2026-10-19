/**
 * Seeded random documents aimed at branch selection (law L1 for Run 3b): the branchable
 * calls (intersect of curves, tangent_point, tangent_from) on EXACTLY and NEARLY tangent
 * configurations (a tangent and its parallels at relative offsets from ±1e-17 to beyond
 * the band; circles centred on line OP through P, exactly and nearly tangent there;
 * P on, nearly on and inside c, P = O), concentric and equal circles, coincident points,
 * segments and rays, with random selectors whose references are random, degenerate (Q on
 * l, B = C, A = B), of the wrong kind or Undefined; misused selectors (along on circles,
 * orient on lines, other on two lines, other twice), bare indices, selectors on tools that
 * take none, and huge literals.
 */
import { add, fromNumber, rational, type Rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { emptyDocument, type Document } from '../../src/document';
import { addObject } from '../../src/edit';
import { call, lit, ref, type Expr, type Selector } from '../../src/expr';
import type { Registry } from '../../src/registry';
import type { ValueKind } from '../../src/value';

const OFFSETS = [
  0, 1e-17, -1e-17, 1e-15, -1e-12, 1e-10, -1e-9, 3e-9, -1e-8, 5e-8, -1e-7, 3e-7, -1e-6, 1e-3,
];

function pick<X>(rng: Rng, xs: readonly X[]): X {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('pick from an empty list');
  return x;
}

interface Entry {
  readonly expr: Expr;
  readonly kind: ValueKind;
}

export class BranchFuzzer {
  doc: Document = emptyDocument();
  readonly pool: Entry[] = [];
  private count = 0;

  constructor(
    private readonly rng: Rng,
    private readonly registry: Registry,
  ) {}

  add(kind: ValueKind, def: Expr): Expr {
    this.count += 1;
    const name = `${kind === 'point' ? 'P' : 'z'}${String(this.count)}`;
    const r = addObject(this.doc, { name, def });
    if (!r.ok) throw new Error(r.error);
    this.doc = r.doc;
    const e = ref(r.id);
    this.pool.push({ expr: e, kind });
    return e;
  }

  private coord(): Rational {
    return this.rng.nextFloat() < 0.6
      ? rational(BigInt(this.rng.nextInt(2049) - 1024), 64n)
      : fromNumber(this.rng.uniform(-20, 20));
  }

  freePoint(): Expr {
    return this.add('point', call('point', [lit(this.coord()), lit(this.coord())]));
  }

  num(x: number | Rational): Expr {
    return lit(typeof x === 'number' ? fromNumber(x) : x);
  }

  of(kind: ValueKind): Expr {
    if (kind === 'number') return this.num(pick(this.rng, [0, 1, 2, -1, 1e-9]));
    const ok = this.pool.filter((e) => e.kind === kind);
    if (ok.length > 0 && this.rng.nextFloat() < 0.8) return pick(this.rng, ok).expr;
    if (kind === 'line')
      return this.add(
        'line',
        call(pick(this.rng, ['line', 'segment', 'ray']), [this.of('point'), this.of('point')]),
      );
    if (kind === 'circle')
      return this.add('circle', call('circle', [this.of('point'), this.of('point')]));
    return this.freePoint();
  }

  /** Any pool entry (wrong kinds included) or a fresh literal. */
  anything(): Expr {
    return this.rng.nextFloat() < 0.1
      ? this.num(pick(this.rng, [0, 1, 1e200]))
      : pick(this.rng, this.pool).expr;
  }

  /** A point of kind `want` most of the time; sometimes anything (wrong kinds, Undefined). */
  arg(want: ValueKind): Expr {
    return this.rng.nextFloat() < 0.08 ? this.anything() : this.of(want);
  }

  selector(): Selector {
    const k = this.rng.nextInt(14);
    const sign = this.rng.nextFloat() < 0.5 ? 1 : -1;
    switch (k) {
      case 0:
      case 1: {
        const l = this.arg('line');
        // Degenerate reference: Q on l (its foot) a third of the time.
        const q =
          this.rng.nextFloat() < 0.3 ? call('foot', [this.of('point'), l]) : this.arg('point');
        return { kind: k === 0 ? 'same_side' : 'opposite_side', q, l };
      }
      case 2: {
        const b = this.arg('point');
        return {
          kind: 'on_arc',
          b,
          c: this.rng.nextFloat() < 0.2 ? b : this.arg('point'),
          a: this.arg('point'),
          not: sign === 1,
        };
      }
      case 3: {
        const a = this.arg('point');
        return { kind: 'between', a, b: this.rng.nextFloat() < 0.2 ? a : this.arg('point') };
      }
      case 4:
        return { kind: 'inside', c: this.arg('circle') };
      case 5:
        return { kind: 'outside', c: this.arg('circle') };
      case 6:
      case 7:
        return { kind: 'other', p: this.arg('point') };
      case 8:
        return { kind: 'near', p: this.arg('point') };
      case 9:
        return { kind: 'far_from', p: this.arg('point') };
      case 10:
      case 11:
        return { kind: 'along', sign };
      default:
        return { kind: 'orient', sign };
    }
  }

  selectors(): Selector[] {
    const n = pick(this.rng, [0, 1, 1, 1, 2, 2, 3]);
    return Array.from({ length: n }, () => this.selector());
  }

  /** A glider on circle c (exactly on it), or one of c's defining points. */
  onCircle(c: Expr): Expr {
    return this.add(
      'point',
      call('on', [c, this.num(this.rng.nextInt(9) - 4), this.num(this.rng.nextInt(5) + 1)]),
    );
  }

  /** A point on ray OP at relative distance 1 + δ (δ an offset): exactly or nearly on c. */
  nearly(O: Expr, P: Expr): Expr {
    return this.add(
      'point',
      call('divide', [O, P, this.num(add(rational(1n), fromNumber(pick(this.rng, OFFSETS))))]),
    );
  }

  branch(tool: string, args: Expr[]): void {
    const sels = this.selectors();
    const out = tool === 'intersect' ? 'point' : tool === 'tangent_point' ? 'point' : 'line';
    this.add(out, call(tool, args, sels));
  }

  tangentLine(): void {
    const c = this.of('circle');
    const O = this.add('point', call('center', [c]));
    const P = this.onCircle(c);
    const t = this.add('line', call('tangent', [P, c]));
    this.branch('intersect', this.rng.nextFloat() < 0.5 ? [t, c] : [c, t]);
    // A parallel through a point at relative distance 1 + δ from O: nearly tangent.
    const m = this.add('line', call('parallel', [this.nearly(O, P), t]));
    this.branch('intersect', [m, c]);
  }

  tangentCircles(): void {
    const c = this.of('circle');
    const O = this.add('point', call('center', [c]));
    const P = this.onCircle(c);
    const k = this.num(pick(this.rng, [-2, -1, rational(1n, 2n), rational(1n, 3n), 2, 3]));
    const O2 = this.add('point', call('divide', [O, P, k]));
    const through = this.rng.nextFloat() < 0.5 ? P : this.nearly(O, P);
    const c2 = this.add('circle', call('circle', [O2, through]));
    this.branch('intersect', [c, c2]);
  }

  concentric(): void {
    const c = this.of('circle');
    const O = this.add('point', call('center', [c]));
    const c2 =
      this.rng.nextFloat() < 0.5 ? c : this.add('circle', call('circle', [O, this.of('point')]));
    this.branch('intersect', [c, c2]);
  }

  tangents(): void {
    const c = this.of('circle');
    const O = this.add('point', call('center', [c]));
    const P = pick(this.rng, [
      () => this.onCircle(c),
      () => O,
      () => this.nearly(O, this.onCircle(c)),
      () => this.of('point'),
    ])();
    this.branch(pick(this.rng, ['tangent_point', 'tangent_from']), [P, c]);
  }

  secant(): void {
    const kinds = pick(this.rng, [
      ['line', 'circle'],
      ['circle', 'line'],
      ['circle', 'circle'],
      ['line', 'line'],
    ] as const);
    this.branch(
      'intersect',
      kinds.map((k) => this.arg(k)),
    );
  }

  /** other(P) with P exactly or nearly on both curves. */
  otherOnBoth(): void {
    const c = this.of('circle');
    const P = this.onCircle(c);
    const l = this.add(
      'line',
      call(pick(this.rng, ['line', 'segment', 'ray']), [P, this.of('point')]),
    );
    const O = this.add('point', call('center', [c]));
    const Q = this.rng.nextFloat() < 0.6 ? P : this.nearly(O, P);
    this.add('point', call('intersect', [l, c], [{ kind: 'other', p: Q }, ...this.selectors()]));
  }

  /** Bare indices and selectors on tools that take none. */
  misuse(): void {
    if (this.rng.nextFloat() < 0.5) {
      this.add(
        'point',
        call(pick(this.rng, ['intersect', 'tangent_point']), [
          this.of('point'),
          this.of('circle'),
          this.num(pick(this.rng, [1, 2])),
        ]),
      );
      this.add('point', call('intersect', [this.of('line'), this.of('circle'), this.num(2)]));
    } else {
      const tool = pick(this.rng, this.registry.tools);
      const args = (tool.signatures[0]?.params ?? []).map((cap) =>
        this.arg(
          cap === 'round'
            ? 'circle'
            : cap === 'linear'
              ? 'line'
              : cap === 'number'
                ? 'number'
                : 'point',
        ),
      );
      this.add('point', call(tool.name, args, [this.selector()]));
    }
  }
}

/** A random document (valid: it satisfies I1–I8). */
export function fuzzBranchDocument(rng: Rng, registry: Registry, steps: number): Document {
  const f = new BranchFuzzer(rng, registry);
  for (let i = 0; i < 4; i += 1) f.freePoint();
  for (let i = 0; i < steps; i += 1) {
    const r = rng.nextInt(9);
    if (r === 0) f.freePoint();
    else if (r === 1) f.tangentLine();
    else if (r === 2) f.tangentCircles();
    else if (r === 3) f.concentric();
    else if (r === 4) f.tangents();
    else if (r === 5) f.otherOnBoth();
    else if (r === 6) f.misuse();
    else f.secant();
  }
  return f.doc;
}
