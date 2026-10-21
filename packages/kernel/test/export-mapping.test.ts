import { describe, expect, it } from 'vitest';
import { createRegistry } from '../src/registry';
import type { ExportOp } from '../src/tool';

/**
 * The export mappings of ADR-0014: exactly these tools are written constructively by the
 * Asymptote exporter (note C of Run 9a: at least midpoint, foot, the triangle centres,
 * the three kinds of intersection, circumcircle, incircle, reflect and rotate); every other
 * tool is 'numeric'. Each constructive tool maps to the op of its own name.
 */
const CONSTRUCTIVE: readonly ExportOp[] = [
  'midpoint',
  'foot',
  'circumcenter',
  'centroid',
  'orthocenter',
  'incenter',
  'intersect',
  'line',
  'segment',
  'ray',
  'circle',
  'circumcircle',
  'incircle',
  'polygon',
  'reflect',
  'rotate',
  'homothety',
  'translate',
  'spiral',
  'compose',
  'inverse',
  'apply',
  'add',
  'sub',
  'mul',
  'div',
  'neg',
];

describe('export mappings (ADR-0014)', () => {
  const registry = createRegistry();

  it('maps exactly the listed tools constructively, each to its own op', () => {
    const mapped = registry.tools.filter((t) => t.export !== 'numeric');
    expect(mapped.map((t) => t.name).sort()).toEqual([...CONSTRUCTIVE].sort());
    for (const t of mapped) expect(t.export).toEqual({ constructive: t.name });
  });

  it("every other tool is 'numeric'", () => {
    for (const t of registry.tools)
      if (!CONSTRUCTIVE.includes(t.name as ExportOp)) expect(t.export).toBe('numeric');
  });
});
