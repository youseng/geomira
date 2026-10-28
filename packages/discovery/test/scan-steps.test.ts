/**
 * The scan's steps stay short (SPEC §16, ADR-0030): between two yields it visits at most BATCH
 * candidates, and BATCH is 4. A visit (screen and closure check) of an angle kind costs up to
 * about 1.5 ms on a cold start, so 16 visits in one step made page slices of 16–25 ms (the
 * host-discovery slice test failed 9 times in 20 under CPU load; 0 in 20 with 4).
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { screenSteps } from '@geomira/claims/screen';
import { poolsOf } from '../src/candidates';
import { BATCH, scanKinds } from '../src/scan';
import { drain } from '../src/ticking';
import { REGISTRY, triangle } from './helpers';

describe('scan steps', () => {
  it('at most BATCH = 4 candidate visits between two yields, over every kind', () => {
    expect(BATCH).toBe(4);
    const { doc } = triangle();
    const screen = drain(screenSteps(doc, REGISTRY, 9));
    if ('reason' in screen) throw new Error(screen.reason);
    const pools = poolsOf(
      doc.objects.map((o) => o.id),
      screen.values,
      screen.ctx.scale,
    );
    let visits = 0;
    let most = 0;
    let total = 0;
    const scan = scanKinds(
      'find',
      claimKindRegistry(),
      pools,
      { candidatesPerKind: 200, countLimit: 20_000 },
      () => {
        visits++;
        total++;
      },
    );
    for (let r = scan.next(); r.done !== true; r = scan.next()) {
      most = Math.max(most, visits);
      visits = 0;
    }
    most = Math.max(most, visits);
    expect(total).toBeGreaterThan(100);
    expect(most).toBe(BATCH);
  });

  it('stop at the yield after a part batch ends the scan with that kind fully checked', () => {
    const { doc } = triangle();
    const screen = drain(screenSteps(doc, REGISTRY, 9));
    if ('reason' in screen) throw new Error(screen.reason);
    const pools = poolsOf(
      doc.objects.map((o) => o.id),
      screen.values,
      screen.ctx.scale,
    );
    const scan = scanKinds(
      'find',
      claimKindRegistry(),
      pools,
      { candidatesPerKind: 200, countLimit: 20_000 },
      () => undefined,
    );
    let at: { phase: string; done: number } | undefined;
    let r = scan.next();
    while (r.done !== true) {
      const p = r.value;
      if (p.done % BATCH !== 0) {
        at = { phase: p.phase, done: p.done };
        r = scan.next('stop');
        break;
      }
      r = scan.next();
    }
    if (r.done !== true || at === undefined) throw new Error('no part batch');
    expect(r.value.cmd).toBe('stop');
    const last = r.value.reports.at(-1);
    expect(`screening ${last?.kind ?? ''}`).toBe(at.phase);
    expect(last?.checked).toBe(at.done);
    expect(last?.stop).toBeUndefined();
  });
});
