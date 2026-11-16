import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { EditorStore } from '../src/store';
import { PersistencePanel } from '../src/PersistencePanel';
import type { SaveStatus } from '../src/persist';

const storeOf = () => new EditorStore({ registry: createRegistry() }, () => undefined);
const render = (store: EditorStore) =>
  renderToString(<PersistencePanel store={store} onRestore={() => undefined} />);

describe('recovery expansion reflects actual failures, conflicts or user intent', () => {
  it('keeps initial Not saved truthful without expanding a transient failure panel', () => {
    const store = storeOf();
    expect(store.autosave.getStatus()).toMatchObject({ phase: 'not-saved', message: null });
    const html = render(store);
    expect(html).toContain('Not saved');
    expect(html).toContain('aria-label="Recovery versions"');
    expect(html).not.toContain('id="recovery-versions"');
    expect(html).not.toContain('Retry local save');
  });
  it('keeps ordinary dirty Saving state compact and does not call it saved', () => {
    const store = storeOf();
    store.command('A=(0,0)');
    const html = render(store);
    expect(html).toContain('Saving');
    expect(html).not.toContain('Saved locally');
    expect(html).not.toContain('id="recovery-versions"');
  });
  for (const [phase, message] of [
    ['not-saved', 'SecurityError: blocked'],
    ['not-saved', 'QuotaExceededError: full'],
    ['conflict', null],
    ['saved', 'Some legacy text is invalid.'],
  ] as const) {
    it(`automatically exposes ${phase} with ${message ?? 'a protected conflict'}`, () => {
      const store = storeOf();
      const status: SaveStatus = { ...store.autosave.getStatus(), phase, message };
      vi.spyOn(store.autosave, 'getStatus').mockReturnValue(status);
      const html = render(store);
      expect(html).toContain('id="recovery-versions"');
      expect(html).toContain('Download .geo backup');
      if (phase === 'not-saved') expect(html).toContain('Retry local save');
      if (phase === 'conflict') expect(html).toContain('Both versions are kept');
    });
  }
});
