/**
 * What this copy of the app is and how it runs (Run 12): its build, whether it works offline
 * (the PWA's service worker, or the single file that needs no network), and where claim tests
 * run (a Web Worker, or the page itself in short slices when workers are unavailable). The Help
 * panel shows it; the version banner offers a new version of the site when one has installed.
 */
import { createContext, useContext, useSyncExternalStore } from 'react';
import { assertNever } from '@geomira/num/assert';
import { BUILD, SINGLE_FILE } from './build-info';
import type { OfflineStatus, Pwa } from './pwa';
import type { Runner, TestHost } from './worker/host';

export interface AboutValue {
  readonly pwa: Pwa;
  readonly host: TestHost;
}

export const AboutContext = createContext<AboutValue | null>(null);

/** Stores of nothing, for a page rendered without the context (tests). */
const NONE = {
  subscribe: (): (() => void) => () => undefined,
  current: (): null => null,
};

/** The offline line of the Help panel. */
export function offlineText(s: OfflineStatus): string {
  switch (s.kind) {
    case 'unavailable':
      return `Offline: ${s.reason}.`;
    case 'installing':
      return 'Offline: saving the app for offline use…';
    case 'ready':
      return 'Offline: ready. This site opens and works without a network from now on.';
    case 'failed':
      return `Offline: not available (${s.reason}).`;
    default:
      return assertNever(s, 'offline status');
  }
}

/** The test-runner line of the Help panel. */
export function runnerText(r: Runner): string {
  switch (r.kind) {
    case 'idle':
    case 'starting':
      return 'Tests: starting the background worker.';
    case 'worker':
      return 'Tests: run in a background worker.';
    case 'page':
      return `Tests: run on this page in short slices, since workers are unavailable (${r.reason}).`;
    default:
      return assertNever(r, 'runner');
  }
}

/** "About this copy" in the Help panel. */
export function AboutSection() {
  const about = useContext(AboutContext);
  const pwa = about?.pwa ?? NONE;
  const state = useSyncExternalStore(pwa.subscribe, pwa.current, pwa.current);
  const host = about?.host;
  const runnerOf = () => host?.runner() ?? null;
  const runner = useSyncExternalStore(host?.subscribe ?? NONE.subscribe, runnerOf, runnerOf);
  return (
    <section className="about" aria-label="About this copy">
      <h3>About this copy</h3>
      <p>
        Geomira build <code data-testid="build">{BUILD}</code>
        {SINGLE_FILE ? ', the single-file copy' : ''}.
      </p>
      {state !== null && <p data-testid="offline">{offlineText(state.offline)}</p>}
      {runner !== null && (
        <p data-testid="runner" data-runner={runner.kind}>
          {runnerText(runner)}
        </p>
      )}
    </section>
  );
}

/** The version banner: a new version of the site has installed and waits for a reload. */
export function UpdateBanner({ onReload }: { onReload: () => void }) {
  const about = useContext(AboutContext);
  const pwa = about?.pwa ?? NONE;
  const state = useSyncExternalStore(pwa.subscribe, pwa.current, pwa.current);
  if (about === null || state === null || state.update === null) return null;
  return (
    <div className="notice notice-info update-banner" role="status" aria-label="New version">
      <div className="notice-text">
        A new version of Geomira is available (build {state.update.build}; this page runs build{' '}
        {BUILD}). Reloading keeps your figure.
      </div>
      <button type="button" className="small-tb tb" onClick={onReload}>
        Reload to update
      </button>
      <button
        type="button"
        className="small-tb tb"
        onClick={() => {
          about.pwa.dismiss();
        }}
      >
        Later
      </button>
    </div>
  );
}
