/**
 * The page's effects, each small: startup (share link or autosave, SPEC §12), autosave
 * after edits, keyboard shortcuts (from the editor's keymap), fitting the view when a
 * document opens, and internal errors (note D).
 */
import { useEffect, useRef } from 'react';
import { keyAction, type KeyAction, type KeyEventLike } from '@geomira/editor/keymap';
import { openAtStartup } from '@geomira/editor/restore';
import { decodeShare, SHARE_PREFIX } from '@geomira/editor/share';
import { emptyDocument } from '@geomira/kernel/document';
import { print } from '@geomira/lang/print';
import { assertNever } from '@geomira/num/assert';
import type { Scene } from '@geomira/scene/types';
import type { Size } from '@geomira/scene/viewport';
import { FIT_MARGIN, viewportFor, WIDE_FIT_MARGIN } from './figure';
import { readSlots } from './persist';
import type { EditorStore, Notice, Snapshot } from './store';

/** Autosave this long after the last change (ms). */
export const AUTOSAVE_MS = 200;

/** The phone layout's breakpoint (phone.css). */
const PHONE = '(max-width: 760px)';

/** The fit margin of the current layout (figure.ts WIDE_FIT_MARGIN). */
export function fitMargin(): number {
  return typeof matchMedia === 'function' && !matchMedia(PHONE).matches
    ? WIDE_FIT_MARGIN
    : FIT_MARGIN;
}

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

/**
 * A share link opened while the page runs (hashchange): it replaces the figure, so the test
 * runs of the old figure are forgotten (as when an example opens). The notice, if any.
 */
export function openLaterLink(
  store: EditorStore,
  runs: { clear(): void },
  hash: string,
): Notice | null {
  const l = openLink(store, hash);
  if (l.opened) runs.clear();
  return l.notice;
}

/** Startup: a valid share link, else the autosave, else a new figure; later links too. */
export function useStartup(store: EditorStore, runs: { clear(): void }, onReady: () => void): void {
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
      const notice = openLaterLink(store, runs, location.hash);
      if (notice !== null) store.setNotice(notice);
    };
    addEventListener('hashchange', onHash);
    return () => {
      removeEventListener('hashchange', onHash);
    };
  }, [store, runs, onReady]);
}

/**
 * Saves the figure after changes (the policy is packages/editor's); a link's hash goes once
 * edited. The save waits AUTOSAVE_MS after the last change; it runs at once when another
 * figure opens (store.ts) or the page hides (ADR-0028).
 */
export function useAutosave(store: EditorStore, snap: Snapshot, ready: boolean): void {
  const doc = snap.state.doc;
  useEffect(() => {
    if (!ready) return;
    // The hash of this figure: a link opened later is not removed by this figure's save.
    const hash = location.hash;
    store.autosave.schedule(() => {
      store.autosave.save(print(doc));
      if (store.autosave.wasEdited() && hash.startsWith(SHARE_PREFIX) && location.hash === hash)
        history.replaceState(null, '', location.pathname + location.search);
    }, AUTOSAVE_MS);
  }, [store, doc, ready]);
  useEffect(() => flushWhenHidden(store.autosave, window, document), [store]);
}

/** Runs the pending save when the page hides (pagehide, or hidden); returns the unsubscribe. */
export function flushWhenHidden(
  autosave: { flush(): void },
  win: EventTarget,
  doc: EventTarget & { readonly visibilityState: string },
): () => void {
  const flush = () => {
    autosave.flush();
  };
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') autosave.flush();
  };
  win.addEventListener('pagehide', flush);
  doc.addEventListener('visibilitychange', onVisibility);
  return () => {
    win.removeEventListener('pagehide', flush);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}

/**
 * What a key event's target is to the shortcuts: a `field` takes every key (typing); a
 * `control` (button, link, tab, …) takes Enter and Space, which activate it; `other` none.
 */
export type KeyTarget = 'field' | 'control' | 'other';

/** The roles and elements that Enter or Space activate. */
const CONTROLS =
  'button, a[href], summary, [role="button"], [role="tab"], [role="link"], [role="menuitem"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"]';

function keyTarget(target: EventTarget | null): KeyTarget {
  if (!(target instanceof HTMLElement)) return 'other';
  if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    return 'field';
  return target.closest(CONTROLS) === null ? 'other' : 'control';
}

/** The shortcut of a key on a target of kind `target`, if it is one (ADR-0028). */
export function shortcutFor(e: KeyEventLike, target: KeyTarget): KeyAction | undefined {
  switch (target) {
    case 'field':
      return undefined;
    case 'control':
      return e.key === 'Enter' || e.key === ' ' ? undefined : keyAction(e);
    case 'other':
      return keyAction(e);
    default:
      return assertNever(target, 'key target');
  }
}

/** Keyboard shortcuts (never while typing in a field, nor Enter or Space on a control). */
export function useShortcuts(perform: (a: KeyAction) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = shortcutFor(
        { key: e.key, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey },
        keyTarget(e.target),
      );
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
    store.apply({
      kind: 'viewport',
      viewport: viewportFor({ doc, scene: sceneOf() }, size, fitMargin()),
    });
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
