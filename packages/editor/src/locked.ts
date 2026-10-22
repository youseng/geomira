/**
 * Locked layers (ADR-0020): an object in a locked layer cannot be dragged, edited or
 * removed through the GUI, no object can be added to a locked layer that way, and a locked
 * derived layer's rule cannot be changed. The text is exempt (replaceText: the text panel
 * and the command bar write the document as text), and so are undo and redo (they restore
 * documents exactly, L6). The check compares the document before and after a GUI edit, so
 * it covers every way an edit reaches a locked object: directly, by a cascade of removed
 * dependents, by moving it to another layer, or by removing its layer.
 *
 * An object is locked when one of its layers is locked. Managed images are never locked
 * themselves: they follow their rule, which the lock of their (derived) layer protects.
 */
import { findObject, type DocObject, type Document, type Layer } from '@geomira/kernel/document';

/** The locked layer `o` belongs to (the first, in layer order), or undefined. */
export function lockOf(doc: Document, o: DocObject): Layer | undefined {
  if (o.managedBy !== undefined) return undefined;
  return doc.layers.find((l) => l.locked && o.layers.includes(l.id));
}

/** Structural equality of document data (bigints of exact literals included). */
function same(a: unknown, b: unknown): boolean {
  const text = (x: unknown) =>
    JSON.stringify(x, (_k, v: unknown) => (typeof v === 'bigint' ? `${v.toString()}n` : v));
  return text(a) === text(b);
}

function changed(o: DocObject, now: DocObject): boolean {
  return (
    now.name !== o.name ||
    !same(now.def, o.def) ||
    !same(now.style, o.style) ||
    !same(now.layers, o.layers)
  );
}

/** Why the GUI edit from `before` to `after` touches something locked, or undefined. */
export function lockedChange(before: Document, after: Document): string | undefined {
  for (const l of before.layers) {
    if (!l.locked || l.rule === undefined) continue;
    const now = after.layers.find((x) => x.id === l.id);
    if (now === undefined || !same(now.rule, l.rule))
      return `the layer ${l.name} is locked: unlock it to change its rule`;
  }
  for (const o of before.objects) {
    const lock = lockOf(before, o);
    if (lock === undefined) continue;
    const now = findObject(after, o.id);
    if (now === undefined)
      return `${o.name} is in the locked layer ${lock.name}: unlock the layer to remove it`;
    if (changed(o, now))
      return `${o.name} is in the locked layer ${lock.name}: unlock the layer to change it`;
  }
  const old = new Set(before.objects.map((o) => o.id));
  for (const o of after.objects) {
    if (old.has(o.id)) continue;
    const lock = lockOf(after, o);
    if (lock !== undefined)
      return `the layer ${lock.name} is locked: unlock it to add objects to it`;
  }
  return undefined;
}

/** Why a drag of `ids` (the dragged object, then the object it rewrites) is refused. */
export function lockedDrag(doc: Document, ids: readonly number[]): string | undefined {
  for (const id of ids) {
    const o = findObject(doc, id);
    const lock = o === undefined ? undefined : lockOf(doc, o);
    if (o !== undefined && lock !== undefined)
      return `${o.name} is in the locked layer ${lock.name}: unlock the layer to drag it`;
  }
  return undefined;
}
