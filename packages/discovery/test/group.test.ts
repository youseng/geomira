/**
 * ADR-0039 decision 5, on synthetic facts: n-ary groups merge through proper determining
 * subsets only, never name coinciding objects twice, and are construction facts when every
 * member is; classes link their first member to every other, test a spanning forest of their
 * non-construction members, and merge a directed angle's class with its mirror.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import type { ScreenArg } from '@geomira/claims/screen';
import { fromInteger } from '@geomira/num/rational';
import { makeCandidate } from '../src/candidates';
import { grouped, groupKind, type GroupEnv, type TrueFact, type Unit } from '../src/group';
import { drain } from '../src/ticking';

const KINDS = claimKindRegistry();

function kindOf(name: string) {
  const k = KINDS.get(name);
  if (k === undefined) throw new Error(name);
  return k;
}

const one: ScreenArg = { lit: fromInteger(1) };
const ids = (...xs: number[]): ScreenArg[] => xs.map((id) => ({ id }));

function fact(kind: string, args: ScreenArg[], construction = false): TrueFact {
  return { c: makeCandidate(kindOf(kind), args), construction };
}

function env(over: Partial<GroupEnv> = {}): GroupEnv {
  return {
    order: new Map(Array.from({ length: 20 }, (_, i) => [i, i])),
    proper: () => true,
    coincide: () => false,
    ...over,
  };
}

function groups(kind: string, facts: TrueFact[], e = env()): Unit[] {
  return drain(groupKind(kindOf(kind), facts, e));
}

describe('n-ary groups (ADR-0039 decision 5)', () => {
  it('collinear facts sharing two points are one fact of all their points', () => {
    const us = groups('collinear', [
      fact('collinear', ids(1, 2, 3)),
      fact('collinear', ids(1, 2, 4)),
      // The screen sees every triple of a line: this one shares {1, 3} and {3, 4}.
      fact('collinear', ids(1, 3, 4)),
      fact('collinear', ids(3, 4, 5)),
    ]);
    expect(us).toHaveLength(1);
    expect(us[0]?.objects).toEqual([1, 2, 3, 4, 5]);
    expect(us[0]?.parts).toHaveLength(4);
    expect(us[0]?.construction).toBe(false);
  });

  it('only a proper determining subset merges', () => {
    const e = env({ proper: (_k, s) => !(s[0] === 1 && s[1] === 2) });
    const us = groups(
      'collinear',
      [fact('collinear', ids(1, 2, 3)), fact('collinear', ids(1, 2, 4))],
      e,
    );
    expect(us.map((u) => u.objects)).toEqual([
      [1, 2, 3],
      [1, 2, 4],
    ]);
  });

  it('an object coinciding with another stays out of the group, in a fact of its own', () => {
    const e = env({ coincide: (_k, a, b) => (a === 3 && b === 4) || (a === 4 && b === 3) });
    const us = groups(
      'concurrent',
      [
        fact('concurrent', ids(1, 2, 3)),
        fact('concurrent', ids(1, 2, 4)),
        fact('concurrent', ids(1, 2, 5)),
      ],
      e,
    );
    expect(us.map((u) => u.objects)).toEqual([
      [1, 2, 3, 5],
      [1, 2, 4],
    ]);
  });

  it('a group of construction facts is a construction fact; its parts are the others', () => {
    const all = groups('concyclic', [
      fact('concyclic', ids(1, 2, 3, 4), true),
      fact('concyclic', ids(1, 2, 3, 5), true),
    ]);
    expect(all[0]?.construction).toBe(true);
    expect(all[0]?.parts).toEqual([]);
    const mixed = groups('concyclic', [
      fact('concyclic', ids(1, 2, 3, 4), true),
      fact('concyclic', ids(1, 2, 3, 5)),
    ]);
    expect(mixed[0]?.construction).toBe(false);
    expect(mixed[0]?.parts.map((p) => p.objects)).toEqual([[1, 2, 3, 5]]);
  });

  it('which kinds are grouped', () => {
    for (const k of ['collinear', 'concyclic', 'concurrent', 'length', 'dangle', 'angle_eq'])
      expect(grouped(k), k).toBe(true);
    for (const k of ['equal', 'on', 'parallel', 'tangent', 'angle_sum'])
      expect(grouped(k), k).toBe(false);
  });
});

describe('classes (ADR-0039 decision 5)', () => {
  it('AB = CD and CD = EF are one class, linked from its first member', () => {
    const us = groups('length', [
      fact('length', [...ids(1, 2, 3, 4), one]),
      fact('length', [...ids(3, 4, 5, 6), one]),
    ]);
    expect(us).toHaveLength(1);
    const u = us[0];
    expect(u?.chain?.map((x) => x.args)).toEqual([
      [...ids(1, 2, 3, 4), one],
      [...ids(1, 2, 5, 6), one],
    ]);
    expect(u?.key.startsWith('class:')).toBe(true);
    expect(u?.checks).toHaveLength(2);
    expect(u?.members).toHaveLength(2);
  });

  it('a construction member joins without a test; all construction: a construction fact', () => {
    const [u] = groups('length', [
      fact('length', [...ids(1, 2, 3, 4), one], true),
      fact('length', [...ids(3, 4, 5, 6), one]),
    ]);
    expect(u?.checks?.map((x) => x.objects)).toEqual([[3, 4, 5, 6]]);
    expect(u?.parts).toHaveLength(1);
    expect(u?.construction).toBe(false);
    const [v] = groups('length', [
      fact('length', [...ids(1, 2, 3, 4), one], true),
      fact('length', [...ids(3, 4, 5, 6), one], true),
    ]);
    expect(v?.construction).toBe(true);
  });

  it('a member that adds no edge is not tested (a spanning forest)', () => {
    const [u] = groups('length', [
      fact('length', [...ids(1, 2, 3, 4), one]),
      fact('length', [...ids(3, 4, 5, 6), one]),
      fact('length', [...ids(1, 2, 5, 6), one]),
    ]);
    expect(u?.parts).toHaveLength(3);
    expect(u?.checks).toHaveLength(2);
  });

  it('a ratio other than 1 is a fact of its own', () => {
    const us = groups('length', [
      fact('length', [...ids(1, 2, 3, 4), { lit: fromInteger(2) }]),
      fact('length', [...ids(3, 4, 5, 6), one]),
    ]);
    expect(us).toHaveLength(2);
    expect(us.every((u) => u.chain === undefined)).toBe(true);
  });

  it("a directed angle's class meets its mirror: one class, not two", () => {
    const us = groups('dangle', [
      fact('dangle', [one, ...ids(1, 2, 3, 4, 5, 6)]),
      fact('dangle', [one, ...ids(6, 5, 4, 7, 8, 9)]),
    ]);
    expect(us).toHaveLength(1);
    expect(us[0]?.parts).toHaveLength(2);
  });

  it('an undirected angle is the same node read either way', () => {
    const us = groups('angle_eq', [
      fact('angle_eq', ids(1, 2, 3, 4, 5, 6)),
      fact('angle_eq', ids(6, 5, 4, 7, 8, 9)),
    ]);
    expect(us).toHaveLength(1);
    expect(us[0]?.chain).toHaveLength(2);
  });
});
