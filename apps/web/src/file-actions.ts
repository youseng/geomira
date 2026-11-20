/** File operations coordinate the shared draft and transactional recovery, never the filesystem. */
import { type PortableDocument, printPortable } from '@geomira/lang/portable';
import { hasEdits, isStale } from '@geomira/editor/text-draft';
import { downloadableGeo, downloadGeo, downloadText } from './backup';
import { namedDocument } from './document-file';
import type { EditorStore } from './store';

export function draftIssue(store: EditorStore): string | null {
  const draft = store.textDraft;
  if (!hasEdits(draft.getSnapshot())) return null;
  if (draft.hasErrors())
    return 'The visible text draft has errors. It is not the current valid figure.';
  if (isStale(draft.getSnapshot(), store.current().doc))
    return 'The visible text draft belongs to an older figure. Choose whether to apply or discard it.';
  return null;
}
export function applyValidDraft(store: EditorStore): void {
  const issue = draftIssue(store);
  if (issue !== null) throw new Error(issue);
  store.textDraft.applyNow();
}
export function downloadDraft(store: EditorStore): void {
  downloadText(store.textDraft.getSnapshot().text, 'geomira-draft.txt');
}
export function downloadFigure(store: EditorStore): string {
  downloadGeo(store.document());
  return printPortable(store.document());
}
export async function replaceDocument(
  store: EditorStore,
  doc: PortableDocument,
  discardUnsaved: boolean,
  mayReplace: () => boolean = () => true,
): Promise<boolean> {
  if (store.writeUpComposing)
    throw new Error('Finish composing the write-up before switching documents.');
  const before = store.getSnapshot();
  const saved = await store.retrySaving();
  if (!mayReplace()) return false;
  if (!store.canReplace(before))
    throw new Error('The figure changed. Review it before replacing it.');
  if (!saved && !discardUnsaved) return false;
  store.open(doc, 'file', null, false);
  store.textDraft.revert();
  return true;
}
export async function duplicateDocument(
  store: EditorStore,
  name: string,
  discardUnsaved: boolean,
  mayReplace: () => boolean = () => true,
): Promise<boolean> {
  const duplicate = namedDocument(store.document(), name);
  if (duplicate.writeUp) downloadableGeo(duplicate);
  if (!(await replaceDocument(store, duplicate, discardUnsaved, mayReplace))) return false;
  downloadGeo(store.document());
  return true;
}
