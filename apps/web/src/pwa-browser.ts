/**
 * The PWA in the browser (Run 12): the service worker container of the site build, or why this
 * copy has none, and the moment it registers (after the page has loaded, so the first visit's
 * startup does not compete with caching the files).
 */
import { SINGLE_FILE } from './build-info';
import { askVersion, Pwa, type PwaEnv } from './pwa';

function container(): PwaEnv['container'] {
  if (typeof location === 'undefined' || typeof navigator === 'undefined')
    return { unavailable: 'no browser page' };
  if (SINGLE_FILE || location.protocol === 'file:')
    return { unavailable: 'this is the single-file copy, which needs no network: keep the file' };
  if (!import.meta.env.PROD)
    return { unavailable: 'the development server registers no service worker' };
  if (!('serviceWorker' in navigator))
    return { unavailable: 'this browser offers no service worker to this page' };
  return navigator.serviceWorker;
}

export function browserPwa(): Pwa {
  const base = import.meta.env.BASE_URL;
  return new Pwa({
    container: container(),
    swUrl: `${base}sw.js`,
    scope: base,
    askVersion,
    reload: () => {
      location.reload();
    },
  });
}

/** Registers once the page has loaded; looks for a new version whenever the page is shown again. */
export function startPwa(pwa: Pwa, win: Window, doc: Document): () => void {
  const start = () => {
    void pwa.start();
  };
  const visible = () => {
    if (doc.visibilityState === 'visible') pwa.checkForUpdate();
  };
  if (doc.readyState === 'complete') start();
  else win.addEventListener('load', start, { once: true });
  doc.addEventListener('visibilitychange', visible);
  return () => {
    win.removeEventListener('load', start);
    doc.removeEventListener('visibilitychange', visible);
  };
}
