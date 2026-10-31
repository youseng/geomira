/**
 * The style card's Name field (ADR-0046), pure and DOM-free: what "Write to script" applies
 * when the card holds a typed name and a style draft, what the field says under it, and the
 * document the canvas previews. The decisions are the editor's (@geomira/editor/style-card:
 * one edit for name and style, the kernel's reasons, managed images fixed); this module only
 * combines them with the style draft (style-draft.ts).
 */
import type { Edit } from '@geomira/editor/edit';
import { cardEdit, cardNameProblem, fixedName } from '@geomira/editor/style-card';
import { applyDocEdit } from '@geomira/kernel/doc-edit';
import type { DocObject, Document, Style } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import { canWrite, withDraft } from './style-draft';

/** What the card offers for a typed name and a style draft. */
export interface CardWrite {
  /** The one edit "Write to script" applies; null disables the button. */
  readonly edit: Edit | null;
  /** The line under the Name field: why the typed name cannot be written, or why it is fixed. */
  readonly message: string | undefined;
  /** The name cannot change (a managed image): the field is read-only. */
  readonly fixed: boolean;
}

/**
 * The card's write: `typed` is the Name field's text (undefined while untouched: the object's
 * current name). A name with a problem disables Write, whatever the style draft holds (the
 * write is one edit: it applies whole or not at all).
 */
export function cardWrite(
  doc: Document,
  registry: Registry,
  o: DocObject,
  typed: string | undefined,
  draft: Style,
): CardWrite {
  const fixed = fixedName(doc, o.id);
  const problem = typed === undefined ? undefined : cardNameProblem(doc, registry, o.id, typed);
  const change = {
    ...(typed === undefined ? {} : { name: typed }),
    ...(canWrite(draft, o.style) ? { style: draft } : {}),
  };
  return {
    edit: problem === undefined ? cardEdit(doc, o.id, change) : null,
    message: problem ?? fixed,
    fixed: fixed !== undefined,
  };
}

/**
 * The document the canvas previews (no edit): the style draft over the object, and the typed
 * name when it can be written (the kernel's rename, so its images' labels follow too).
 */
export function previewDocument(
  doc: Document,
  registry: Registry,
  id: number,
  draft: Style,
  typed: string | undefined,
): Document {
  const styled = withDraft(doc, id, draft);
  if (typed === undefined || cardNameProblem(doc, registry, id, typed) !== undefined) return styled;
  const name = typed.trim();
  if (styled.objects.find((o) => o.id === id)?.name === name) return styled;
  const r = applyDocEdit(styled, registry, { kind: 'rename', id, name });
  return r.ok ? r.doc : styled;
}
