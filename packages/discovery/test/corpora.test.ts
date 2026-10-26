/**
 * Run 17's corpora laws, on packages/claims' L12 corpora (used, not edited):
 *   - a TRUE theorem never shows as failing at a special position: at every position the hunt
 *     finds in its figure, the theorem is true or undefined (a degenerate position), never false;
 *   - the DEGENERATE corpus never yields a reported fact: the finder reports none of its
 *     degenerate claims, and every fact it does report holds in the current figure (never a
 *     degenerate one);
 *   - a FALSE claim is never reported as a fact.
 */
import { describe, expect, it } from 'vitest';
import { evalClaim } from '@geomira/claims/eval-claim';
import { claimKey } from '@geomira/claims/symmetry';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { baseFigure, type Entry } from '../../claims/test/helpers/corpus';
import { DEGENERATE_CLAIMS } from '../../claims/test/helpers/corpus-degenerate';
import { FALSE_CLAIMS } from '../../claims/test/helpers/corpus-false';
import { TRUE_THEOREMS } from '../../claims/test/helpers/corpus-true';
import { lawCount } from '../../claims/test/helpers/laws';
import { objectify } from '../../claims/test/helpers/objectify';
import { find, withFact } from '../src/find';
import { hunt } from '../src/hunt';
import { objectKey } from '../src/terms';
import { REGISTRY } from './helpers';

const KINDS = claimKindRegistry();

function keyOf(kind: string, args: ReturnType<typeof objectify>['args']): string {
  const spec = KINDS.get(kind);
  if (spec === undefined) throw new Error(kind);
  return claimKey(
    spec,
    args.map((a) => ('id' in a ? { key: objectKey(a.id) } : { lit: a.lit })),
  );
}

describe('true theorems never fail at a special position', () => {
  let positions = 0;
  for (const e of TRUE_THEOREMS.slice(0, lawCount(TRUE_THEOREMS.length))) {
    it(e.name, () => {
      const f = baseFigure();
      const id = e.build(f);
      const r = hunt(
        {
          kind: 'hunt',
          doc: f.doc,
          seed: 3,
          budget: { targets: 10, positions: 3, candidatesPerKind: 600, countLimit: 20_000 },
        },
        { registry: REGISTRY },
      );
      if (r.kind !== 'positions') throw new Error(r.kind);
      for (const p of r.positions) {
        positions++;
        const v = evalClaim(p.doc, id, REGISTRY);
        expect(v.value, `${e.name} at a position of object #${String(p.object)}`).not.toBe('false');
      }
    });
  }
  it('the hunt found positions to check', () => {
    expect(positions).toBeGreaterThan(lawCount(TRUE_THEOREMS.length));
  });
});

function findIn(e: Entry) {
  const f = baseFigure();
  const id = e.build(f);
  let o: ReturnType<typeof objectify> | undefined;
  try {
    o = objectify(f.doc, id);
  } catch {
    o = undefined; // a claim on an image of an Undefined map: no object to name
  }
  const doc = o?.doc ?? f.doc;
  const r = find(
    { kind: 'find', doc, seed: 5, budget: { n: 12, tests: 25, results: 200 } },
    { registry: REGISTRY },
  );
  if (r.kind !== 'found') throw new Error(r.kind);
  return { doc, r, key: o === undefined ? undefined : keyOf(o.kind, o.args) };
}

describe('the degenerate corpus never yields a reported fact', () => {
  for (const e of DEGENERATE_CLAIMS.slice(0, lawCount(DEGENERATE_CLAIMS.length))) {
    it(e.name, () => {
      const { doc, r, key } = findIn(e);
      if (key !== undefined) expect(r.facts.map((x) => x.key)).not.toContain(key);
      for (const x of r.facts) {
        const w = withFact(doc, x);
        expect(evalClaim(w.doc, w.id, REGISTRY).value).toBe('true');
      }
    });
  }
});

describe('a false claim is never reported as a fact', () => {
  for (const e of FALSE_CLAIMS.slice(0, 12)) {
    it(e.name, () => {
      const { r, key } = findIn(e);
      if (key !== undefined) expect(r.facts.map((x) => x.key)).not.toContain(key);
    });
  }
});
