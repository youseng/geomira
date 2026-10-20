/**
 * Comments (ADR-0009). A comment line belongs to the next statement that has a place in
 * the document (an object, claim, assumption, layer, view, the title, author or viewport
 * directive; `@version` → the header); a same-line comment is that statement's inline
 * comment. Comments of `style X` / `label X` lines go to X. Comments with nowhere to go
 * (before lines that are not applied, or at the end) move on to the next such statement,
 * or to the end of the document.
 */
import type { Comment, CommentAnchor } from '@geomira/kernel/document';

export interface CommentBook {
  readonly entries: Map<string, { anchor: CommentAnchor; lines: string[]; inline?: string }>;
  /** Lines waiting for the next anchored statement. */
  carry: string[];
}

export function newBook(): CommentBook {
  return { entries: new Map(), carry: [] };
}

export function anchorKey(a: CommentAnchor): string {
  switch (a.kind) {
    case 'object':
    case 'claim':
    case 'assumption':
    case 'layer':
      return `${a.kind}:${String(a.id)}`;
    case 'view':
      return `view:${a.name}`;
    case 'header':
    case 'title':
    case 'author':
    case 'viewport':
    case 'end':
      return a.kind;
    default:
      return 'end';
  }
}

/** Attaches leading lines and an inline comment to an anchor (merging with what it has). */
export function attach(
  book: CommentBook,
  anchor: CommentAnchor,
  lines: readonly string[],
  inline: string | undefined,
): void {
  if (lines.length === 0 && inline === undefined) return;
  const key = anchorKey(anchor);
  const e = book.entries.get(key) ?? { anchor, lines: [] };
  e.lines.push(...lines);
  if (inline !== undefined) {
    if (e.inline === undefined) e.inline = inline;
    else e.lines.push(inline);
  }
  book.entries.set(key, e);
}

/** A line whose statement has no anchor: its comments wait for the next one. */
export function defer(
  book: CommentBook,
  lines: readonly string[],
  inline: string | undefined,
): void {
  book.carry.push(...lines, ...(inline === undefined ? [] : [inline]));
}

/** Takes the waiting lines. */
export function take(book: CommentBook): string[] {
  const lines = book.carry;
  book.carry = [];
  return lines;
}

/** The comments of the document (the carry goes to the end). */
export function finish(book: CommentBook): Comment[] {
  attach(book, { kind: 'end' }, take(book), undefined);
  return [...book.entries.values()].map((e) =>
    e.inline === undefined
      ? { anchor: e.anchor, lines: e.lines }
      : { anchor: e.anchor, lines: e.lines, inline: e.inline },
  );
}
