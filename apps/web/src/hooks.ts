/**
 * The page's effects, each small: startup (share link or autosave, SPEC §12), autosave
 * after edits, keyboard shortcuts (from the editor's keymap), fitting the view when a
 * document opens, and internal errors (note D).
 */
import { useEffect, useRef } from 'react';
import { keyAction, type KeyAction } from '@geomira/editor/keymap';
import { openAtStartup } from '@geomira/editor/restore';
import { decodeShare, SHARE_PREFIX } from '@geomira/editor/share';
import { emptyDocument } from '@geomira/kernel/document';
import { print } from '@geomira/lang/print';
import type { Scene } from '@geomira/scene/types';
import type { Size } from '@geomira/scene/viewport';
import { viewportFor } from './figure';
import { readSlots } from './persist';
import type { EditorStore, Notice, Snapshot } from './store';

/** Autosave this long after the last change (ms). */
export const AUTOSAVE_MS = 200;

/** Opens the share link of the URL, if any: whether one was opened, and why not. */
function openLink(store: EditorStore, hash: string): { opened: boolean; notice: Notice | null } {
  if (!hash.startsWith(SHARE_PREFIX)) return { opened: false, notice: null };
  const r = decodeShare(hash, store.env.registry);
  if (r.ok) {
    store.openText(r.text, 'link');
    return { opened: true, notice: null };
  }
  const d = r.diagnostics === undefined ? {} : { diagnostics: r.diagnostics };
  return {
    opened: false,
    notice: { tone: 'error', text: `The link could not be opened: ${r.reason}.`, ...d },
  };
}

/** Startup: a valid share link, else the autosave, else a new figure; later links too. */
export function useStartup(store: EditorStore, onReady: () => void): void {
  useEffect(() => {
    const link = openLink(store, location.hash);
    if (!link.opened) {
      const start = openAtStartup(readSlots(), null);
      if (start.text === null) store.open(emptyDocument(), 'new');
      else store.openText(start.text, start.origin);
      // After the figure that opened instead, so its own notice does not hide the link's.
      if (link.notice !== null) store.setNotice(link.notice);
    }
    onReady();
    const onHash = () => {
      const l = openLink(store, location.hash);
      if (l.notice !== null) store.setNotice(l.notice);
    };
    addEventListener('hashchange', onHash);
    return () => {
      removeEventListener('hashchange', onHash);
    };
  }, [store, onReady]);
}

/** Saves the figure after changes (the policy is packages/editor's); a link's hash goes once edited. */
export function useAutosave(store: EditorStore, snap: Snapshot, ready: boolean): void {
  const doc = snap.state.doc;
  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => {
      store.autosave.save(print(doc));
      if (store.autosave.wasEdited() && location.hash.startsWith(SHARE_PREFIX))
        history.replaceState(null, '', location.pathname + location.search);
    }, AUTOSAVE_MS);
    return () => {
      clearTimeout(t);
    };
  }, [store, doc, ready]);
}

function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Keyboard shortcuts (never while typing in a field). */
export function useShortcuts(perform: (a: KeyAction) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const a = keyAction({
        key: e.key,
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
      });
      if (a === undefined) return;
      e.preventDefault();
      perform(a);
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
    };
  }, [perform]);
}

/** Fits the view whenever a document opens (once the canvas has a size). */
export function useFitOnOpen(
  store: EditorStore,
  openCount: number,
  size: Size | null,
  sceneOf: () => Scene,
): void {
  const fitted = useRef(0);
  useEffect(() => {
    // Only a newly opened document is fitted (once the canvas has a size); edits keep the view.
    if (size === null || openCount === fitted.current) return;
    fitted.current = openCount;
    const doc = store.current().doc;
    store.apply({ kind: 'viewport', viewport: viewportFor({ doc, scene: sceneOf() }, size) });
  }, [store, openCount, size, sceneOf]);
}

/** Uncaught errors of the page become internal-error messages with the debug report. */
export function useInternalErrors(report: (message: string) => void): void {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      report(e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      report(e.reason instanceof Error ? e.reason.message : String(e.reason));
    };
    addEventListener('error', onError);
    addEventListener('unhandledrejection', onRejection);
    return () => {
      removeEventListener('error', onError);
      removeEventListener('unhandledrejection', onRejection);
    };
  }, [report]);
}
