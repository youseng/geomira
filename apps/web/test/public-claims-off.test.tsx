import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { print } from '@geomira/lang/print';
import { parse } from '@geomira/lang/parse';
import { printShort } from '@geomira/lang/print-short';
import { decodeShare, encodeShare } from '@geomira/editor/share';
import { chooseTool } from '@geomira/editor/selection-tool';
import { randomizeEdit } from '@geomira/editor/randomize';
import { App } from '../src/App';
import { EditorStore } from '../src/store';
import { TestHost } from '../src/worker/host';
import { TestRuns } from '../src/test-runs';
import { DiscoveryRuns } from '../src/discovery-runs';
import { EXAMPLES } from '../src/examples';
import { CLAIMS_UNAVAILABLE } from '../src/features';

const REPRO = `O=(0,0)
F=(1000,0)
c=circle(O,0.01)
d=circle(O,0.02)
A=on(c,0)
B=on(d,0)
claim length(O,A,O,B,1)
assume greater(dist(O,F),0)
`;
const registry = createRegistry();
const storeOf = () =>
  new EditorStore({ registry }, (m) => {
    throw new Error(m);
  });

describe('the public release contains claims as document data only', () => {
  it('has no claim actions, tab, shortcut hint or worker status in the default shell', () => {
    const html = renderToString(<App />);
    for (const text of [
      'Claim to test',
      '>Claims<',
      '>Claim<',
      'Measure / Claim',
      'Test</button>',
      'Live claim badges',
      'What is special?',
      'Tests:',
    ])
      expect(html).not.toContain(text);
    for (const text of [
      'Geometry canvas',
      '>Text<',
      '>Objects<',
      '>Layers<',
      'Randomize',
      'Command',
    ])
      expect(html).toContain(text);
  });

  it('refuses the retired tool through commands, edits and selection actions', () => {
    const store = storeOf();
    expect(store.command('tool claim')).toMatchObject({
      kind: 'error',
      reason: CLAIMS_UNAVAILABLE,
    });
    expect(store.command('Claim')).toMatchObject({ kind: 'error' });
    expect(store.apply({ kind: 'tool', tool: 'claim' }).ok).toBe(false);
    expect(store.run((s, env) => chooseTool(s, 'claim', env)).ok).toBe(false);
    expect(store.current().tool).toBe('move');
  });

  it('retains the reproduction through text, short text, shares, rename and undo', () => {
    const store = storeOf();
    store.openText(REPRO, 'link');
    expect(store.getSnapshot().notice).toBeNull();
    expect(store.current().doc.objects).toHaveLength(6);
    expect(store.current().doc.claims).toHaveLength(1);
    expect(store.current().doc.assumptions).toHaveLength(1);
    const before = print(store.current().doc);
    for (const text of [before, printShort(store.current().doc, registry)]) {
      const result = parse(text, registry);
      expect(result.diagnostics).toEqual([]);
      expect(print(result.doc)).toBe(before);
    }
    const shared = decodeShare(encodeShare(store.current().doc), registry);
    expect(shared.ok).toBe(true);
    if (!shared.ok) throw new Error(shared.reason);
    expect(shared.text).toBe(before);
    const a = store.current().doc.objects.find((o) => o.name === 'A');
    if (a === undefined) throw new Error('A missing');
    expect(store.apply({ kind: 'rename', id: a.id, name: 'P' }).ok).toBe(true);
    expect(print(store.current().doc)).toContain('claim OP = OB');
    expect(store.apply({ kind: 'undo' }).ok).toBe(true);
    expect(print(store.current().doc)).toBe(before);
    expect(store.command('claim equal(O,F)')).toMatchObject({ kind: 'edit' });
    expect(store.current().doc.claims).toHaveLength(2);
  });

  it('does not warm or dispatch even if retired run methods are invoked directly', () => {
    const createWorker = vi.fn(() => null);
    const inline = vi.fn(() => {
      throw new Error('inline runner started');
    });
    const timer = vi.fn(() => () => undefined);
    const host = new TestHost({ createWorker, inline, setTimer: timer });
    const error = vi.fn();
    const callbacks = { progress: vi.fn(), result: vi.fn(), error };
    const doc = parse(REPRO, registry).doc;
    const claim = doc.claims[0]?.id ?? 0;
    host.warm();
    host.start({ kind: 'testClaim', doc, claim, regime: 'local', seed: 1, n: 1 }, callbacks);
    host.startDiscovery({ kind: 'find', doc, seed: 1 }, callbacks);
    const runs = new TestRuns(host, error);
    runs.warm();
    runs.start(doc, claim, 'local');
    runs.start(doc, claim, 'global');
    const discovery = new DiscoveryRuns(host, timer, error);
    discovery.find(doc);
    discovery.hunt(doc);
    discovery.branchFix(doc, claim, 'global');
    expect(createWorker).not.toHaveBeenCalled();
    expect(inline).not.toHaveBeenCalled();
    expect(timer).not.toHaveBeenCalled();
    expect(callbacks.result).not.toHaveBeenCalled();
    expect(callbacks.progress).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(CLAIMS_UNAVAILABLE);
    expect(runs.getSnapshot().size).toBe(0);
    expect(discovery.getSnapshot().find).toBeUndefined();
    expect(host.runner()).toEqual({ kind: 'idle' });
  });

  it('reopens every bundled claim-bearing example without losing geometry or document data', () => {
    for (const example of EXAMPLES) {
      const store = storeOf();
      store.openText(example.text, 'example');
      const original = store.current();
      if (original.doc.claims.length === 0) continue;
      const canonical = print(original.doc);
      const short = printShort(original.doc, registry);
      for (const text of [canonical, short]) {
        store.openText(text, 'new');
        expect(store.getSnapshot().notice, example.id).toBeNull();
        expect(print(store.current().doc), example.id).toBe(canonical);
        expect([...store.current().values.values.values()], example.id).toEqual([
          ...original.values.values.values(),
        ]);
      }
    }
  });

  it('keeps assumptions and claims through Randomize and its undo', () => {
    const store = storeOf();
    store.openText('triangle A B C acute\nclaim collinear(A,B,C)\n', 'new');
    const before = store.current().doc;
    const result = randomizeEdit(store.current(), store.env, 'acute', 42);
    expect(result.kind).toBe('edit');
    if (result.kind === 'refused') throw new Error(result.reason);
    expect(store.apply(result.edit).ok).toBe(true);
    expect(store.current().doc.claims).toEqual(before.claims);
    expect(store.current().doc.assumptions).toEqual(before.assumptions);
    store.apply({ kind: 'undo' });
    expect(store.current().doc).toEqual(before);
  });
});
