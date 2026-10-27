/**
 * ADR-0035: claim symmetries are kind data, and every generator keeps the claim. On the L12
 * corpora, each generator that applies to a claim's literals and arity gives a claim with the
 * same truth in the current figure (true stays true; false stays false when both are defined:
 * a non-symmetric NDG may leave one degenerate twin undefined); the claim keys of the generated arrangements are all equal.
 */
import { describe, expect, it } from 'vitest';
import { rational } from '@geomira/num/rational';
import { evalClaim } from '../src/eval-claim';
import { claimKind, CLAIM_KINDS } from '../src/kinds';
import { HINTED_KINDS } from '../src/kind-hints';
import { claimKey, orbit, transposition, type KeyArg } from '../src/symmetry';
import { REGISTRY } from './helpers/build';
import { baseFigure, type Entry } from './helpers/corpus';
import { DEGENERATE_CLAIMS } from './helpers/corpus-degenerate';
import { FALSE_CLAIMS } from './helpers/corpus-false';
import { TRUE_THEOREMS } from './helpers/corpus-true';

const ALL: readonly Entry[] = [...TRUE_THEOREMS, ...FALSE_CLAIMS, ...DEGENERATE_CLAIMS];

function simple(v: ReturnType<typeof evalClaim>): string {
  return v.value;
}

describe('claim symmetries (ADR-0035)', () => {
  it('every v1 kind has its symmetries in the hints table, and nothing else is there', () => {
    expect([...HINTED_KINDS].sort()).toEqual(CLAIM_KINDS.map((k) => k.name).sort());
    for (const k of CLAIM_KINDS) expect(k.symmetry, k.name).toBeDefined();
  });

  it('each generator keeps the value of every corpus claim it applies to', () => {
    let checked = 0;
    for (const e of ALL) {
      const f = baseFigure();
      const id = e.build(f);
      const claim = f.doc.claims.find((c) => c.id === id);
      const kind = claim === undefined ? undefined : claimKind(claim.kind);
      if (claim === undefined || kind === undefined) continue;
      const lits = claim.args.flatMap((a) => (a.kind === 'lit' ? [a.value] : []));
      const before = simple(evalClaim(f.doc, id, REGISTRY));
      for (const g of kind.symmetry ?? []) {
        if (g.perm.length !== claim.args.length || (g.when !== undefined && !g.when(lits)))
          continue;
        const args = g.perm.map((i) => claim.args[i]);
        if (args.some((a) => a === undefined)) throw new Error('perm');
        const pid = f.doc.nextId;
        const doc = {
          ...f.doc,
          nextId: pid + 1,
          claims: [
            ...f.doc.claims,
            { id: pid, kind: claim.kind, args: args.flatMap((a) => (a === undefined ? [] : [a])) },
          ],
        };
        const after = simple(evalClaim(doc, pid, REGISTRY));
        const what = `${e.name}: ${g.perm.join(',')}`;
        // Truth is kept exactly; an NDG that is not symmetric (AB = k·CD needs only C ≠ D) can
        // make one of two degenerate twins undefined and the other false, never true.
        expect(after === 'true', what).toBe(before === 'true');
        if (after !== 'undefined' && before !== 'undefined') expect(after, what).toBe(before);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(80);
  });

  it('claim keys: the orbit of a claim has one key, other claims another', () => {
    const k = (s: string): KeyArg => ({ key: s });
    const col = claimKind('collinear');
    const len = claimKind('length');
    const dang = claimKind('dangle');
    if (col === undefined || len === undefined || dang === undefined) throw new Error('kinds');
    const one = { lit: rational(1n) };
    const two = { lit: rational(2n) };
    expect(claimKey(col, [k('A'), k('B'), k('C')])).toBe(claimKey(col, [k('C'), k('A'), k('B')]));
    expect(claimKey(col, [k('A'), k('B'), k('C')])).not.toBe(
      claimKey(col, [k('A'), k('B'), k('D')]),
    );
    expect(claimKey(len, [k('A'), k('B'), k('C'), k('D'), one])).toBe(
      claimKey(len, [k('D'), k('C'), k('B'), k('A'), one]),
    );
    // AB = 2·CD is not CD = 2·AB.
    expect(claimKey(len, [k('A'), k('B'), k('C'), k('D'), two])).not.toBe(
      claimKey(len, [k('C'), k('D'), k('A'), k('B'), two]),
    );
    expect(claimKey(len, [k('A'), k('B'), k('C'), k('D'), two])).toBe(
      claimKey(len, [k('B'), k('A'), k('D'), k('C'), two]),
    );
    // ∡ABC = ∡DEF is ∡CBA = ∡FED, and for n = 1 also ∡DEF = ∡ABC; not ∡CBA = ∡DEF.
    const a = (xs: string[]) => [one, ...xs.map(k)];
    expect(claimKey(dang, a(['A', 'B', 'C', 'D', 'E', 'F']))).toBe(
      claimKey(dang, a(['F', 'E', 'D', 'C', 'B', 'A'])),
    );
    expect(claimKey(dang, a(['A', 'B', 'C', 'D', 'E', 'F']))).not.toBe(
      claimKey(dang, a(['C', 'B', 'A', 'D', 'E', 'F'])),
    );
    expect(claimKey(col, [k('A'), k('B')])).toBe('collinear(A|B)');
  });

  it('orbit sizes and transpositions', () => {
    const gens = (name: string, lits: number[] = []) => {
      const kind = claimKind(name);
      const ls = lits.map((x) => rational(BigInt(x)));
      return (kind?.symmetry ?? [])
        .filter((s) => s.when === undefined || s.when(ls))
        .map((s) => s.perm);
    };
    expect(orbit(3, gens('collinear'))).toHaveLength(6);
    expect(orbit(4, gens('concyclic'))).toHaveLength(24);
    expect(orbit(5, gens('length', [1]))).toHaveLength(8);
    expect(orbit(5, gens('length', [2]))).toHaveLength(4);
    expect(orbit(7, gens('dangle', [1]))).toHaveLength(4);
    expect(orbit(7, gens('dangle', [2]))).toHaveLength(2);
    expect(orbit(6, gens('angle_eq'))).toHaveLength(8);
    expect(orbit(2, [])).toEqual([[0, 1]]);
    expect(transposition([1, 0, 2])).toEqual([0, 1]);
    expect(transposition([0, 2, 1])).toEqual([1, 2]);
    expect(transposition([0, 1, 2])).toBeUndefined();
    expect(transposition([1, 2, 0])).toBeUndefined();
    expect(transposition([2, 3, 0, 1])).toBeUndefined();
  });
});
