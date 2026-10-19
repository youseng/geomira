import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { exactness, exampleDocument, formatValue, renderToolDocs, runExample } from '../src/docs';
import { createRegistry } from '../src/registry';
import type { ToolSpec } from '../src/tool';
import { numbersOf, type Value } from '../src/value';
import { REGISTRY, must } from './helpers/doc';

describe('the generated tool reference (docs/tools.md)', () => {
  it('is up to date: run `pnpm docs:tools` after changing the registry', () => {
    const path = fileURLToPath(new URL('../../../docs/tools.md', import.meta.url));
    expect(readFileSync(path, 'utf8')).toBe(renderToolDocs(REGISTRY));
  });

  it('documents every tool, its signatures, exactness and degenerate cases', () => {
    const md = renderToolDocs(REGISTRY);
    for (const t of REGISTRY.tools) {
      expect(md).toContain(`### ${t.name}\n`);
      for (const d of t.degenerate) expect(md).toContain(`  - ${d}\n`);
    }
    expect(md.endsWith('\n')).toBe(true);
  });

  it('every example is defined over FloatField and agrees with RationalField where exact', () => {
    for (const t of REGISTRY.tools) {
      for (const e of t.examples) {
        const f = runExample(REGISTRY, t, e, FloatField);
        const q = runExample(REGISTRY, t, e, RationalField);
        expect(['undefined', 'inexact'], t.name).not.toContain(f.kind);
        if (q.kind === 'inexact') continue;
        expect(q.kind).toBe(f.kind);
        const [fs, qs] = [numbersOf(f), numbersOf(q)];
        for (const [i, x] of qs.entries()) expect(fs[i]).toBeCloseTo(RationalField.toNumber(x), 12);
      }
    }
  });

  it('exactness is discovered from the examples', () => {
    expect(exactness(REGISTRY, must(REGISTRY.get('midpoint')))).toBe('can succeed');
    const angle = must(REGISTRY.get('angle'));
    const inexactOnly: ToolSpec = {
      ...angle,
      examples: [
        {
          args: [
            ['1', '0'],
            ['0', '0'],
            ['1', '2'],
          ],
        },
      ],
    };
    expect(exactness(REGISTRY, inexactOnly)).toMatch(/^not in the examples: atan2/);
    const undefinedOnly: ToolSpec = {
      ...angle,
      examples: [
        {
          args: [
            ['1', '0'],
            ['1', '0'],
            ['1', '2'],
          ],
        },
      ],
    };
    expect(exactness(REGISTRY, undefinedOnly)).toBe('not shown by the examples');
  });

  it('formats every kind; a malformed example number makes an Undefined example', () => {
    const show = (x: number) => String(x);
    const values: Value<number>[] = [
      { kind: 'circle', c: { x: 0, y: 0 }, r2: 4, arc: null },
      {
        kind: 'transform',
        t: { type: 'similarity', anti: true, a: { re: 1, im: 0 }, b: { re: 0, im: 0 } },
      },
      {
        kind: 'transform',
        t: { type: 'similarity', anti: false, a: { re: 1, im: 0 }, b: { re: 0, im: 0 } },
      },
      { kind: 'inexact', reason: 'r' },
      { kind: 'undefined', reason: 'u' },
    ];
    expect(values.map((v) => formatValue(v, show))).toEqual([
      'circle centre (0, 0), r² = 4',
      'similarity (anti)',
      'similarity',
      'Inexact (r)',
      'Undefined (u)',
    ]);
    expect(() => formatValue({ kind: 'bogus' } as never, show)).toThrow(/unexpected value/);
    const mid = must(REGISTRY.get('midpoint'));
    const bad = {
      args: [
        ['x', '0'],
        ['1', '1'],
      ],
    } as const;
    expect(runExample(REGISTRY, mid, bad, FloatField)).toEqual({
      kind: 'undefined',
      reason: 'unknown tool "invalid_example_number"',
    });
    expect(exampleDocument(mid, bad).objects.map((o) => o.name)).toEqual(['x']);
    const far = {
      args: [
        [`1${'0'.repeat(400)}`, '0'],
        ['1', '1'],
      ],
    } as const;
    expect(runExample(REGISTRY, mid, far, FloatField).kind).toBe('undefined');
    expect(renderToolDocs(createRegistry())).toBe(renderToolDocs(REGISTRY));
  });
});
