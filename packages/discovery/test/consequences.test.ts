/**
 * ADR-0039 decision 8: where a hidden fact is listed. From the construction alone: the
 * construction facts. Once the i-th shown fact is known: under it, with its rule and its
 * parents (the shown facts up to it). Each fact once; each list counts beyond what it keeps.
 */
import { describe, expect, it } from 'vitest';
import { CONSEQUENCES_SHOWN, Listing } from '../src/consequences';
import type { Fact, FoundFact } from '../src/types';

function f(key: string): Fact {
  return { kind: 'equal', args: [], key, objects: [] };
}

function shown(key: string): FoundFact {
  return {
    ...f(key),
    verdict: {} as FoundFact['verdict'],
    rungs: 'exact over Q, 1/1',
    exact: true,
  };
}

describe('the listing of hidden facts (ADR-0039)', () => {
  it('construction facts, and consequences under the fact that made them follow', () => {
    const construction: Fact[] = [];
    const l = new Listing([shown('s0'), shown('s1')], construction);
    l.add(f('c'), 0, 'incidence');
    l.add(f('h1'), 1, 'angles');
    l.add(f('h2'), 2, 'transport');
    l.add(f('h3'), 2, 'part');
    expect(construction.map((x) => x.key)).toEqual(['c']);
    expect(l.constructionCount).toBe(1);
    expect(l.consequenceCount).toBe(3);
    const [a, b] = l.facts();
    expect(a?.consequences?.shown.map((x) => [x.key, x.rule, x.parents])).toEqual([
      ['h1', 'angles', ['s0']],
    ]);
    expect(b?.consequences?.count).toBe(2);
    expect(b?.consequences?.shown.map((x) => [x.key, x.rule, x.parents])).toEqual([
      ['h2', 'transport', ['s0', 's1']],
      ['h3', 'part', ['s0', 's1']],
    ]);
  });

  it('each fact is listed once; a fact without consequences carries none', () => {
    const l = new Listing([shown('s0'), shown('s1')], []);
    l.add(f('h'), 1, 'angles');
    l.add(f('h'), 2, 'angles');
    l.add(f('h'), 0, 'incidence');
    expect(l.consequenceCount).toBe(1);
    expect(l.constructionCount).toBe(0);
    expect(l.facts()[1]?.consequences).toBeUndefined();
  });

  it('a list keeps its first CONSEQUENCES_SHOWN and counts the rest', () => {
    const l = new Listing([shown('s0')], []);
    for (let i = 0; i < CONSEQUENCES_SHOWN + 5; i++) l.add(f(`h${String(i)}`), 1, 'angles');
    const c = l.facts()[0]?.consequences;
    expect(c?.count).toBe(CONSEQUENCES_SHOWN + 5);
    expect(c?.shown).toHaveLength(CONSEQUENCES_SHOWN);
  });
});
