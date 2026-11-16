import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { parse } from '@geomira/lang/parse';
import { createRegistry } from '@geomira/kernel/registry';
import type { FromWorker, ToWorker } from '../src/worker/protocol';

afterAll(() => {
  vi.unstubAllGlobals();
});

let receive: ((event: MessageEvent<unknown>) => void) | undefined;
const output: FromWorker[] = [];
beforeAll(async () => {
  vi.stubGlobal(
    'addEventListener',
    (_type: string, listener: (event: MessageEvent<unknown>) => void) => {
      receive = listener;
    },
  );
  vi.stubGlobal('postMessage', (message: FromWorker) => output.push(message));
  await import('../src/worker/test-worker');
});
it('transports invalid free domains as structured job results in the retained worker', async () => {
  const parsed = parse(
    '@version 1\nA=(0,0)\nB=(1,0)\nM=midpoint(A,B)\np=param(2,1,1)\nclaim collinear(A,M,B)\n',
    createRegistry(),
  );
  expect(parsed.diagnostics).toEqual([]);
  const claim = parsed.doc.claims[0]?.id;
  if (claim === undefined || receive === undefined) throw new Error('missing fixture');
  for (const [index, regime] of ['local', 'global'].entries()) {
    if (regime !== 'local' && regime !== 'global') throw new Error('unknown regime');
    const data: ToWorker = {
      type: 'run',
      id: index + 1,
      job: { kind: 'testClaim', doc: parsed.doc, claim, regime, seed: 1, n: 200 },
    };
    receive({ data } as MessageEvent<unknown>);
  }
  await vi.waitFor(() => {
    expect(output.filter((m) => m.type === 'result')).toHaveLength(2);
  });
  expect(output.filter((m) => m.type === 'error')).toEqual([]);
  for (const result of output.filter((m) => m.type === 'result')) {
    expect(result.result.kind).toBe('invalid');
    if (result.result.kind !== 'invalid') throw new Error('missing invalid result');
    expect(result.result.reason).toContain('param');
  }
});
