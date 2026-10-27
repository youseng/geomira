/**
 * ADR-0039 decision 9: a class reads as one chain when its links share their left side
 * ("BM = CM = IM"), else as its links; any other fact as its claim line.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '@geomira/lang/parse';
import { fromInteger } from '@geomira/num/rational';
import { factText, foundText } from '../src/panels/DiscoveryFacts';
import { registry } from './helpers';

const DOC = parse(
  '@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\nM = (2, 2)\nI = (1, 1)\n',
  registry,
).doc;
const id = (name: string) => DOC.objects.find((o) => o.name === name)?.id ?? -1;
const pts = (...names: string[]) => names.map((x) => ({ id: id(x) }));
const one = { lit: fromInteger(1) };
const link = (...names: string[]) => ({
  kind: 'length',
  args: [...pts(...names), one],
  key: names.join(''),
  objects: [],
});

describe('the text of a reported fact (ADR-0039)', () => {
  it('a class whose links share their left side is one chain', () => {
    const chain = [link('B', 'M', 'C', 'M'), link('B', 'M', 'I', 'M')];
    const left = factText(DOC, chain[0] ?? link());
    expect(left.split(' = ')).toHaveLength(2);
    const text = foundText(DOC, { kind: 'length', args: chain[0]?.args ?? [], chain });
    expect(text.split(' = ')).toHaveLength(3);
    expect(text.startsWith(`${left.split(' = ')[0] ?? ''} = `)).toBe(true);
  });

  it('a single fact is its claim line', () => {
    const f = { kind: 'collinear', args: pts('A', 'B', 'C') };
    expect(foundText(DOC, f)).toBe(factText(DOC, f));
  });
});
