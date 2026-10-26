/**
 * Renaming a view (SPEC §8.3; the views UI of v1.1, Run 13). Internal: reached through the
 * DocEdit `renameView` (doc-edit.ts); views.ts keeps its frozen surface. Comments anchored
 * to the view (ADR-0009 decision 13: a view's comments are anchored by its name) follow it.
 */
import type { Comment, Document } from './document';
import { fail, type EditResult } from './edit';
import { nameProblem } from './names';

/**
 * Renames the view `from` to `to`. Degenerate cases: no view `from` → error; `to` not
 * grammatical → error (the names rule of every name, names.ts); `to` the name of another
 * view → error; `to` equal to `from` → the document unchanged (the very same object).
 */
export function renameView(doc: Document, from: string, to: string): EditResult {
  const view = doc.views.find((v) => v.name === from);
  if (view === undefined) return fail(`there is no view "${from}"`);
  if (to === from) return { ok: true, doc };
  const problem = nameProblem(to);
  if (problem !== undefined) return fail(problem);
  if (doc.views.some((v) => v.name === to)) return fail(`the view name ${to} is already used`);
  const views = doc.views.map((v) => (v.name === from ? { ...v, name: to } : v));
  const comments = doc.meta.comments;
  if (comments === undefined) return { ok: true, doc: { ...doc, views } };
  const moved = comments.map((c): Comment =>
    c.anchor.kind === 'view' && c.anchor.name === from
      ? { ...c, anchor: { kind: 'view', name: to } }
      : c,
  );
  return { ok: true, doc: { ...doc, views, meta: { ...doc.meta, comments: moved } } };
}
