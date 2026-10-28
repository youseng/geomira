/**
 * Seeded random documents aimed at the Run 3a degeneracies (law L1 for circles): exact and
 * near coincidences (offsets from ±1e-17 to beyond the band), concentric and tangent
 * circles (centres on the line OP give circles tangent at P), points exactly and nearly
 * on circles, tangents at nearly incident points, gliders with parameters (0 : 0), ±1e-17
 * and 1e200, straight and zero angles for the bisectors, polars of the centre, plus random
 * calls of any registry tool on the pool (so every tool meets every kind of argument).
 */
import { add, fromNumber, rational, type Rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { emptyDocument, type Document } from '../../src/document';
import { addObject } from '../../src/edit';
import { call, lit, ref, type Expr } from '../../src/expr';
import type { Registry } from '../../src/registry';
import { capabilityKinds, type ValueKind } from '../../src/value';

const OFFSETS = [
  0, 1e-17, -1e-17, 1e-15, 1e-12, -1e-10, 1e-9, -3e-9, 1e-8, 5e-8, -1e-7, 3e-7, 1e-6,
];
const SPECIAL = [0, 1, -1, 2, 1e-17, -1e-17, 1e-12, 1e-9, 1e-7, 0.5, 90, 1e-200, 1e200];

function pick<X>(rng: Rng, xs: readonly X[]): X {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('pick from an empty list');
  return x;
}

interface Entry {
  readonly expr: Expr;
  readonly kind: ValueKind;
}

class CircleFuzzer {
  doc: Document = emptyDocument();
  readonly pool: Entry[] = [];
  readonly free: (readonly [Rational, Rational])[] = [];
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

  of(kind: ValueKind): Expr {
    const ok = this.pool.filter((e) => e.kind === kind);
    return ok.length === 0 ? this.freePoint() : pick(this.rng, ok).expr;
  }

  num(): Expr {
    return lit(fromNumber(pick(this.rng, SPECIAL) * pick(this.rng, [1, -1])));
  }

  /** A free point: on a grid, or exactly / nearly on an existing free point. */
  freePoint(): Expr {
    const grid = () => rational(BigInt(this.rng.nextInt(8193) - 4096), 256n);
    let xy: readonly [Rational, Rational] = [grid(), grid()];
    if (this.free.length > 0 && this.rng.nextFloat() < 0.5) {
      const [x, y] = pick(this.rng, this.free);
      const d = fromNumber(pick(this.rng, OFFSETS) * pick(this.rng, [1, 10, 100]));
      xy = this.rng.nextFloat() < 0.5 ? [add(x, d), y] : [x, add(y, d)];
    }
    this.free.push(xy);
    return this.add('point', call('point', [lit(xy[0]), lit(xy[1])]));
  }

  circle(): Expr {
    const p = () => this.of('point');
    const tools: (() => Expr)[] = [
      () => call('circle', [p(), p()]),
      () => call('circle', [p(), this.num()]),
      () => call('circle', [p(), p(), p()]),
      () => call('diameter_circle', [p(), p()]),
      () =>
        call(pick(this.rng, ['ninepoint_circle', 'incircle', 'excircle', 'circumcircle']), [
          p(),
          p(),
          p(),
        ]),
      // Tangent to circle(O, P) at P: the centre on the line OP.
      () => {
        const [O, P] = [p(), p()];
        return call('circle', [call('divide', [O, P, this.num()]), P]);
      },
    ];
    return this.add('circle', pick(this.rng, tools)());
  }

  /** Curves through P by construction (so other(…, P) and tangent(P, …) are reachable). */
  through(P: Expr): Expr {
    const p = () => this.of('point');
    const c = () => this.of('circle');
    const curves: (() => readonly [ValueKind, Expr])[] = [
      () => ['line', call(pick(this.rng, ['line', 'segment', 'ray']), [P, p()])],
      () => ['circle', call('circle', [p(), P])],
      () => ['circle', call('circle', [P, p(), p()])],
      () => ['line', call('tangent', [P, call('circle', [p(), P])])],
      () => ['circle', call('circle', [call('divide', [p(), P, this.num()]), P])],
      () => ['line', call('polar', [P, c()])],
    ];
    const [kind, def] = pick(this.rng, curves)();
    return this.add(kind, def);
  }

  special(): void {
    const p = () => this.of('point');
    const c = () => this.of('circle');
    const steps: (() => void)[] = [
      () => this.circle(),
      () => this.add('point', call('on', [c(), this.num(), this.num()])),
      () => this.add('point', call('on', [c(), this.num()])),
      () => this.add('point', call('on', [this.of('line'), this.num()])),
      () => {
        const P = p();
        this.add('point', call('other', [this.through(P), this.through(P), P]));
      },
      () => this.add('line', call('tangent', [p(), c()])),
      () => {
        const k = c();
        this.add('line', call('tangent', [call('on', [k, this.num(), this.num()]), k]));
      },
      () => {
        const k = c();
        this.add('line', call('polar', [pick(this.rng, [p(), call('center', [k])]), k]));
      },
      () => {
        const l = call('line', [p(), p()]);
        this.add('point', call('intersect', [l, call('parallel', [p(), l])]));
      },
      () => {
        // A segment and a parallel line: no common point (ADR-0040: full lines meet at infinity).
        const [a, b] = [p(), p()];
        const l = call('parallel', [p(), call('line', [a, b])]);
        this.add('point', call('intersect', [call('segment', [a, b]), l]));
      },
      () => {
        const k = c();
        const other = pick(this.rng, [c(), k, call('circle', [call('center', [k]), p()])]);
        this.add('line', call('radical_axis', [k, other]));
      },
      () => {
        const [A, B] = [p(), p()];
        const C = call('divide', [A, B, this.num()]);
        this.add('line', call(pick(this.rng, ['bisector', 'ext_bisector']), [A, B, C]));
      },
      () => this.add('circle', call('cline', [p(), p(), call('divide', [p(), p(), this.num()])])),
    ];
    pick(this.rng, steps)();
  }

  /** Any registry tool on pool arguments of the right kinds (or literals). */
  anyTool(): void {
    const tool = pick(this.rng, this.registry.tools);
    const sig = pick(this.rng, tool.signatures);
    const args = sig.params.map((cap) => {
      const kinds = capabilityKinds(cap);
      // Literal coordinates of point(x, y) are free points: keep them inside MAX_SCALE.
      if (kinds.includes('number'))
        return tool.name === 'point' ? lit(rational(3n, 7n)) : this.num();
      const ok = this.pool.filter((e) => kinds.includes(e.kind));
      return ok.length === 0 ? this.freePoint() : pick(this.rng, ok).expr;
    });
    this.add(tool.outputKinds[0] ?? 'undefined', call(tool.name, args));
  }
}

/** A random document of `steps` steps after four free points (valid: I1–I8 hold). */
export function fuzzCircleDocument(rng: Rng, registry: Registry, steps: number): Document {
  const f = new CircleFuzzer(rng, registry);
  for (let i = 0; i < 4; i += 1) f.freePoint();
  for (let i = 0; i < steps; i += 1) {
    const r = rng.nextFloat();
    if (r < 0.15) f.freePoint();
    else if (r < 0.7) f.special();
    else f.anyTool();
  }
  return f.doc;
}
