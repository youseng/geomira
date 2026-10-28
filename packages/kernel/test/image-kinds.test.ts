/**
 * Found in the pre-beta review (bug-fix round, ADR-0028): the static kinds of the selector
 * checks (selector-check.ts `staticKinds`) took a call's kinds from the tool's whole
 * outputKinds and ignored the overload the arguments resolve to (ADR-0007 decision 4). The
 * image of a line, reflect(l, k), rotate(l, O, θ), apply(T, l), and every managed image l*
 * (apply(T, l)) could then be a circle, so intersect(m, k) of two lines was a parse error
 * "line ∩ circle can have two candidates and the call has no selector". The editor's checks
 * use the same callDiagnostics. An image now has its figure's kinds (Signature.preserves),
 * in both static-kind functions (staticKinds and the derived layers' exprKinds).
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { exprKinds, objectKinds } from '../src/derived';
import { call, type Expr } from '../src/expr';
import { selectorDiagnostics, staticKinds } from '../src/selector-check';
import { REGISTRY, contextOf, evalDoc, num, pt, valueOf } from './helpers/doc';
import { ed, idOf, refOf } from './helpers/derived-fixture';
import { emptyDocument, type Document } from '../src/document';

/** O, A, B, C; l = line(A, B), k = line(O, C), c = circle(O, A); t = rotate(O, 90); layer img = image(t, main). */
function figure(): Document {
  let doc = emptyDocument();
  const add = (name: string, def: Expr): void => {
    doc = ed(doc, { kind: 'add', object: { name, def } });
  };
  add('O', pt(0, 0));
  add('A', pt(1, 2));
  add('B', pt(3, 1));
  add('C', pt(0, 5));
  add('l', call('line', [refOf(doc, 'A'), refOf(doc, 'B')]));
  add('k', call('line', [refOf(doc, 'O'), refOf(doc, 'C')]));
  add('c', call('circle', [refOf(doc, 'O'), refOf(doc, 'A')]));
  add('t', call('rotate', [refOf(doc, 'O'), num(90)]));
  return ed(doc, {
    kind: 'addDerivedLayer',
    spec: { name: 'img', transform: idOf(doc, 't'), source: 'main' },
  });
}

function withObject(doc: Document, name: string, def: Expr): Document {
  return ed(doc, { kind: 'add', object: { name, def } });
}

function messages(doc: Document): string[] {
  return selectorDiagnostics(doc, REGISTRY).map((d) => d.message);
}

describe('images keep their figure kinds in the static checks', () => {
  it('intersect of an image line and a line needs no selector (sugar, apply, managed image)', () => {
    const doc = figure();
    const r = (n: string) => refOf(doc, n);
    const cases: Expr[] = [
      call('reflect', [r('l'), r('k')]),
      call('rotate', [r('l'), r('O'), num(90)]),
      call('homothety', [r('l'), r('O'), num(2)]),
      call('translate', [r('l'), r('A'), r('B')]),
      call('spiral', [r('l'), r('O'), r('A'), r('B'), r('C')]),
      call('apply', [r('t'), r('l')]),
      r('l*'),
    ];
    for (const m of cases) {
      const d = withObject(doc, 'P', call('intersect', [m, r('k')]));
      expect(messages(d)).toEqual([]);
      const ev = evalDoc(d, FloatField, contextOf(d));
      expect(valueOf(d, ev, 'P').kind).toBe('point');
    }
  });

  it('a named image line is a line, and intersecting it with a line needs no selector', () => {
    const doc = figure();
    const m = withObject(doc, 'm', call('reflect', [refOf(doc, 'l'), refOf(doc, 'k')]));
    const d = withObject(m, 'P', call('intersect', [refOf(m, 'm'), refOf(m, 'k')]));
    expect(messages(d)).toEqual([]);
    const kinds = objectKinds(d, REGISTRY);
    for (const n of ['m', 'l*', 'm*']) expect(kinds.get(idOf(d, n))).toEqual(['line']);
  });

  it('an image circle still needs a selector with a line; a cline image is a circle or a line', () => {
    const doc = figure();
    const r = (n: string) => refOf(doc, n);
    const d = withObject(doc, 'P', call('intersect', [call('reflect', [r('c'), r('k')]), r('k')]));
    expect(messages(d)).toEqual([
      'intersect(reflect(c, k), k): line ∩ circle can have two candidates and the call has no selector',
    ]);
    const e = withObject(doc, 'Q', call('intersect', [r('c*'), r('k')]));
    expect(messages(e)).toEqual([
      'intersect(c*, k): line ∩ circle can have two candidates and the call has no selector',
    ]);
    const kindsOf = (x: Expr) => staticKinds(x, () => undefined, REGISTRY);
    const cl = call('cline', [pt(0, 0), pt(1, 0), pt(0, 1)]);
    expect(kindsOf(call('reflect', [cl, call('line', [pt(0, 0), pt(1, 1)])]))).toEqual([
      'line',
      'circle',
    ]);
  });

  it('staticKinds and exprKinds narrow to the resolved overloads', () => {
    const doc = figure();
    const table = objectKinds(doc, REGISTRY);
    const kindsOfRef = (id: number) => table.get(id);
    const r = (n: string) => refOf(doc, n);
    const both = (e: Expr) => [staticKinds(e, kindsOfRef, REGISTRY), exprKinds(e, table, REGISTRY)];
    expect(both(call('reflect', [r('l')]))).toEqual([['transform'], ['transform']]);
    expect(both(call('reflect', [r('A'), r('l')]))).toEqual([['point'], ['point']]);
    expect(both(call('reflect', [r('l'), r('k')]))).toEqual([['line'], ['line']]);
    expect(both(call('reflect', [r('c'), r('k')]))).toEqual([['circle'], ['circle']]);
    expect(both(call('apply', [r('t'), r('c')]))).toEqual([['circle'], ['circle']]);
    expect(both(call('apply', [r('t'), call('polygon', [r('A'), r('B'), r('C')])]))).toEqual([
      ['polygon'],
      ['polygon'],
    ]);
    // An argument of unknown kind (an unknown tool) may be any figure apply takes.
    const applied = [
      ...['point', 'line', 'circle', 'polygon', 'angle_mark', 'segment_mark', 'text'],
      'ideal_point',
      'conic',
    ];
    expect(both(call('apply', [r('t'), call('nosuch', [])]))).toEqual([applied, applied]);
    // No overload fits: staticKinds falls back to the tool's outputKinds, exprKinds is unknown.
    expect(both(call('apply', [r('A'), r('A')]))).toEqual([applied, undefined]);
  });
});
