/**
 * Fixtures for the derived-layer tests (Run 4): documents built through applyDocEdit, with
 * invariants I1–I8 and the rules' sync (L13) checked after every edit.
 */
import { expect } from 'vitest';
import type { Document } from '../../src/document';
import { applyDocEdit, type Applied, type DocEdit } from '../../src/doc-edit';
import { syncProblems } from '../../src/derived';
import { call, type Expr, type RefExpr } from '../../src/expr';
import { assertInvariants } from '../../src/invariants';
import { Builder, REGISTRY, must, num } from './doc';

/** Applies an edit that must succeed; checks L7 and L13. */
export function ed(doc: Document, e: DocEdit): Document & { readonly applied: Applied } {
  const r = applyDocEdit(doc, REGISTRY, e);
  if (!r.ok) throw new Error(r.error);
  assertInvariants(r.doc);
  expect(syncProblems(r.doc, REGISTRY)).toEqual([]);
  const applied: Applied = {
    removed: r.removed,
    added: r.added,
    ...(r.id === undefined ? {} : { id: r.id }),
    ...(r.layerId === undefined ? {} : { layerId: r.layerId }),
  };
  return { ...r.doc, applied };
}

/** The error of an edit that must fail (the input stays valid). */
export function refused(doc: Document, e: DocEdit): string {
  const r = applyDocEdit(doc, REGISTRY, e);
  if (r.ok) throw new Error(`expected a refusal of ${e.kind}`);
  return r.error;
}

export function idOf(doc: Document, name: string): number {
  return must(
    doc.objects.find((o) => o.name === name),
    name,
  ).id;
}

export function refOf(doc: Document, name: string): RefExpr {
  return { kind: 'ref', id: idOf(doc, name) };
}

export function names(doc: Document): string[] {
  return doc.objects.map((o) => o.name);
}

export const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);

/** main: A, B, C, D; d = dist(A, B) (a number); k = 2 (a literal); s = spiral(A, B, C, D). */
export function base(): Document {
  const b = new Builder();
  const [A, B, C, D] = [
    b.point('A', 0, 0),
    b.point('B', 4, 0),
    b.point('C', 1, 3),
    b.point('D', 5, 2),
  ];
  b.add('d', T('dist', A, B));
  b.add('k', num(2));
  b.add('s', T('spiral', A, B, C, D));
  return b.doc;
}

/** base() plus the derived layer "img" = image(s, main). */
export function imaged(suffix?: string): { doc: Document; layer: string } {
  const doc = base();
  const r = applyDocEdit(doc, REGISTRY, {
    kind: 'addDerivedLayer',
    spec: {
      name: 'img',
      transform: idOf(doc, 's'),
      source: 'main',
      ...(suffix === undefined ? {} : { suffix }),
    },
  });
  if (!r.ok) throw new Error(r.error);
  assertInvariants(r.doc);
  return { doc: r.doc, layer: must(r.layerId) };
}
