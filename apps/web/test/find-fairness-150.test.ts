/**
 * ADR-0052, Run 16c's known bug as reported: "What is special?" on the 150-object figure of
 * e2e/fallback-discovery.spec.ts plus two conics (D, E, F free, kk = conic(A, B, C, D, E),
 * mm = conic(A, B, C, D, F), X their fourth common point) found 0 facts in its 20 s: the job
 * screened every kind to its full budget before testing anything. The host's time budget is
 * modelled by a step budget (the host sends `stop` after STEPS job steps), so the test does not
 * depend on the machine's speed. Before ADR-0052 the job was still counting and screening at
 * that step and ended with nothing; now the first look of every kind is screened and tested
 * long before it.
 */
import { describe, expect, it } from 'vitest';
import { runFind } from '@geomira/discovery/find';
import type { FindResult } from '@geomira/discovery/types';
import { parse } from '@geomira/lang/parse';
import { registry } from './helpers';

/** The host's `stop` comes after this many job steps (a sample of a local test is one step). */
const STEPS = 15_000;

/** The figure of e2e/fallback-discovery.spec.ts (the same fixed MINSTD sequence). */
function figure(): string[] {
  const lines = ['A = (1, 5)', 'B = (-3, 0)', 'C = (4, 1)'];
  const pts = ['A', 'B', 'C'];
  const used = new Set<string>();
  const fresh = (tool: string, ...args: string[]) => {
    const key = `${tool}(${[...args].sort().join(',')})`;
    if (used.has(key)) return false;
    used.add(key);
    return true;
  };
  let x = 12_345;
  const pick = () => {
    x = (x * 48_271) % 2_147_483_647;
    return pts[x % pts.length] ?? 'A';
  };
  for (let i = 0; lines.length < 150 && i < 10_000; i++) {
    const [a, b, c] = [pick(), pick(), pick()];
    if (a === b || b === c || a === c) continue;
    const name = `P_${String(i)}`;
    const k = i % 4;
    if (k === 0 && fresh('midpoint', a, b)) lines.push(`${name} = midpoint(${a}, ${b})`);
    else if (k === 1 && fresh(`foot:${c}`, a, b)) lines.push(`${name} = foot(${c}, ${a}, ${b})`);
    else if (k === 2 && fresh('line', a, c)) lines.push(`l_${String(i)} = line(${a}, ${c})`);
    else if (k === 3 && fresh('circle', a, b, c))
      lines.push(`k_${String(i)} = circle(${a}, ${b}, ${c})`);
    else continue;
    if (k <= 1) pts.push(name);
  }
  return lines;
}

const CONICS = [
  'D = (6, 6)',
  'E = (-2, 4)',
  'F = (2, -3)',
  'kk = conic(A, B, C, D, E)',
  'mm = conic(A, B, C, D, F)',
  'X = intersect(kk, mm, other(A, B, C))',
];

/** The find job with the default budget but n = 40, stopped after `steps` steps. */
function findStopped(text: string, steps: number): { r: FindResult; id: (n: string) => number } {
  const p = parse(text, registry);
  const id = (n: string) => p.doc.objects.find((o) => o.name === n)?.id ?? -1;
  expect(p.diagnostics).toEqual([]);
  const it = runFind({ kind: 'find', doc: p.doc, seed: 7, budget: { n: 40 } }, { registry });
  for (let k = 0, r = it.next(); ; k++) {
    if (r.done === true) {
      if (r.value.kind !== 'found') throw new Error(JSON.stringify(r.value));
      return { r: r.value, id };
    }
    r = it.next(k === steps ? 'stop' : undefined);
  }
}

describe('"What is special?" on 150 objects with conics (ADR-0052)', () => {
  it(
    'finds and confirms facts before the time budget, and says what it did not reach',
    { timeout: 300_000 },
    () => {
      const lines = [...figure(), ...CONICS];
      expect(lines).toHaveLength(156);
      const { r, id } = findStopped(`@version 1\n${lines.join('\n')}\n`, STEPS);
      expect(r.stopped).toBe(true);
      expect(r.facts.length).toBeGreaterThanOrEqual(3);
      for (const f of r.facts) expect(f.verdict.kind).toBe('holds');
      // X = D (two conics through A, B, C, D meet a fourth time at D): the newest point's fact,
      // in the first look's newest half.
      const dx = r.facts.find((f) => f.kind === 'equal' && f.objects.includes(id('X')));
      expect(dx?.objects).toEqual(expect.arrayContaining([id('D'), id('X')]));
      // Every searched kind with candidates got its first look; the long scans were cut.
      expect(r.kinds.map((k) => k.kind)).toContain('conconic');
      for (const k of r.kinds) if (k.total > 0) expect(k.checked, k.kind).toBeGreaterThan(0);
      expect(r.caps).toContain(
        'checked 1,000 of more than 20,000 conconic candidates: time budget',
      );
      expect(r.caps).toContain('stopped at the time budget');
    },
  );
});
