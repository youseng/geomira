/**
 * Creates the test worker of the site build: a separate module file next to the page, loaded
 * and cached like the page's own scripts. The single-file build replaces this module with
 * spawn-inline.ts (vite.config.ts), since a file opened from disk carries no second file.
 */
export function spawnTestWorker(): Worker {
  return new Worker(new URL('./test-worker.ts', import.meta.url), { type: 'module' });
}
