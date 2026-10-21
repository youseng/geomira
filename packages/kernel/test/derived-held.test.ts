/**
 * syncDerived's `held` sources (the language's exclusion by name, see Held): a held source
 * is not imaged in that call, chains included, and images that exist stay.
 */
import { describe, expect, it } from 'vitest';
import { syncDerived } from '../src/derived';
import { REGISTRY } from './helpers/doc';
import { imaged, names } from './helpers/derived-fixture';

describe('syncDerived with held sources', () => {
  it('does not image a held source; a later call without it does; existing images stay', () => {
    const { doc, layer } = imaged();
    const bare = { ...doc, objects: doc.objects.filter((o) => o.managedBy === undefined) };
    const first = syncDerived(bare, REGISTRY, (l, x) => l === layer && x.name === 'A');
    if (!first.ok) throw new Error(first.error);
    expect(names(first.doc).slice(-3)).toEqual(['B*', 'C*', 'D*']);
    const second = syncDerived(first.doc, REGISTRY, (_l, x) => x.name === 'B');
    if (!second.ok) throw new Error(second.error);
    expect(names(second.doc)).toEqual(names(doc));
    expect(second.added.map((id) => second.doc.objects.find((o) => o.id === id)?.name)).toEqual([
      'A*',
    ]);
    // Holding nothing is the plain sync.
    expect(syncDerived(bare, REGISTRY, () => false)).toEqual(syncDerived(bare, REGISTRY));
  });
});
