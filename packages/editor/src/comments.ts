/**
 * The text form of a document's comments (law L5). The printer writes a comment whose anchor
 * is gone (an object, claim, assumption, layer or view an edit removed; a title, author or
 * viewport that was cleared) at the end of the text, and parsing reads it back as an end
 * comment. Left in place, such a document did not come back from its own text (Run 10 audit:
 * removing a commented object broke L5, and a removed view's comment came back on a new view of
 * the same name). The editor keeps every document in this form: orphaned comments join the end
 * comment, in the order the printer writes them, so the text is unchanged.
 */
import type { Comment, CommentAnchor, Document } from '@geomira/kernel/document';
import { assertNever } from '@geomira/num/assert';

function live(doc: Document, a: CommentAnchor): boolean {
  switch (a.kind) {
    case 'object':
      return doc.objects.some((o) => o.id === a.id);
    case 'claim':
      return doc.claims.some((c) => c.id === a.id);
    case 'assumption':
      return doc.assumptions.some((c) => c.id === a.id);
    case 'layer':
      return doc.layers.some((l) => l.id === a.id);
    case 'view':
      return doc.views.some((v) => v.name === a.name);
    case 'title':
      return doc.meta.title !== undefined;
    case 'author':
      return doc.meta.author !== undefined;
    case 'viewport':
      return doc.viewport !== null;
    case 'header':
    case 'end':
      return true;
    default:
      return assertNever(a, 'comment anchor');
  }
}

/** A comment's printed lines (its lines, then its same-line comment), one per text line. */
function printedLines(c: Comment): string[] {
  return [...c.lines, ...(c.inline === undefined ? [] : [c.inline])].flatMap((l) => l.split('\n'));
}

/** The document with orphaned comments moved to the end (the same document when none is). */
export function textComments(doc: Document): Document {
  const comments = doc.meta.comments ?? [];
  if (comments.every((c) => live(doc, c.anchor))) return doc;
  const kept = comments.filter((c) => c.anchor.kind !== 'end' && live(doc, c.anchor));
  const end = [
    ...comments.filter((c) => c.anchor.kind !== 'end' && !live(doc, c.anchor)),
    ...comments.filter((c) => c.anchor.kind === 'end'),
  ].flatMap(printedLines);
  const all: Comment[] =
    end.length === 0 ? kept : [...kept, { anchor: { kind: 'end' }, lines: end }];
  return { ...doc, meta: { ...doc.meta, comments: all } };
}
