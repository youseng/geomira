/**
 * ADR-0051: the header's "Test a claim" box. Its logic is the editor's (claim-bar.ts), the web
 * app only draws it: the forms it reads (from the notation table and Geomdraw's short forms),
 * completions at the cursor, and what it could not read, with columns of the box's own text.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { print } from '@geomira/lang/print';
import {
  claimCompletions,
  claimForms,
  claimLine,
  runClaimText,
  SHORT_CLAIM_FORMS,
} from '../src/claim-bar';
import { docOf, editorOf, env } from './helpers/editor';

const FIG = [
  'A = (0, 4)',
  'B = (-3, 0)',
  'C = (4, 0)',
  'D = (1, -2)',
  'P = midpoint(B, C)',
  'Q = midpoint(C, A)',
  'R = midpoint(A, B)',
  'ω = circumcircle(A, B, C)',
  'γ = circle(P, Q)',
].join('\n');

const labels = (text: string, cursor = text.length) =>
  claimCompletions(editorOf(FIG), text, cursor).map((c) => c.label);

describe('the claim box runs a claim of the language', () => {
  it('AP, BQ, CR concurrent: the claim, written canonically', () => {
    const r = runClaimText(editorOf(FIG), 'AP, BQ, CR concurrent', env);
    expect(r.kind).toBe('edit');
    if (r.kind === 'edit')
      expect(print(r.result.state.doc)).toContain(
        'claim concurrent(line(A, P), line(B, Q), line(C, R))',
      );
  });

  it('"claim" may be written; leading spaces are taken off', () => {
    expect(claimLine('claim AB ⟂ CD')).toEqual({ line: 'claim AB ⟂ CD', offset: 0 });
    expect(claimLine('  AB ⟂ CD')).toEqual({ line: 'claim AB ⟂ CD', offset: 4 });
    expect(runClaimText(editorOf(FIG), 'claim AP ⟂ BC', env).kind).toBe('edit');
  });

  it('what it could not read: the word, at its column in the box', () => {
    const r = runClaimText(editorOf(FIG), 'AP, BQ, CR are concurrent', env);
    expect(r.kind).toBe('error');
    if (r.kind !== 'error') return;
    const [d] = r.diagnostics;
    expect(d?.message).toContain('could not read "are"');
    expect(d?.hint).toContain('AP, BQ, CR concurrent');
    expect([d?.line, d?.column, d?.endColumn]).toEqual([1, 12, 15]);
    const typed = runClaimText(editorOf(FIG), 'claim AP, BQ, CR are concurrent', env);
    expect(typed.kind === 'error' ? typed.diagnostics[0]?.column : 0).toBe(18);
  });

  it('an empty box is refused with what to do', () => {
    expect(runClaimText(editorOf(FIG), '  ', env)).toEqual({
      kind: 'error',
      reason: 'type a claim',
      diagnostics: [],
    });
  });
});

describe('the forms it reads', () => {
  it('every short form reads as its kind', () => {
    for (const f of SHORT_CLAIM_FORMS) {
      const text = [
        ...['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'D = (5, 2)', 'P = (2, 2)'],
        ...['Q = (3, -1)', 'R = (-1, 1)', 'ω = circle(A, B)', 'γ = circle(C, D)'],
        `claim ${f.form}`,
      ].join('\n');
      expect(
        docOf(text).claims.map((c) => c.kind),
        f.form,
      ).toEqual([f.kind]);
    }
  });

  it('the forms cover every kind of the registry', () => {
    const kinds = new Set(claimForms().map((f) => f.kind));
    for (const k of claimKindRegistry().kinds) expect(kinds.has(k.name), k.name).toBe(true);
  });
});

describe('completions at the cursor', () => {
  it('at the start: the claim kinds (with their forms) and the objects', () => {
    expect(labels('conc')).toEqual(['conconic', 'concyclic', 'concurrent']);
    const [first] = claimCompletions(editorOf(FIG), 'concu', 5);
    expect(first).toMatchObject({ insert: 'concurrent(', detail: 'concurrent(l, m, n, …)' });
    expect(labels('ω')).toEqual([]);
    expect(labels('γ')).toEqual([]);
    expect(labels('Q')).toEqual([]);
    expect(labels('P')).toEqual(['parallel', 'perpendicular']);
  });

  it('after a list of objects: the list words', () => {
    expect(labels('AP, BQ, CR c')).toEqual(['cyclic', 'collinear', 'concyclic', 'concurrent']);
    expect(labels('AP, BQ, CR ')).toEqual(['cyclic', 'collinear', 'concyclic', 'concurrent']);
  });

  it('after one object: the words between two objects, and the list words', () => {
    expect(labels('AP pe')).toEqual(['perpendicular']);
    expect(labels('P o')).toEqual(['on']);
  });

  it('inside a call: the objects', () => {
    expect(labels('concurrent(line(A, P), line(B')).toEqual([]);
    expect(labels('collinear(')).toContain('A');
    expect(labels('on(P, ω), x')).toEqual([]);
  });
});
