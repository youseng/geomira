/**
 * Construction keys (ADR-0029): whether two definitions are the same construction, decided
 * structurally from the definitions and the registry, without evaluating. Two definitions
 * have the same key exactly when they are equal up to:
 *   - references, compared by object id; literals, by exact value; strings, by value;
 *   - nested calls, recursively;
 *   - a tool declared the same as another (ToolSpec.sameAs: circumcircle is circle);
 *   - the argument symmetries the registry declares as data (Signature.symmetry): line(A, B)
 *     is line(B, A), intersect(c1, c2, orient(+)) is intersect(c2, c1, orient(-)). At the top
 *     of a definition every symmetry applies (the object is the same figure); inside a nested
 *     call only those that keep the exact value ('value'), since a direction or an anchor can
 *     matter there (along(±) on line(A, B) is along(∓) on line(B, A)).
 * A definition that holds a free input anywhere (ToolSpec.input: point, on, param) has no key:
 * two free objects are never the same construction, the user moves them apart. Selectors are
 * compared in order. Managed images (derived layers) are not compared.
 *
 * A call takes the symmetries declared by EVERY overload its argument kinds can match (the
 * static kinds of kinds.ts; an unknown kind matches every overload): dist(A, B) of two points
 * is dist(B, A), but dist(P, l) has no symmetry. A symmetry declared on an overload promises
 * that a permuted call is taken by an overload declaring the same symmetry, with the same
 * value ('value') or the same figure ('figure'); so equal keys mean the same construction.
 */
import { assertNever } from '@geomira/num/assert';
import { formatRational } from '@geomira/num/rational';
import { exprKinds, objectKinds, type KindTable } from './derived';
import type { DocObject, Document } from './document';
import { selectorExprs, type CallExpr, type Expr, type Selector } from './expr';
import { fits, type ArgKinds } from './kinds';
import type { Registry } from './registry';
import type { ArgSymmetry, Sameness, ToolSpec } from './tool';

/** Equal keys ⇔ the same construction. */
export type ConstructionKey = string;

/**
 * Keys already computed, by definition, for ONE document as it grows (definitions are
 * immutable; a redefinition can change the kinds, so a cache must not outlive one); null:
 * no key.
 */
export type KeyCache = WeakMap<Expr, ConstructionKey | null>;

interface KeyEnv {
  readonly registry: Registry;
  readonly kinds: KindTable;
}

/**
 * The key of a definition, or undefined when it holds a free input (never the same
 * construction as anything). `kinds`: the static kinds of the objects it refers to
 * (objectKinds); without them every overload of the arity counts. Degenerate cases: an
 * unknown tool → compared by name, with no symmetry; arguments no overload takes → no
 * symmetry.
 */
export function constructionKey(
  def: Expr,
  registry: Registry,
  kinds: KindTable = new Map(),
): ConstructionKey | undefined {
  return keyOf(def, 'figure', { registry, kinds });
}

export interface SameOptions {
  /** An object not compared (the one being redefined). */
  readonly except?: number;
  /** The static kinds of the document's objects (default: objectKinds of `doc`). */
  readonly kinds?: KindTable;
  readonly cache?: KeyCache;
}

/**
 * The first object of `doc` other than `except` whose definition is the same construction
 * as `def`, or undefined. Managed images are skipped.
 */
export function sameConstruction(
  doc: Document,
  def: Expr,
  registry: Registry,
  options: SameOptions = {},
): DocObject | undefined {
  const kinds = options.kinds ?? objectKinds(doc, registry);
  const key = constructionKey(def, registry, kinds);
  if (key === undefined) return undefined;
  const keyFor = (e: Expr): ConstructionKey | undefined => {
    const hit = options.cache?.get(e);
    if (hit !== undefined) return hit ?? undefined;
    const k = constructionKey(e, registry, kinds);
    options.cache?.set(e, k ?? null);
    return k;
  };
  return doc.objects.find(
    (o) => o.id !== options.except && o.managedBy === undefined && keyFor(o.def) === key,
  );
}

function keyOf(e: Expr, level: Sameness, env: KeyEnv): string | undefined {
  switch (e.kind) {
    case 'ref':
      return `#${String(e.id)}`;
    case 'lit':
      return `q${formatRational(e.value)}`;
    case 'str':
      return `s${JSON.stringify(e.value)}`;
    case 'call':
      return callKey(e, level, env);
    default:
      return assertNever(e, 'expression');
  }
}

/** A selector's key; `flip` negates orient(±). */
function selectorKey(s: Selector, exprs: readonly string[], flip: boolean): string {
  switch (s.kind) {
    case 'along':
      return `along${String(s.sign)}`;
    case 'orient':
      return `orient${String(flip ? -s.sign : s.sign)}`;
    case 'on_arc':
      return `on_arc${s.not ? '!' : ''}(${exprs.join(',')})`;
    case 'same_side':
    case 'opposite_side':
    case 'between':
    case 'inside':
    case 'outside':
    case 'other':
    case 'near':
    case 'far_from':
      return `${s.kind}(${exprs.join(',')})`;
    default:
      return assertNever(s, 'selector');
  }
}

function callKey(e: CallExpr, level: Sameness, env: KeyEnv): string | undefined {
  const spec = env.registry.get(e.tool);
  if (spec?.input === true) return undefined;
  const args: string[] = [];
  for (const a of e.args) {
    const k = keyOf(a, 'value', env);
    if (k === undefined) return undefined;
    args.push(k);
  }
  const sels: { readonly s: Selector; readonly exprs: string[] }[] = [];
  for (const s of e.selectors) {
    const exprs: string[] = [];
    for (const x of selectorExprs(s)) {
      const k = keyOf(x, 'value', env);
      if (k === undefined) return undefined;
      exprs.push(k);
    }
    sels.push({ s, exprs });
  }
  const name = spec?.sameAs ?? e.tool;
  const argKinds = e.args.map((a) => exprKinds(a, env.kinds, env.registry));
  const syms = symmetriesFor(spec, argKinds).filter(
    (s) => level === 'figure' || s.same === 'value',
  );
  let best: string | undefined;
  for (const a of arrangements(args.length, syms)) {
    const shown = a.perm.map((i) => args[i] ?? '');
    const text = `${name}(${shown.join(',')};${sels.map((x) => selectorKey(x.s, x.exprs, a.flip)).join(',')})`;
    if (best === undefined || text < best) best = text;
  }
  return best;
}

/**
 * The symmetries every overload that arguments of these kinds can match declares (a key does
 * not evaluate, so it cannot know the overload a call resolves to; unknown kinds match every
 * overload of the arity).
 */
export function symmetriesFor(spec: ToolSpec | undefined, args: ArgKinds): readonly ArgSymmetry[] {
  const takes = (spec?.signatures ?? []).filter((s) => fits(s, args));
  const [first, ...others] = takes;
  if (first === undefined) return [];
  const text = (s: ArgSymmetry) => JSON.stringify(s);
  return (first.symmetry ?? []).filter((s) =>
    others.every((o) => (o.symmetry ?? []).some((t) => text(t) === text(s))),
  );
}

/** An order of the arguments (perm[i]: the argument shown at position i) and orient's flip. */
interface Arrangement {
  readonly perm: readonly number[];
  readonly flip: boolean;
}

type Move = (a: Arrangement) => Arrangement;

function swap(i: number, j: number, flips: boolean): Move {
  return (a) => {
    const perm = [...a.perm];
    const [x, y] = [perm[i], perm[j]];
    if (x === undefined || y === undefined) return a;
    perm[i] = y;
    perm[j] = x;
    return { perm, flip: flips ? !a.flip : a.flip };
  };
}

function moves(s: ArgSymmetry, n: number): Move[] {
  switch (s.kind) {
    case 'permute': {
      const ps = s.positions.filter((p) => p < n);
      // Adjacent transpositions generate every permutation of the positions.
      return ps.slice(1).map((p, k) => swap(ps[k] ?? p, p, s.flipsOrient === true));
    }
    case 'dihedral':
      return n < 2
        ? []
        : [
            (a) => ({ perm: [...a.perm.slice(1), ...a.perm.slice(0, 1)], flip: a.flip }),
            (a) => ({ perm: [...a.perm].reverse(), flip: a.flip }),
          ];
    default:
      return assertNever(s, 'argument symmetry');
  }
}

/** Every arrangement the symmetries generate from the identity (a closed group). */
function arrangements(n: number, syms: readonly ArgSymmetry[]): Arrangement[] {
  const gens = syms.flatMap((s) => moves(s, n));
  const start: Arrangement = { perm: Array.from({ length: n }, (_, i) => i), flip: false };
  const id = (a: Arrangement) => `${a.perm.join(',')}${a.flip ? '!' : ''}`;
  const seen = new Map<string, Arrangement>([[id(start), start]]);
  const queue = [start];
  for (let a = queue.pop(); a !== undefined; a = queue.pop()) {
    for (const g of gens) {
      const b = g(a);
      if (seen.has(id(b))) continue;
      seen.set(id(b), b);
      queue.push(b);
    }
  }
  return [...seen.values()];
}
