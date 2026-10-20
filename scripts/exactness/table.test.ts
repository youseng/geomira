import { describe, expect, it } from 'vitest';
import { createRegistry } from '../../packages/kernel/src/registry';
import { exactnessRows, renderExactnessTable } from './table';

describe('the generated exactness table', () => {
  const registry = createRegistry();

  it('has one row per registry tool, in registry order', () => {
    expect(exactnessRows(registry).map((r) => r.tool)).toEqual(registry.tools.map((t) => t.name));
    expect(renderExactnessTable(registry).split('\n')).toHaveLength(registry.tools.length + 2);
  });

  it('discovers exactness: rational tools succeed, side-length tools only on rational sides', () => {
    const row = (name: string) => exactnessRows(registry).find((r) => r.tool === name);
    for (const t of [
      'circle',
      'cline',
      'other',
      'tangent',
      'polar',
      'radical_axis',
      'ninepoint_circle',
    ]) {
      expect(row(t)).toMatchObject({ exactRun: 'can succeed', otherwise: '' });
    }
    for (const t of ['incenter', 'excenter', 'incircle', 'excircle', 'bisector', 'ext_bisector']) {
      expect(row(t)).toMatchObject({ exactRun: 'can succeed', exactExamples: 1, examples: 2 });
      expect(row(t)?.otherwise).toMatch(/^inexact: √\(.*\) is not rational$/);
    }
    expect(row('on')).toMatchObject({ exactRun: 'can succeed', exactExamples: 3, examples: 4 });
    expect(row('on')?.otherwise).toBe('inexact: cos(30°) is not rational');
    expect(row('angle')?.otherwise).toMatch(/^inexact: atan2/);
  });

  it('discovers exactness of sqrt, sin, cos, tan: exact where rational (ADR-0005)', () => {
    const row = (name: string) => exactnessRows(registry).find((r) => r.tool === name);
    for (const t of ['sqrt', 'sin', 'cos', 'tan'])
      expect(row(t)).toMatchObject({ exactRun: 'can succeed', exactExamples: 1, examples: 2 });
    expect(row('sqrt')?.otherwise).toBe('inexact: √(2) is not rational');
    expect(row('sin')?.otherwise).toBe('inexact: sin(45°) is not rational');
    expect(row('cos')?.otherwise).toBe('inexact: cos(45°) is not rational');
    expect(row('tan')?.otherwise).toBe('inexact: cos(30°) is not rational');
  });

  it('discovers exactness of the Run 3b tools: branchable tools exact where the roots are rational', () => {
    const row = (name: string) => exactnessRows(registry).find((r) => r.tool === name);
    expect(row('intersect')).toMatchObject({
      exactRun: 'can succeed',
      exactExamples: 4,
      examples: 5,
    });
    expect(row('intersect')?.otherwise).toBe('inexact: √(2) is not rational');
    for (const t of ['tangent_point', 'tangent_from']) {
      expect(row(t)).toMatchObject({ exactRun: 'can succeed', exactExamples: 1, examples: 2 });
      expect(row(t)?.otherwise).toBe('inexact: √(275/1296) is not rational');
    }
    expect(row('ninepoint_center')).toMatchObject({ exactRun: 'can succeed', otherwise: '' });
    expect(row('power')).toMatchObject({ exactRun: 'can succeed', otherwise: '' });
    expect(row('radius')).toMatchObject({ exactRun: 'can succeed', exactExamples: 1, examples: 2 });
  });
});
