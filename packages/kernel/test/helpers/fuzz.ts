/**
 * Seeded random documents for the laws (L1, L2) and the invariant property tests. The
 * generator is driven by the registry's signatures, so every tool (and every future one)
 * is fuzzed. With `degenerate`, it injects exact and near coincidences and collinearities
 * (offsets from ±1e-17 up to beyond the band), parallel and coincident lines, wrong
 * kinds, unknown tools, selectors, zero and huge literals.
 */
import { add, fromNumber, mul, rational, sub, type Rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { emptyDocument, type Document } from '../../src/document';
import { addObject } from '../../src/edit';
import { call, lit, ref, type Expr, type RefExpr } from '../../src/expr';
import type { Registry } from '../../src/registry';
import type { Signature } from '../../src/tool';
import { capabilityKinds, type ValueKind } from '../../src/value';

export interface FuzzOptions {
  /** Number of free points to start with. */
  readonly points: number;
  /** Number of tool calls after the free points. */
  readonly calls: number;
  readonly degenerate: boolean;
  /** Maximum construction depth (keeps exact rationals small). */
  readonly maxDepth: number;
}

interface Entry {
  readonly ref: RefExpr;
  readonly kind: ValueKind;
  readonly depth: number;
}

/** Relative offsets for near-degenerate inputs: around EPS (1e-9) and BAND (1e-7). */
const OFFSETS = [0, 1e-17, 1e-15, 1e-12, 1e-10, 5e-10, 1e-9, 3e-9, 1e-8, 5e-8, 1e-7, 3e-7, 1e-6];

const PREFIX: Partial<Record<ValueKind, string>> = {
  point: 'P',
  line: 'l',
  number: 'n',
  polygon: 'g',
};

function pick<X>(rng: Rng, xs: readonly X[]): X {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('pick from an empty list');
  return x;
}

/** A coordinate on the grid of 1/1024 in [−16, 16] (exact mode) or a random double. */
function coordinate(rng: Rng, degenerate: boolean): Rational {
  if (!degenerate || rng.nextFloat() < 0.5) {
    return rational(BigInt(rng.nextInt(32769) - 16384), 1024n);
  }
  const magnitude = pick(rng, [1, 10, 1000]);
  return fromNumber(rng.uniform(-magnitude, magnitude));
}

class Fuzzer {
  doc: Document = emptyDocument();
  readonly entries: Entry[] = [];
  readonly free: (readonly [Rational, Rational])[] = [];
  private count = 0;

  constructor(
    private readonly rng: Rng,
    private readonly registry: Registry,
    private readonly opts: FuzzOptions,
  ) {}

  add(kind: ValueKind, def: Expr, depth: number): void {
    this.count += 1;
    const name = `${PREFIX[kind] ?? 'z'}${String(this.count)}`;
    const r = addObject(this.doc, { name, def });
    if (!r.ok) throw new Error(r.error);
    this.doc = r.doc;
    this.entries.push({ ref: ref(r.id), kind, depth });
  }

  freePoint(): void {
    let xy: readonly [Rational, Rational] = [
      coordinate(this.rng, this.opts.degenerate),
      coordinate(this.rng, this.opts.degenerate),
    ];
    if (this.opts.degenerate && this.free.length > 0 && this.rng.nextFloat() < 0.5) {
      xy = this.nearDegenerate();
    }
    this.free.push(xy);
    this.add('point', call('point', [lit(xy[0]), lit(xy[1])]), 0);
  }

  /** A point exactly or nearly on an existing point, or on the line of two of them. */
  private nearDegenerate(): readonly [Rational, Rational] {
    const a = pick(this.rng, this.free);
    const b = pick(this.rng, this.free);
    const t = rational(BigInt(this.rng.nextInt(9) - 4), BigInt(this.rng.nextInt(4) + 1));
    const base =
      this.rng.nextFloat() < 0.5
        ? a
        : ([add(a[0], mul(t, sub(b[0], a[0]))), add(a[1], mul(t, sub(b[1], a[1])))] as const);
    const delta = fromNumber(pick(this.rng, OFFSETS) * pick(this.rng, [1, -1, 10, -20]));
    return this.rng.nextFloat() < 0.5
      ? [add(base[0], delta), base[1]]
      : [base[0], add(base[1], delta)];
  }

  /** A number literal; `huge` allows 1e200 (overflow paths), never used for coordinates. */
  literal(huge = true): Expr {
    const special = [0, 1, -1, 1e-17, -1e-12, 1e-9, 1e-7, 0.5, 1e-200, ...(huge ? [1e200] : [])];
    if (this.opts.degenerate && this.rng.nextFloat() < 0.3)
      return lit(fromNumber(pick(this.rng, special)));
    return lit(rational(BigInt(this.rng.nextInt(41) - 20), BigInt(this.rng.nextInt(6) + 1)));
  }

  /** An argument for a capability: a pool entry, an inline literal, or (rarely) a wrong kind. */
  arg(kinds: readonly ValueKind[], huge: boolean): { expr: Expr; depth: number } | undefined {
    if (this.opts.degenerate && this.rng.nextFloat() < 0.03 && this.entries.length > 0) {
      const e = pick(this.rng, this.entries);
      return { expr: e.ref, depth: e.depth };
    }
    if (kinds.includes('number') && this.rng.nextFloat() < 0.4)
      return { expr: this.literal(huge), depth: 0 };
    if (kinds.includes('point') && this.rng.nextFloat() < 0.05) {
      return { expr: call('point', [this.literal(false), this.literal(false)]), depth: 0 };
    }
    const ok = this.entries.filter((e) => kinds.includes(e.kind) && e.depth < this.opts.maxDepth);
    if (ok.length === 0)
      return kinds.includes('number') ? { expr: this.literal(huge), depth: 0 } : undefined;
    const e = pick(this.rng, ok);
    return { expr: e.ref, depth: e.depth };
  }

  toolCall(): void {
    const tool = pick(this.rng, this.registry.tools);
    const sig: Signature = pick(this.rng, tool.signatures);
    const caps = [...sig.params];
    if (sig.rest !== undefined)
      for (let k = this.rng.nextInt(3); k > 0; k -= 1) caps.push(sig.rest);
    const args: Expr[] = [];
    let depth = 0;
    for (const cap of caps) {
      // Literal coordinates of point(x, y) are free points: keep them inside MAX_SCALE.
      const a = this.arg(capabilityKinds(cap), tool.name !== 'point');
      if (a === undefined) return;
      args.push(a.expr);
      depth = Math.max(depth, a.depth + 1);
    }
    const kind = tool.outputKinds[0] ?? 'undefined';
    const r = this.opts.degenerate ? this.rng.nextFloat() : 1;
    if (r < 0.02) this.add('undefined', call('no_such_tool', args), depth);
    else if (r < 0.04) this.add(kind, call(tool.name, args, [{ kind: 'along', sign: 1 }]), depth);
    else this.add(kind, call(tool.name, args), depth);
  }
}

/** A random document (valid: it satisfies I1–I8). */
export function fuzzDocument(rng: Rng, registry: Registry, opts: FuzzOptions): Document {
  const f = new Fuzzer(rng, registry, opts);
  for (let i = 0; i < opts.points; i += 1) f.freePoint();
  for (let i = 0; i < opts.calls; i += 1) {
    if (opts.degenerate && f.free.length > 0 && rng.nextFloat() < 0.1) f.freePoint();
    else f.toolCall();
  }
  return f.doc;
}

/** The ids of the free points of a document (`point(lit, lit)` objects). */
export function freePointIds(doc: Document): number[] {
  return doc.objects
    .filter(
      (o) =>
        o.def.kind === 'call' &&
        o.def.tool === 'point' &&
        o.def.args.every((a) => a.kind === 'lit'),
    )
    .map((o) => o.id);
}
