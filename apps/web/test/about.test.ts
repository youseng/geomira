import { describe, expect, it } from 'vitest';
import { offlineText, runnerText } from '../src/about';
import { BUILD, SINGLE_FILE } from '../src/build-info';
import { reportOf } from '../src/page';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

/** Run 12: what the Help panel says about this copy, and the build in the debug report. */
describe('about this copy', () => {
  it('outside a Vite build the copy is a development build, not the single file', () => {
    expect(BUILD).toBe('dev');
    expect(SINGLE_FILE).toBe(false);
  });

  it('says whether the site works offline, and why not', () => {
    expect(offlineText({ kind: 'ready' })).toBe(
      'Offline: ready. This site opens and works without a network from now on.',
    );
    expect(offlineText({ kind: 'installing' })).toMatch(/^Offline: saving/u);
    expect(offlineText({ kind: 'unavailable', reason: 'this is the single-file copy' })).toBe(
      'Offline: this is the single-file copy.',
    );
    expect(offlineText({ kind: 'failed', reason: 'blocked' })).toBe(
      'Offline: not available (blocked).',
    );
  });

  it('says where tests run, with the reason when it is the page', () => {
    expect(runnerText({ kind: 'worker' })).toBe('Tests: run in a background worker.');
    expect(runnerText({ kind: 'starting' })).toMatch(/starting/u);
    expect(runnerText({ kind: 'idle' })).toMatch(/starting/u);
    expect(runnerText({ kind: 'page', reason: 'this browser has no Web Workers' })).toBe(
      'Tests: run on this page in short slices, since workers are unavailable (this browser has no Web Workers).',
    );
  });

  it('the debug report names the build', () => {
    const store = new EditorStore({ registry }, () => undefined);
    expect(reportOf(store)).toContain('(build dev)');
  });
});
