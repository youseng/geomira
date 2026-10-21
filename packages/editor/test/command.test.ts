import { print } from '@geomira/lang/print';
import { describe, expect, it } from 'vitest';
import { acceptCompletion, completions, runCommand } from '../src/command';
import { createEditor } from '../src/state';
import { docOf, editorOf, env, registry } from './helpers/editor';

/** The command bar (SPEC §15): statements of the language, GUI tools, registry autocomplete. */

describe('runCommand: a line of the language is one edit', () => {
  it('appends statements; the text equals typing them into the text', () => {
    let s = createEditor(docOf(''), env);
    for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'c = circle(A, B, C)']) {
      const r = runCommand(s, line, env);
      if (r.kind !== 'edit') throw new Error(JSON.stringify(r));
      s = r.result.state;
    }
    expect(print(s.doc)).toBe(
      print(docOf('A = (0, 0)\nB = (4, 0)\nC = (1, 3)\nc = circle(A, B, C)\n')),
    );
    expect(s.history.past).toHaveLength(4);
  });

  it('claims, assumptions and styles are statements too', () => {
    let s = editorOf('A = (1, 3)\nB = (0, 0)\nC = (4, 0)\nH = orthocenter(A, B, C)');
    for (const line of [
      'assume acute(A, B, C)',
      'claim ∠BHC + ∠BAC = 180',
      'style H [color=red]',
    ]) {
      const r = runCommand(s, line, env);
      if (r.kind !== 'edit') throw new Error(JSON.stringify(r));
      s = r.result.state;
    }
    expect([s.doc.assumptions.length, s.doc.claims.length]).toEqual([1, 1]);
    expect(s.doc.objects.find((o) => o.name === 'H')?.style.color).toBe('red');
  });

  it('errors come back with the column of the command and the hint; nothing changes', () => {
    const s = editorOf('A = (0, 0)');
    const r = runCommand(s, 'B = midpoint(A, Q)', env);
    expect(r.kind).toBe('error');
    if (r.kind !== 'error') return;
    expect(r.diagnostics[0]?.line).toBe(1);
    expect(r.diagnostics[0]?.message).toMatch(/Q/u);
    expect(r.diagnostics[0]?.hint).not.toBe('');
    expect(runCommand(s, '   ', env)).toMatchObject({ kind: 'error', reason: 'type a statement' });
  });

  it('a GUI tool by id, label or key word switches the tool', () => {
    const s = editorOf('A = (0, 0)');
    for (const line of ['circle3', 'Circle (3 points)', 'tool circle3']) {
      const r = runCommand(s, line, env);
      if (r.kind !== 'edit') throw new Error(JSON.stringify(r));
      expect(r.result.state.tool).toBe('circle3');
    }
  });

  it('a statement that changes nothing is refused as such', () => {
    const s = editorOf('A = (0, 0)');
    const r = runCommand(s, 'style A []', env);
    expect(r.kind).toBe('error');
  });
});

describe('completions: from the registry, the objects, the keywords and the GUI tools', () => {
  const s = editorOf('A = (0, 0)\nB = (4, 0)\nC = (1, 3)\nω = circle(A, B, C)');

  it('registry tools after "=", with their signatures', () => {
    const cs = completions(s, 'O = circ', 8, env);
    const labels = cs.map((c) => c.label);
    expect(labels).toContain('circumcenter');
    expect(labels).toContain('circumcircle');
    expect(labels).toContain('circle');
    for (const c of cs) expect(c.label.startsWith('circ')).toBe(true);
    const cc = cs.find((c) => c.label === 'circumcircle');
    expect(cc?.insert).toBe('circumcircle(');
    expect(cc?.detail).toMatch(/^circumcircle\(point, point, point\)/u);
    // Nothing outside the registry enumerates tools: every tool suggestion is a registry name.
    for (const c of cs.filter((x) => x.kind === 'tool'))
      expect(registry.get(c.label)).toBeDefined();
  });

  it('object names inside calls; keywords and GUI tools at the start of a line', () => {
    expect(completions(s, 'M = midpoint(A, ', 16, env).map((c) => c.label)).toEqual(
      expect.arrayContaining(['A', 'B', 'C', 'ω']),
    );
    const start = completions(s, 'cl', 2, env).map((c) => c.label);
    expect(start).toContain('claim');
    const gui = completions(s, 'Circ', 4, env).filter((c) => c.kind === 'gui');
    expect(gui.map((c) => c.label)).toContain('Circle (3 points)');
  });

  it('claim kinds after "claim", assumption kinds after "assume"', () => {
    expect(completions(s, 'claim conc', 10, env).map((c) => c.label)).toEqual(
      expect.arrayContaining(['concyclic', 'concurrent']),
    );
    expect(completions(s, 'assume ac', 9, env).map((c) => c.label)).toEqual(['acute']);
  });

  it('accepting a completion replaces the word before the cursor', () => {
    const c = completions(s, 'O = circumce', 12, env).find((x) => x.label === 'circumcenter');
    if (c === undefined) throw new Error('no completion');
    expect(acceptCompletion('O = circumce', 12, c)).toEqual({
      text: 'O = circumcenter(',
      cursor: 17,
    });
    expect(acceptCompletion('O = circumce + 1', 12, c).text).toBe('O = circumcenter( + 1');
  });

  it('is total on any input and cursor', () => {
    for (const [t, k] of [
      ['', 0],
      ['((((', 2],
      ['x', 99],
      ['\\alph', 5],
    ] as const)
      expect(Array.isArray(completions(s, t, k, env))).toBe(true);
  });
});
