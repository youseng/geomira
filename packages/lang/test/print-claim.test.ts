/**
 * ADR-0035: the text of a claim for the Claims panel's found facts is the `claim` line's body,
 * the same notation print writes.
 */
import { describe, expect, it } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { printClaim } from '../src/print-claim';

const registry = createRegistry();

describe('printClaim', () => {
  it('is the body of the claim line print writes', () => {
    const text =
      '@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\nM = midpoint(A, B)\nclaim collinear(A, M, B)\nclaim dist(A, M) = dist(M, B)\n';
    const doc = parse(text, registry).doc;
    const lines = print(doc)
      .split('\n')
      .filter((l) => l.startsWith('claim '));
    expect(doc.claims.map((c) => `claim ${printClaim(doc, c.kind, c.args)}`)).toEqual(lines);
  });
});
