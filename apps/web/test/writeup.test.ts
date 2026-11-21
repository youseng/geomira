import { afterEach, describe, expect, it } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { parsePortable } from '@geomira/lang/portable';
import { encodeShareChecked, decodeShare } from '@geomira/editor/share';
import { EditorStore } from '../src/store';
import { replaceDocument } from '../src/file-actions';
import { createWriteUpFormatter } from '../src/writeup-layout';
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

describe('in-place Markdown and LaTeX', () => {
  it('typesets expressions on both sides of a failure and marks actual emphasis', () => {
    const source =
      '# Steps\n\n- $\\angle ABC$\n- $\\unknown{1}$\n- **done**\n\n$$\n\\frac{3}{4}\n$$';
    const { formulas, marks } = createWriteUpFormatter()(source);
    expect(formulas.map((f) => !!f.html)).toEqual([true, false, true]);
    expect(formulas[1]?.error).toContain('unknown');
    expect(formulas[2]?.html).toContain('mfrac');
    expect(marks.filter((m) => m.kind === 'strong').map((m) => source.slice(m.from, m.to))).toEqual(
      ['**done**'],
    );
  });
  it('leaves code, escaped dollars, unfinished math and pasted HTML as document text', () => {
    const source =
      '\\$5 and `$x$`\n\n```\n$y$\n```\n\n<b>literal</b> ![remote](https://example.com/x)\n\n$\\frac{';
    const { formulas, marks } = createWriteUpFormatter()(source);
    expect(formulas).toEqual([]);
    expect(marks.filter((m) => m.kind === 'code').map((m) => source.slice(m.from, m.to))).toEqual([
      '`$x$`',
    ]);
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
  expect(() => createWriteUpFormatter()(source)).toThrow('formatting limit');
  const { store, storage } = await open();
  store.setWriteUp(source);
  expect(await store.retrySaving()).toBe(true);
  const head = storage.state.revisions.find((r) => r.id === storage.state.currentId);
  if (!head) throw new Error('Missing durable head');
  expect(parsePortable(head.text, registry).doc.writeUp).toBe(source);
});

it('locates inline and display formulas in the original source, including repeated and nested math', () => {
  const md = '> - **a** $x$ and $x$\n\n`$code$` and \\$5\n\n$$\n\\frac{1}{2}\n$$\n\n$\\badcommand$';
  const { formulas } = createWriteUpFormatter()(md);
  expect(formulas.map((f) => md.slice(f.from, f.to))).toEqual([
    '$x$',
    '$x$',
    '$$\n\\frac{1}{2}\n$$',
    '$\\badcommand$',
  ]);
  expect(formulas[2]?.html).toContain('mfrac');
  expect(formulas[3]?.error).toContain('badcommand');
});

it('maps delimiters to the original bytes inside CRLF and prefixed blocks', () => {
  const source = '> ### Heading\r\n> a $x$\r\n\r\n> $$  \r\n> y^2\r\n> $$  ';
  const { formulas, lines } = createWriteUpFormatter()(source);
  expect(formulas.map((f) => source.slice(f.from, f.to))).toEqual(['$x$', '$$  \r\n> y^2\r\n> $$']);
  expect(lines.some((l) => l.level === 3)).toBe(true);
});
