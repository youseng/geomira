/**
 * Creates the test worker of the single-file build (Run 12): Vite inlines the worker's whole
 * bundle into the page and starts it from a blob: URL (falling back to a data: URL), so the
 * page needs no second file. Where the browser refuses both, the host runs the tests on the
 * page itself (host.ts).
 */
import TestWorker from './test-worker.ts?worker&inline';

export function spawnTestWorker(): Worker {
  return new TestWorker({ name: 'geomira-tests' });
}
