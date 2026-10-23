/**
 * Found in the pre-beta review (bug-fix round, ADR-0028): ADR-0007 decision 11 says a rule's
 * transformation cannot be redefined as something that is not one, but applyDocEdit only
 * checked a redefinition of the rule's transform object itself. Through an alias
 * (s = homothety(O, 2), t = s, a layer image(t, main)) redefining s := point(5, 5) was
 * accepted, t became a point, and every image was Undefined. Every rule's transformation is
 * now re-checked after any edit, and an edit that stops it being one is refused.
 */
import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../src/invariants';
import { syncProblems } from '../src/derived';
import type { Document } from '../src/document';
import { REGISTRY, num, pt } from './helpers/doc';
import { T, ed, idOf, names, refOf, refused } from './helpers/derived-fixture';
import { emptyDocument } from '../src/document';

/** A, B, O; s = homothety(O, 2); t = s; u = t; layer img = image(u, main). */
function aliased(): Document {
  let doc = emptyDocument();
  doc = ed(doc, { kind: 'add', object: { name: 'A', def: pt(0, 0) } });
  doc = ed(doc, { kind: 'add', object: { name: 'B', def: pt(4, 0) } });
  doc = ed(doc, { kind: 'add', object: { name: 'O', def: pt(1, 1) } });
  doc = ed(doc, {
    kind: 'add',
    object: { name: 's', def: T('homothety', refOf(doc, 'O'), num(2)) },
  });
  doc = ed(doc, { kind: 'add', object: { name: 't', def: refOf(doc, 's') } });
  doc = ed(doc, { kind: 'add', object: { name: 'u', def: refOf(doc, 't') } });
  return ed(doc, {
    kind: 'addDerivedLayer',
    spec: { name: 'img', transform: idOf(doc, 'u'), source: 'main' },
  });
}

describe("a rule's transformation stays one under every edit", () => {
  it('redefining what the transformation is an alias of, as a non-map, is refused', () => {
    const doc = aliased();
    expect(names(doc)).toEqual(['A', 'B', 'O', 's', 't', 'u', 'A*', 'B*', 'O*']);
    const why = 'u is the transformation of layer img: the edit would make it not a transformation';
    expect(refused(doc, { kind: 'redefine', id: idOf(doc, 's'), def: pt(5, 5) })).toBe(why);
    expect(refused(doc, { kind: 'redefine', id: idOf(doc, 't'), def: num(3) })).toBe(why);
    expect(
      refused(doc, {
        kind: 'redefine',
        id: idOf(doc, 's'),
        def: T('reflect', refOf(doc, 'A'), refOf(doc, 'B')),
      }),
    ).toBe(why);
    // A direct redefinition keeps its message.
    expect(refused(doc, { kind: 'redefine', id: idOf(doc, 'u'), def: pt(5, 5) })).toBe(
      'u is the transformation of layer img',
    );
  });

  it('redefining it as another map is accepted, and the images follow', () => {
    const doc = aliased();
    const r = ed(doc, {
      kind: 'redefine',
      id: idOf(doc, 's'),
      def: T('rotate', refOf(doc, 'O'), num(90)),
    });
    expect(names(r)).toEqual(names(doc));
    expect(checkInvariants(r)).toEqual([]);
    expect(syncProblems(r, REGISTRY)).toEqual([]);
  });

  it('a rule that was already broken does not block unrelated edits', () => {
    // A hand-built document can hold a rule whose transformation is not one (Run 2's
    // fixtures do); only an edit that breaks a working rule is refused.
    const doc = aliased();
    const layers = doc.layers.map((l) =>
      l.rule === undefined ? l : { ...l, rule: { ...l.rule, transform: refOf(doc, 'A') } },
    );
    const broken: Document = { ...doc, layers };
    const r = ed(broken, { kind: 'add', object: { name: 'E', def: pt(7, 7) } });
    expect(names(r)).toContain('E');
  });
});
