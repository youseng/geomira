/**
 * Run 14 (ADR-0032) in the style card: the image of a segment through the center of an
 * inversion is "two rays", a curve with the curve fields; a Möbius map (static kinds
 * ['transform', 'mobius']) is not drawn, like every map.
 */
import { describe, expect, it } from 'vitest';
import { createEditor } from '@geomira/editor/state';
import { findObjectByName } from '@geomira/kernel/document';
import { objectKinds } from '@geomira/kernel/derived';
import { createRegistry } from '@geomira/kernel/registry';
import { parse } from '@geomira/lang/parse';
import { cardKindOf, kindName } from '../src/style-draft';

const registry = createRegistry();
const TEXT = [
  '@version 1',
  'O = (0, 0)',
  'D = (-1, 0)',
  'E = (2, 0)',
  'f = inversion(O, 4)',
  'r = apply(f, segment(D, E))',
  '',
].join('\n');

describe('the style card in an inverted figure', () => {
  const doc = parse(TEXT, registry).doc;
  const state = createEditor(doc, { registry });
  const valueOf = (n: string) => {
    const o = findObjectByName(doc, n);
    return o === undefined ? undefined : state.values.values.get(o.id);
  };

  it('two rays are a curve named "two rays"', () => {
    const v = valueOf('r');
    expect(v?.kind === 'line' && v.outside).toBe(true);
    expect(v && kindName(v, null)).toBe('two rays');
    expect(v && cardKindOf(v.kind, null)).toBe('curve');
  });

  it("a Möbius map is not drawn (its static kind 'mobius' included)", () => {
    const f = findObjectByName(doc, 'f');
    const kinds = f === undefined ? undefined : objectKinds(doc, registry).get(f.id);
    expect(kinds).toEqual(['transform', 'mobius']);
    for (const k of kinds ?? []) expect(cardKindOf(k, null)).toBe('none');
    expect(kindName(valueOf('f'), null)).toBe('map');
  });
});
