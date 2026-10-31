/**
 * The style card's Name field (ADR-0046, completing ADR-0029): what "Write to script" applies
 * when the card changes the object's name, its style, or both, and why a typed name cannot be
 * written. Pure and DOM-free; the card (apps/web) only shows the results.
 *
 * - The name and the style are written as ONE edit: a batch of the kernel's rename and the
 *   style edit (one history entry, one undo). A name alone is a rename edit, a style alone the
 *   style edit the card wrote before (unchanged), nothing changed is no edit.
 * - The rename is the kernel's (renameObject through applyDocEdit): managed images follow
 *   their source (A* becomes P* when A becomes P, A** too), and claims, assumptions and layer
 *   exclusions refer to objects by id, so the text shows the new name everywhere.
 * - A typed name is validated by the very edit that would write it (the kernel's grammar,
 *   keyword, reserved-image and uniqueness checks), so the field refuses exactly what the
 *   write would refuse, with the same reason. Blanks around a name are not part of it.
 * - A managed image's name is fixed (it is its source's name and the rule's suffix): the field
 *   says why and what to rename instead.
 */
import { applyDocEdit } from '@geomira/kernel/doc-edit';
import { reservedName } from '@geomira/kernel/doc-edit';
import { sourceOf } from '@geomira/kernel/derived';
import { findObject, type Document, type Style } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { Edit } from './edit';

/** What the card would write: a typed name and a style draft, each absent when unchanged. */
export interface CardChange {
  readonly name?: string;
  readonly style?: Style;
}

/** The user object at the root of an image chain (X** → X* → X), or undefined. */
function origin(doc: Document, id: number): string | undefined {
  let o = findObject(doc, id);
  for (let guard = 0; o?.managedBy !== undefined && guard <= doc.objects.length; guard++)
    o = findObject(doc, sourceOf(o) ?? -1);
  return o?.managedBy === undefined ? o?.name : undefined;
}

/**
 * Why the name of object `id` cannot be changed, or undefined: a managed image is named by
 * its source and its rule ("A* is the image of A in layer inv: rename A"; for an image of an
 * image the user object at the root of the chain is the one to rename). Degenerate: a
 * missing object → undefined (nothing to say; the card of a missing object closes).
 */
export function fixedName(doc: Document, id: number): string | undefined {
  const o = findObject(doc, id);
  if (o?.managedBy === undefined) return undefined;
  const why = reservedName(doc, o.name) ?? `${o.name} is a managed image`;
  const root = origin(doc, id);
  return root === undefined ? why : `${why}: rename ${root}`;
}

/**
 * Why `typed` cannot be written as the name of object `id`, or undefined when it can (its
 * own name included). The reason is the kernel's own (applyDocEdit's rename: "the name B is
 * already used", "\"Ma\" is not a valid name: did you mean M_a?", "a name cannot be empty",
 * …), or fixedName's for a managed image. Degenerate: a missing object → the kernel's "there
 * is no object #id".
 */
export function cardNameProblem(
  doc: Document,
  registry: Registry,
  id: number,
  typed: string,
): string | undefined {
  const o = findObject(doc, id);
  const name = typed.trim();
  if (o !== undefined && name === o.name) return undefined;
  const fixed = fixedName(doc, id);
  if (fixed !== undefined) return fixed;
  const r = applyDocEdit(doc, registry, { kind: 'rename', id, name });
  return r.ok ? undefined : r.error;
}

/**
 * The one edit "Write to script" applies (see the module comment), or null when it would
 * change nothing. The name is trimmed; a name equal to the current one is no rename. The edit
 * is not validated here: applyEdit refuses it whole (the state unchanged) when the kernel
 * refuses the name, and the card offers Write only when cardNameProblem has nothing to say.
 */
export function cardEdit(doc: Document, id: number, change: CardChange): Edit | null {
  const o = findObject(doc, id);
  const name = change.name?.trim();
  const rename =
    name === undefined || name === o?.name ? [] : [{ kind: 'rename' as const, id, name }];
  const style =
    change.style === undefined ? [] : [{ kind: 'style' as const, id, style: change.style }];
  const [first, second] = [...rename, ...style];
  if (first === undefined) return null;
  if (second === undefined) return first;
  return {
    kind: 'batch',
    label: `rename ${o?.name ?? '?'} to ${name ?? '?'} and style`,
    edits: [first, second],
  };
}
