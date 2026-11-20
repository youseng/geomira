import { afterEach, describe, expect, it } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { parsePortable } from '@geomira/lang/portable';
import { encodeShareChecked, decodeShare } from '@geomira/editor/share';
import { EditorStore } from '../src/store';
import { replaceDocument } from '../src/file-actions';
import { renderWriteUp } from '../src/writeup-preview';
import { MemoryRevisions } from './memory-revisions';
import { installStorage, removeStorage } from './fake-storage';

const registry = createRegistry();
const raw = '# Solution\n\n$\\unknown{a}$\n\n$\\frac{\n';
afterEach(removeStorage);
async function open(storage = new MemoryRevisions()) {
  installStorage();
  const store = new EditorStore({ registry }, () => undefined, storage);
  await store.autosave.initialize();
  store.openText('A = (0,1)', 'example');
  return { store, storage };
}
describe('independent write-up recovery', () => {
  it('starts recovery for a notes-only edit, retries denied storage, restores and duplicates exact source', async () => {
    const { store, storage } = await open();
    store.setWriteUp(raw);
    storage.failure = 'put';
    expect(await store.retrySaving()).toBe(false);
    expect(store.autosave.getStatus().phase).toBe('not-saved');
    expect(store.getSnapshot().writeUp).toBe(raw);
    storage.failure = null;
    expect(await store.retrySaving()).toBe(true);
    const entry = store.autosave.entries()[0];
    if (!entry) throw new Error('Missing revision');
    expect(parsePortable(entry.text, registry).doc.writeUp).toBe(raw);
    store.setWriteUp('new');
    await store.retrySaving();
    expect(await store.restoreRevision(entry.id)).toBe(true);
    expect(store.getSnapshot().writeUp).toBe(raw);
    store.command('B = (1,1)');
    store.apply({ kind: 'undo' });
    expect(store.document().writeUp).toBe(raw);
    const link = encodeShareChecked(store.document());
    if (!link.ok) throw new Error(link.reason);
    const shared = decodeShare(link.fragment, registry);
    expect(shared.ok && shared.doc.writeUp).toBe(raw);
  });
  it('retains newer input during an in-flight file switch and saves the eventual deletion', async () => {
    const { store, storage } = await open();
    store.setWriteUp('first');
    let finish = () => {};
    storage.barrier = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const switching = replaceDocument(store, store.current().doc, false);
    store.setWriteUp('second');
    finish();
    await expect(switching).rejects.toThrow('changed');
    expect(store.getSnapshot().writeUp).toBe('second');
    store.setWriteUp('');
    expect(await store.retrySaving()).toBe(true);
    const head = storage.state.revisions.find((r) => r.id === storage.state.currentId);
    if (!head) throw new Error('Missing durable head');
    expect(head.text).toContain('@version 1');
    expect(head.text).not.toContain('@writeup');
  });
});

describe('Markdown and LaTeX preview', () => {
  it('typesets valid expressions on both sides of an invalid one', () => {
    const html = renderWriteUp(
      '# Steps\n\n- $\\angle ABC$\n- $\\unknown{1}$\n- **done**\n\n$$\n\\frac{3}{4}\n$$',
    );
    expect(html.match(/<math[ >]/gu)).toHaveLength(2);
    expect(html).toContain('mfrac');
    expect(html).toContain('writeup-error');
    expect(html).toContain('<strong>done</strong>');
  });
  it('keeps code, escaped dollars, unfinished math and pasted HTML literal', () => {
    const html = renderWriteUp(
      '\\$5 and `$x$`\n\n```\n$y$\n```\n\n<b>literal</b> ![remote](https://example.com/x)\n\n$\\frac{',
    );
    expect(html).not.toContain('<math');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('$\\frac{');
  });
});

it('protects both write-ups when tabs edit the same saved figure', async () => {
  const { store: a, storage } = await open();
  a.setWriteUp('base');
  await a.retrySaving();
  const b = new EditorStore({ registry }, () => undefined, storage);
  const initial = await b.autosave.initialize();
  if (!initial) throw new Error('Missing saved figure');
  b.openText(initial, 'autosave');
  a.setWriteUp('one');
  b.setWriteUp('two');
  await Promise.all([a.retrySaving(), b.retrySaving()]);
  const bodies = storage.state.revisions.map((r) => parsePortable(r.text, registry).doc.writeUp);
  expect(bodies).toContain('one');
  expect(bodies).toContain('two');
  expect(storage.state.conflicts.length).toBeGreaterThan(0);
});

it('keeps budget failures in preview and allows storage with a write-up beyond its preview size', async () => {
  const source = '# Notes\n' + 'a'.repeat(81_000);
  expect(() => renderWriteUp(source)).toThrow('preview limit');
  const { store, storage } = await open();
  store.setWriteUp(source);
  expect(await store.retrySaving()).toBe(true);
  const head = storage.state.revisions.find((r) => r.id === storage.state.currentId);
  if (!head) throw new Error('Missing durable head');
  expect(parsePortable(head.text, registry).doc.writeUp).toBe(source);
});
