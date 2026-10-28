/**
 * Claim keys (ADR-0035): two claims of one kind are the same claim when their arguments differ
 * by the kind's argument symmetries (kind data: `ClaimKindSpec.symmetry`, generators that the
 * group closes), as ADR-0029's construction keys do for tools. The key of a claim is its
 * lexicographically smallest arrangement; equal keys ⇔ the same claim up to the symmetries.
 */
import { formatRational, type Rational } from '@geomira/num/rational';
import type { ClaimKindSpec, ClaimSymmetry } from './kind';

/** A claim argument as the key sees it: a key of an object (any text) or an exact literal. */
export type KeyArg = { readonly key: string } | { readonly lit: Rational };

function text(a: KeyArg): string {
  return 'key' in a ? a.key : `q${formatRational(a.lit)}`;
}

function permute<T>(xs: readonly T[], perm: readonly number[]): T[] | undefined {
  const out: T[] = [];
  for (const i of perm) {
    const x = xs[i];
    if (x === undefined) return undefined;
    out.push(x);
  }
  return out;
}

/** The generators that apply to these literals and this arity. */
function generators(
  syms: readonly ClaimSymmetry[],
  lits: readonly Rational[],
  arity: number,
): (readonly number[])[] {
  return syms
    .filter((s) => s.perm.length === arity && (s.when === undefined || s.when(lits)))
    .map((s) => s.perm);
}

/**
 * Every arrangement of `n` positions the generators reach from the identity (a closed group;
 * the identity included). Degenerate: no generator → the identity alone.
 */
export function orbit(n: number, gens: readonly (readonly number[])[]): number[][] {
  const start = Array.from({ length: n }, (_, i) => i);
  const seen = new Map<string, number[]>([[start.join(','), start]]);
  const queue = [start];
  for (let a = queue.pop(); a !== undefined; a = queue.pop()) {
    for (const g of gens) {
      const b = permute(a, g);
      if (b === undefined) continue;
      const id = b.join(',');
      if (seen.has(id)) continue;
      seen.set(id, b);
      queue.push(b);
    }
  }
  return [...seen.values()];
}

/**
 * Whether the generators include every adjacent transposition of positions 0..n − 1, so that
 * they generate every arrangement (the symmetric group: n! of them, 720 for conconic's six
 * points, too many to list per candidate).
 */
function allAdjacent(gens: readonly (readonly number[])[], n: number): boolean {
  const swaps = new Set(gens.map((g) => (transposition(g) ?? [-1, -1]).join(',')));
  return Array.from({ length: n - 1 }, (_, i) => `${String(i)},${String(i + 1)}`).every((t) =>
    swaps.has(t),
  );
}

/**
 * The order of the smallest joined arrangement: x before y when x|y| < y|x| (the classical
 * smallest-concatenation order, a total preorder; plain string order differs when one key is a
 * prefix of another, "o1" and "o12").
 */
function beforeJoined(x: string, y: string): number {
  const [a, b] = [`${x}|${y}|`, `${y}|${x}|`];
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The key of `kind`(args): the smallest arrangement under the kind's symmetries, with the kind's
 * name. Arguments of a rest kind beyond its symmetries' arity are compared as written.
 */
export function claimKey(kind: ClaimKindSpec, args: readonly KeyArg[]): string {
  const lits = args.flatMap((a) => ('lit' in a ? [a.lit] : []));
  const texts = args.map(text);
  const gens = generators(kind.symmetry ?? [], lits, args.length);
  if (allAdjacent(gens, args.length))
    return `${kind.name}(${[...texts].sort(beforeJoined).join('|')})`;
  let best: string | undefined;
  for (const perm of orbit(args.length, gens)) {
    const shown = permute(texts, perm)?.join('|');
    if (shown !== undefined && (best === undefined || shown < best)) best = shown;
  }
  return `${kind.name}(${best ?? texts.join('|')})`;
}

/**
 * Whether `perm` swaps two positions and fixes the rest (the finder enumerates tuples
 * increasing on the positions of such generators, never generating a non-canonical one).
 * Degenerate: the identity → undefined.
 */
export function transposition(perm: readonly number[]): readonly [number, number] | undefined {
  const moved = perm.flatMap((p, i) => (p === i ? [] : [i]));
  const [i, j] = moved;
  return moved.length === 2 && i !== undefined && j !== undefined && perm[i] === j && perm[j] === i
    ? [i, j]
    : undefined;
}
