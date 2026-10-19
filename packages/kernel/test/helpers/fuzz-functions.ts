/**
 * Seeded random documents aimed at the degeneracies of sqrt, sin, cos and tan (law L1,
 * ADR-0005): exact and measured numbers that are negative, exactly 0, or within ±1e-17 …
 * 1e-6 of 0 (around EPS and BAND, both signs); angles exactly at, and within 1e-12 … 1e-3
 * degrees of, 90° (mod 180°), measured or literal; huge (1e200) and tiny (1e-200)
 * literals; nested calls (sqrt of sqrt, tan of tan, …) and arithmetic on the results.
 * Every function call takes a pool REFERENCE, so the test can read its argument's value.
 */
import { add, fromNumber, rational, type Rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { emptyDocument, type Document } from '../../src/document';
import { addObject } from '../../src/edit';
import { call, lit, ref, type Expr, type RefExpr } from '../../src/expr';

const SMALL = [0, 1e-17, 1e-15, 1e-12, 1e-10, 1e-9, 3e-9, 1e-8, 5e-8, 1e-7, 3e-7, 1e-6];
const LITERALS = [0, 1, -1, 2, 0.5, 90, -90, 270, 180, 45, 1e-200, -1e-200, 1e200, -1e200];
const NEAR_RIGHT = [0, 1e-12, 1e-9, 1e-7, 1e-6, 1e-5, 1e-3];
const FUNCTIONS = ['sqrt', 'sin', 'cos', 'tan'] as const;

/** A function call of a fuzzed document and the object its argument refers to. */
export interface FunctionCall {
  readonly id: number;
  readonly tool: (typeof FUNCTIONS)[number];
  readonly argId: number;
}

export interface FunctionDocument {
  readonly doc: Document;
  readonly calls: readonly FunctionCall[];
}

function pick<X>(rng: Rng, xs: readonly X[]): X {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('pick from an empty list');
  return x;
}

class FunctionFuzzer {
  doc: Document = emptyDocument();
  readonly numbers: RefExpr[] = [];
  readonly calls: FunctionCall[] = [];
  private count = 0;

  constructor(private readonly rng: Rng) {}

  add(prefix: string, def: Expr): RefExpr {
    this.count += 1;
    const r = addObject(this.doc, { name: `${prefix}${String(this.count)}`, def });
    if (!r.ok) throw new Error(r.error);
    this.doc = r.doc;
    return ref(r.id);
  }

  sign(): number {
    return pick(this.rng, [1, -1]);
  }

  coordinate(): Rational {
    return rational(BigInt(this.rng.nextInt(4097) - 2048), 256n);
  }

  point(x: Rational, y: Rational): RefExpr {
    return this.add('P', call('point', [lit(x), lit(y)]));
  }

  /** A number that is (nearly) 0: a literal, or a difference of two (nearly) equal measures. */
  nearZero(): Expr {
    const d = pick(this.rng, SMALL) * this.sign();
    const [x, y] = [this.coordinate(), this.coordinate()];
    const P = this.point(x, y);
    const Q = this.point(add(x, rational(3n)), add(y, rational(4n)));
    const R = this.point(add(x, rational(5n)), add(y, fromNumber(d)));
    const choices = [
      () => lit(fromNumber(d)),
      () => call('sub', [call('dist', [P, Q]), call('dist', [P, R])]),
      () =>
        call('area', [
          P,
          Q,
          this.point(add(x, rational(6n)), add(y, add(rational(8n), fromNumber(d)))),
        ]),
      () => call('neg', [call('area', [P, Q, this.point(add(x, fromNumber(d)), y)])]),
      () =>
        call('sub', [
          call('mul', [call('dist', [P, Q]), call('dist', [P, Q])]),
          lit(rational(25n)),
        ]),
    ];
    return pick(this.rng, choices)();
  }

  /** An angle at or near 90° (mod 180°): measured, or a literal, with an offset. */
  nearRight(): Expr {
    const e = pick(this.rng, NEAR_RIGHT) * this.sign();
    const [x, y] = [this.coordinate(), this.coordinate()];
    const O = this.point(x, y);
    const A = this.point(add(x, rational(2n)), add(y, rational(1n)));
    const B = this.point(add(x, rational(-1n)), add(y, add(rational(2n), fromNumber(e))));
    const k = lit(rational(BigInt(180 * (this.rng.nextInt(5) - 2))));
    const choices = [
      () => lit(fromNumber(90 + e)),
      () => call('angle', [A, O, B]),
      () => call('dangle', [A, O, B]),
      () => call('add', [call('angle', [A, O, B]), k]),
      () => call('add', [lit(rational(90n)), lit(fromNumber(e))]),
      () =>
        call('add', [
          call('mul', [lit(rational(2n)), call('angle', [A, O, B])]),
          lit(rational(-90n)),
        ]),
    ];
    return pick(this.rng, choices)();
  }

  literal(): Expr {
    if (this.rng.nextFloat() < 0.5) return lit(fromNumber(pick(this.rng, LITERALS)));
    return lit(rational(BigInt(this.rng.nextInt(721) - 360), BigInt(this.rng.nextInt(6) + 1)));
  }

  /** A new pool number: fresh input, a function of a pool number, or arithmetic on two. */
  step(): void {
    const r = this.rng.nextFloat();
    if (r < 0.35 || this.numbers.length === 0) {
      const fresh = pick(this.rng, [
        () => this.nearZero(),
        () => this.nearRight(),
        () => this.literal(),
      ]);
      this.numbers.push(this.add('n', fresh()));
      return;
    }
    if (r < 0.85) {
      const tool = pick(this.rng, FUNCTIONS);
      const arg = pick(this.rng, this.numbers);
      const out = this.add('f', call(tool, [arg]));
      this.calls.push({ id: out.id, tool, argId: arg.id });
      this.numbers.push(out);
      return;
    }
    const op = pick(this.rng, ['add', 'sub', 'mul', 'div']);
    this.numbers.push(
      this.add('n', call(op, [pick(this.rng, this.numbers), pick(this.rng, this.numbers)])),
    );
  }
}

/** A random document (valid: it satisfies I1–I8) and its function calls. */
export function fuzzFunctionDocument(rng: Rng, steps: number): FunctionDocument {
  const f = new FunctionFuzzer(rng);
  for (let i = 0; i < steps; i += 1) f.step();
  return { doc: f.doc, calls: f.calls };
}
