/**
 * ADR-0061 in the editor core: the command bar takes several statements separated by `;` as
 * ONE edit (one line of the text each, one undo); an error is reported at its place in the
 * command and nothing is applied; and the Claims panel's line numbers are those of the short
 * text the text panel shows, where two branches share a line.
 */
import { print } from '@geomira/lang/print';
import { printShort } from '@geomira/lang/print-short';
import { describe, expect, it } from 'vitest';
import { runCommand } from '../src/command';
import { claimRows, hypothesisRows, statementLines } from '../src/panels';
import { edit, editorOf, env, registry } from './helpers/editor';

const EXAMPLE =
  'ABC triangle; O = circumcenter(ABC); w = incircle(ABC); D = foot(A, BC); X = (6, 3); P, Q = tangents(X, w)';

describe('several statements in one command', () => {
  it('the maintainer’s example is one edit and one undo', () => {
    const base = editorOf('');
    const r = runCommand(base, EXAMPLE, env);
    if (r.kind !== 'edit') throw new Error(r.reason);
    const s = r.result.state;
    expect(s.history.past).toHaveLength(1);
    expect(s.doc.objects.map((o) => o.name)).toEqual([
      'A',
      'B',
      'C',
      'tri_ABC',
      'O',
      'w',
      'D',
      'X',
      'P',
      'Q',
    ]);
    expect(printShort(s.doc, registry).trimEnd().split('\n').slice(4)).toEqual([
      'tri_ABC = polygon(ABC)',
      'O = circumcenter(ABC)',
      'w = incircle(ABC)',
      'D = foot(A, BC)',
      'X = (6, 3)',
      'P, Q = tangents(X, w)',
    ]);
    expect(print(edit(s, { kind: 'undo' }).doc)).toBe(print(base.doc));
  });

  it('is what the statements do one by one', () => {
    const lines = ['A = (0, 0)', 'B = (4, 0)', 'M = midpoint(A, B)'];
    let one = editorOf('');
    for (const l of lines) {
      const r = runCommand(one, l, env);
      if (r.kind !== 'edit') throw new Error(r.reason);
      one = r.result.state;
    }
    const all = runCommand(editorOf(''), lines.join('; '), env);
    expect(all.kind === 'edit' && print(all.result.state.doc)).toBe(print(one.doc));
  });

  it('an error is at its statement’s place in the command, and nothing is applied', () => {
    const base = editorOf('A = (0, 0)\nB = (4, 0)');
    const command = 'M = midpoint(A, B); N = midpont(A, M)';
    const r = runCommand(base, command, env);
    if (r.kind !== 'error') throw new Error('expected an error');
    expect(r.diagnostics).toHaveLength(1);
    const [d] = r.diagnostics;
    expect(d).toMatchObject({
      line: 1,
      message: 'unknown tool "midpont": did you mean midpoint?',
    });
    expect(command.slice((d?.column ?? 0) - 1, (d?.endColumn ?? 0) - 1)).toBe('midpont(A, M)');
  });

  it('a single statement is as before: its diagnostics on line 1 at their own columns', () => {
    const r = runCommand(editorOf('A = (0, 0)'), 'N = midpont(A, A)', env);
    expect(r.kind === 'error' && r.diagnostics[0]).toMatchObject({ line: 1, column: 5 });
  });

  it('a ; inside a claim’s parentheses is the claim’s', () => {
    const base = editorOf('A = (0, 0)\nB = (4, 0)\nC = (1, 0)\nD = (-2, 0)');
    const r = runCommand(base, 'claim harmonic(A, B; C, D)', env);
    expect(r.kind === 'edit' && r.result.state.doc.claims).toHaveLength(1);
  });
});

describe('the panels count the lines of the short text', () => {
  const s = editorOf(
    [
      'A = (0, 0)',
      'B = (4, 0)',
      'C = (1, 3)',
      'X = (6, 3)',
      'ω = circle(A, B, C)',
      't = tangent_from(X, ω, orient(+))',
      'u = tangent_from(X, ω, orient(-))',
      'assume AB < AC',
      'claim perpendicular(line(A, B), line(C, X))',
    ].join('\n'),
  );

  it('a claim after two branches written as one statement is one line earlier', () => {
    const short = printShort(s.doc, registry).split('\n');
    const [row] = claimRows(s, env);
    expect(short[(row?.line ?? 0) - 1]).toBe('claim perpendicular(AB, CX)');
    expect(row?.line).toBe(9);
    // The row's own text is the canonical statement, as before.
    expect(row?.text).toBe('claim perpendicular(line(A, B), line(C, X))');
    const [h] = hypothesisRows(s, env);
    expect(short[(h?.line ?? 0) - 1]).toBe('assume AB < AC');
  });

  it('without a registry statementLines counts the canonical text, as before', () => {
    const canonical = print(s.doc).split('\n');
    const line = [...statementLines(s.doc).claims.values()][0];
    expect(canonical[(line?.line ?? 0) - 1]).toBe(line?.text);
    expect(line?.line).toBe(10);
  });
});
