/**
 * Free inputs (SPEC §5: free state lives only in definitions): the literal arguments the
 * samplers may change. Each is addressed by object id and path, so the same address works
 * in every sample of a document.
 *   - point(x, y) with two literals: a free point;
 *   - on(l, t) on a line, on(c, u, v), on(c, θ) with literal parameters: gliders;
 *   - param(min, max, v) with three literals: a free number in [min, max];
 *   - circle(O, r) with a literal r: an explicit radius, which is not free but is a
 *     length, so the random similarity scales it (as SPEC §3.1 counts it in the scale).
 * Literals written inside a claim or an assumption are constants of the claim, not free
 * inputs. Images in derived layers are not free: evaluate recomputes them (note C).
 */
import type { Rational } from '@geomira/num/rational';
import type { Document } from '@geomira/kernel/document';
import { lit, type CallExpr, type Expr } from '@geomira/kernel/expr';
import { callsOf, exprAt, replaceAt, type Path } from './expr-path';
import { isProbe } from './probes';

export type FreeKind = 'point' | 'radius' | 'line-glider' | 'stereo' | 'angle-glider' | 'param';

export interface FreeInput {
  readonly kind: FreeKind;
  /** The object whose definition holds the call. */
  readonly id: number;
  /** The path of the call inside the definition. */
  readonly path: Path;
  /** The argument indices of the free literals, in order (x, y / r / t / u, v / θ / v). */
  readonly slots: readonly number[];
}

/** How a two-argument glider on(obj, p) reads: on a line (t) or on a circle by angle. */
export type GliderKind = (id: number, gliderPath: Path) => 'line' | 'circle' | undefined;

function lits(call: CallExpr, slots: readonly number[]): boolean {
  return slots.every((i) => call.args[i]?.kind === 'lit');
}

function classify(
  call: CallExpr,
  id: number,
  path: Path,
  glider: GliderKind,
): FreeInput | undefined {
  const n = call.args.length;
  const make = (kind: FreeKind, slots: number[]): FreeInput | undefined =>
    lits(call, slots) ? { kind, id, path, slots } : undefined;
  switch (call.tool) {
    case 'point':
      return n === 2 ? make('point', [0, 1]) : undefined;
    case 'param':
      return n === 3 ? make('param', [0, 1, 2]) : undefined;
    case 'circle':
      return n === 2 && call.args[1]?.kind === 'lit' ? make('radius', [1]) : undefined;
    case 'on': {
      if (n === 3) return make('stereo', [1, 2]);
      if (n !== 2) return undefined;
      const k = glider(id, path);
      if (k === 'line') return make('line-glider', [1]);
      return k === 'circle' ? make('angle-glider', [1]) : undefined;
    }
    default:
      return undefined;
  }
}

/** Every free input of the user objects (probes excluded), in construction order. */
export function findFree(doc: Document, glider: GliderKind): FreeInput[] {
  const out: FreeInput[] = [];
  for (const o of doc.objects) {
    if (isProbe(o)) continue;
    for (const { call, path } of callsOf(o.def)) {
      const f = classify(call, o.id, path, glider);
      if (f !== undefined) out.push(f);
    }
  }
  return out;
}

/** The current literal values of an input, in slot order, or undefined if they are gone. */
export function readFree(doc: Document, input: FreeInput): Rational[] | undefined {
  const o = doc.objects.find((x) => x.id === input.id);
  const call = o === undefined ? undefined : exprAt(o.def, input.path);
  if (call?.kind !== 'call') return undefined;
  const out: Rational[] = [];
  for (const i of input.slots) {
    const a = call.args[i];
    if (a?.kind !== 'lit') return undefined;
    out.push(a.value);
  }
  return out;
}

export interface Assignment {
  readonly input: FreeInput;
  /** New values for the input's slots (a shorter list leaves the remaining slots alone). */
  readonly values: readonly Rational[];
  /** The literals' texts as written (ADR-0009 decision 12), e.g. short decimals; optional. */
  readonly texts?: readonly (string | undefined)[];
}

function assignOne(def: Expr, a: Assignment): Expr {
  let out = def;
  a.values.forEach((v, k) => {
    const slot = a.input.slots[k];
    const text = a.texts?.[k];
    if (slot !== undefined)
      out = replaceAt(out, [...a.input.path, slot], () =>
        text === undefined ? lit(v) : lit(v, text),
      );
  });
  return out;
}

/** The document with every assignment applied (objects keep their ids and order). */
export function writeFree(doc: Document, assignments: readonly Assignment[]): Document {
  const byId = new Map<number, Assignment[]>();
  for (const a of assignments) byId.set(a.input.id, [...(byId.get(a.input.id) ?? []), a]);
  return {
    ...doc,
    objects: doc.objects.map((o) => {
      const mine = byId.get(o.id);
      return mine === undefined ? o : { ...o, def: mine.reduce(assignOne, o.def) };
    }),
  };
}
