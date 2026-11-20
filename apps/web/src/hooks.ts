import { actionAvailable } from './available-tools';
/**
 * The page's effects, each small: startup (share link or autosave, SPEC §12), autosave
 * after edits, keyboard shortcuts (from the editor's keymap), fitting the view when a
 * document opens, and internal errors (note D).
 */
import { useEffect, useRef } from 'react';
import { keyAction, type KeyAction, type KeyEventLike } from '@geomira/editor/keymap';
import { decodeShare, SHARE_PREFIX } from '@geomira/editor/share';
import { emptyDocument } from '@geomira/kernel/document';
import { assertNever } from '@geomira/num/assert';
import type { Scene } from '@geomira/scene/types';
import type { Size } from '@geomira/scene/viewport';
import { FIT_MARGIN, viewportFor, WIDE_FIT_MARGIN } from './figure';
import { watchRecovery } from './watch-recovery';
import { modalOwnsInteraction } from './Modal';
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
    let active = true;
    const initial = store.current();
    const openCount = store.getSnapshot().openCount;
    void store.autosave.initialize().then((text) => {
      if (!active) return;
      // Startup I/O must never replace figure edits, a raw draft or an active composition.
      // Loaded versions remain in Recovery when the current editing session wins.
      if (
        store.writeUpComposing ||
        store.getSnapshot().writeUpRevision > 0 ||
        store.current().doc !== initial.doc ||
        store.current().tool !== initial.tool ||
        store.current().toolState !== initial.toolState ||
        store.textDraft.unappliedText() !== null ||
        store.getSnapshot().openCount !== openCount
      ) {
        onReady();
        return;
      }
      const link = openLink(store, location.hash);
      if (!link.opened) {
        if (text === null) store.open(emptyDocument(), 'new');
        else store.openText(text, 'autosave');
        if (link.notice !== null) store.setNotice(link.notice);
      }
      onReady();
    });
    const onHash = () => {
      const hash = location.hash;
      if (hash.startsWith(SHARE_PREFIX))
        store.beforeBrowse(() => {
          const notice = openLaterLink(store, runs, hash);
          if (notice !== null) store.setNotice(notice);
        });
    };
    addEventListener('hashchange', onHash);
    return () => {
      active = false;
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
    if (!ready || snap.state.drag !== null) return;
    // The hash of this figure: a link opened later is not removed by this figure's save.
    const hash = location.hash;
    store.autosave.schedule(() => {
      store.saveSettled();
      if (store.autosave.wasEdited() && hash.startsWith(SHARE_PREFIX) && location.hash === hash)
        history.replaceState(null, '', location.pathname + location.search);
    }, AUTOSAVE_MS);
  }, [store, doc, ready, snap.state.drag, snap.writeUpRevision]);
  useEffect(() => watchRecovery(store, window, document), [store]);
}

export { flushWhenHidden } from './save-lifecycle';

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
      if (e.defaultPrevented || modalOwnsInteraction()) return;
      const a = shortcutFor(
        { key: e.key, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey },
        keyTarget(e.target),
      );
      if (a === undefined || !actionAvailable(a)) return;
      e.preventDefault();
      perform(a);
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
    };
  }, [perform]);
}

/**
 * Fits the view whenever a document opens or a fit is asked for (store.fits), once the canvas
 * has a size.
 */
export function useFitOnOpen(
  store: EditorStore,
  fits: number,
  size: Size | null,
  sceneOf: () => Scene,
): void {
  const fitted = useRef(0);
  useEffect(() => {
    // Only a newly opened document is fitted (once the canvas has a size); edits keep the view.
    if (size === null || fits === fitted.current) return;
    fitted.current = fits;
    const doc = store.current().doc;
    store.apply({
      kind: 'viewport',
      viewport: viewportFor({ doc, scene: sceneOf() }, size, fitMargin()),
    });
  }, [store, fits, size, sceneOf]);
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
