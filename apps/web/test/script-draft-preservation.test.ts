import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { print } from '@geomira/lang/print';
import { EditorStore } from '../src/store';
import { TextApplier } from '../src/text-apply';
import { timeout } from '../src/long-press';

afterEach(() => vi.useRealTimers());

describe('script source remains deliberate', () => {
  it('applies valid source on blur while preserving its formatting and comments', () => {
    vi.useFakeTimers();
    const store = new EditorStore({ registry: createRegistry() }, (m) => {
      throw new Error(m);
    });
    const applier = new TextApplier(store, timeout, () => Date.now());
    const source = '# keep this explanation\nA=(1,2)\n';
    applier.type(source);
    applier.leave();
    expect(print(store.current().doc)).toContain('A = (1, 2)');
    expect(applier.getSnapshot().text).toBe(source);
    expect(applier.getSnapshot().session).toBeNull();
    // Explicit apply/format may normalize text; a normal focus change may not.
    applier.applyNow();
    expect(applier.getSnapshot().text).toContain('A = (1, 2)');
    expect(applier.getSnapshot().text).toContain('# keep this explanation');
  });
});

it('only explains actual reformatting of clean user source, and clears it when opening a document', () => {
  vi.useFakeTimers();
  const store = new EditorStore({ registry: createRegistry() }, (m) => {
    throw new Error(m);
  });
  store.openText('A=(1,2)', 'example');
  expect(store.textDraft.sourceNotice()).toBeNull();
  store.command('B=(4,0)');
  expect(store.textDraft.sourceNotice()).toBeNull();
  store.textDraft.type('# custom spacing\nA=(1,2)\nB=(4,0)\n');
  store.textDraft.leave();
  store.command('C=(0,4)');
  expect(store.textDraft.sourceNotice()).toBe('Figure edit reformatted your source.');
  expect(store.textDraft.getSnapshot().text).toContain('# custom spacing');
  store.openText('X=(9,8)', 'example');
  expect(store.textDraft.sourceNotice()).toBeNull();
  store.textDraft.type('broken(');
  store.command('Y=(0,0)');
  expect(store.textDraft.getSnapshot().text).toBe('broken(');
  expect(store.textDraft.sourceNotice()).toBeNull();
});
