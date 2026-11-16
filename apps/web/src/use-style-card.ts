import { useCallback, useEffect, useRef, useState } from 'react';
import type { Style } from '@geomira/kernel/document';
import type { Box } from './card-place';
import type { EditorStore } from './store';
import { sameStyle } from './style-draft';
import { cardWrite } from './style-name';

function commitPendingName(store: EditorStore, c: OpenCard | null): void {
  if (c?.name === undefined) return;
  const doc = store.current().doc;
  const o = doc.objects.find((x) => x.id === c.id);
  if (o === undefined) return;
  const write = cardWrite(doc, store.env.registry, o, c.name, o.style);
  if (write.edit !== null) store.apply(write.edit);
  else if (write.message !== undefined)
    store.setNotice({
      tone: 'refusal',
      text: `Name “${c.name}” was not applied: ${write.message}`,
    });
}

/** The open card: its object, where it was opened, the style it shows, and the typed name. */
export interface OpenCard {
  readonly id: number;
  readonly anchor: Box;
  readonly draft: Style;
  /** The Name field's text; absent while untouched (the field shows the current name). */
  readonly name?: string;
}

/** The card's state: open (on an object, next to an anchor), the draft, the name, close. */
export function useStyleCard(store: EditorStore) {
  const [card, setCard] = useState<OpenCard | null>(null);
  const current = useRef<OpenCard | null>(null);
  const update = useCallback((next: OpenCard | null) => {
    current.current = next;
    setCard(next);
  }, []);
  const commitName = useCallback(() => {
    commitPendingName(store, current.current);
  }, [store]);
  const open = useCallback(
    (id: number, anchor: Box) => {
      if (current.current?.id === id) return;
      commitName();
      const o = store.current().doc.objects.find((x) => x.id === id);
      if (o === undefined) return;
      update({ id, anchor, draft: o.style });
      store.apply({ kind: 'select', ids: [id], mode: 'replace' });
    },
    [store, commitName, update],
  );
  useEffect(
    () =>
      store.subscribe(() => {
        const c = current.current;
        if (c === null) return;
        const o = store.current().doc.objects.find((x) => x.id === c.id);
        if (o !== undefined && !sameStyle(o.style, c.draft)) update({ ...c, draft: o.style });
      }),
    [store, update],
  );
  const close = useCallback(() => {
    commitName();
    update(null);
  }, [commitName, update]);
  const setDraft = useCallback(
    (draft: Style) => {
      const c = current.current;
      if (c !== null) update({ ...c, draft });
    },
    [update],
  );
  const setName = useCallback(
    (name: string | undefined) => {
      const c = current.current;
      if (c === null) return;
      const rest = { id: c.id, anchor: c.anchor, draft: c.draft };
      update(name === undefined ? rest : { ...rest, name });
    },
    [update],
  );
  return { card, open, close, setDraft, setName };
}
