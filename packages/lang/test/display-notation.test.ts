/**
 * The language of the display values (ADR-0011): marks are plain calls, text takes a string
 * literal as a whole call argument (only there: a string is not an expression), printed with
 * the lexer's escapes. P1–P3 on a document holding every display tool, defined, with images
 * in a derived layer; and the document generator of laws P1–P3 draws every display tool.
 */
import fc from 'fast-check';
import { evaluate } from '@geomira/kernel/evaluate';
import { evalContextFor } from '@geomira/kernel/context';
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { sameUpToIds, sortImageRuns } from '../src/canonical';
import { parse } from '../src/parse';
import { parseInto } from '../src/parse-into';
import { print } from '../src/print';
import { docArb } from './helpers/gen-doc';
import { defOf, file, firstError, parseOk, registry } from './helpers/lang';

const FIGURE = file(
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'H = rotate(B, A, 90)',
  'a = mark_angle(B, A, C, 2) [color=red]',
  'r = mark_right(B, A, H)',
  's = mark_segment(A, B)',
  's_3 = mark_segment(B, C, 3) [dash=dashed]',
  't = text(C, "Let \\\\omega be \\"the\\" circle\\t#1") [label_angle=90, label_dist=4]',
  'T = reflect(line(A, C))',
  '@layer m = image(T, main)',
);

function kinds(text: string): Record<string, string> {
  const doc = parseOk(text);
  const c = evalContextFor(doc);
  if (!c.ok) throw new Error(c.reason);
  const ev = evaluate(doc, registry, FloatField, c.ctx);
  return Object.fromEntries(doc.objects.map((o) => [o.name, ev.values.get(o.id)?.kind ?? '?']));
}

describe('display values in the language (ADR-0011)', () => {
  it('parses every display tool; each is defined, and its image in a derived layer too', () => {
    const k = kinds(FIGURE);
    expect([k.a, k.r, k.s, k.s_3, k.t]).toEqual([
      'angle_mark',
      'angle_mark',
      'segment_mark',
      'segment_mark',
      'text',
    ]);
    expect([k['a*'], k['r*'], k['s*'], k['s_3*'], k['t*']]).toEqual([
      'angle_mark',
      'angle_mark',
      'segment_mark',
      'segment_mark',
      'text',
    ]);
    expect(defOf(parseOk(FIGURE), 't')).toMatchObject({
      kind: 'call',
      tool: 'text',
      args: [{ kind: 'ref' }, { kind: 'str', value: 'Let \\omega be "the" circle\t#1' }],
    });
  });

  it('prints strings with the escapes of the lexer, and P1–P3 hold on this document', () => {
    const doc = parseOk(FIGURE);
    const text = print(doc);
    expect(text).toContain('t = text(C, "Let \\\\omega be \\"the\\" circle\\t#1")');
    expect(text).toContain('a = mark_angle(B, A, C, 2) [color=red]');
    const back = parse(text, registry);
    expect(back.diagnostics).toEqual([]);
    expect(sameUpToIds(back.doc, doc)).toBe(true);
    expect(print(back.doc)).toBe(text);
    const into = parseInto(doc, text, registry);
    expect(into.diagnostics).toEqual([]);
    expect(sortImageRuns(into.doc).objects).toEqual(sortImageRuns(doc).objects);
    expect(into.doc.nextId).toBe(doc.nextId);
  });

  it('a string is a whole call argument only: never an expression or an operand', () => {
    expect(firstError('x = "a"').message).toContain('expected an expression');
    expect(firstError('x = "a"').hint).toBe(
      'a string is only an argument of a call, as in text(P, "…")',
    );
    expect(firstError('A = (0, 0)\nt = text(A, "a" + 1)').message).toContain(
      'expected an expression',
    );
    expect(firstError('A = (0, 0)\nm = midpoint(A, "a")').message).toContain(
      'midpoint does not accept (point, string)',
    );
    expect(firstError('A = (0, 0)\nt = text(A, 3)').message).toContain(
      'text does not accept (point, number)',
    );
  });

  it('the generator of laws P1–P3 draws every display tool and its images', () => {
    const seen = new Set<string>();
    for (const doc of fc.sample(docArb(registry), { numRuns: 300, seed: 1 }))
      for (const o of doc.objects)
        if (o.def.kind === 'call') {
          seen.add(o.def.tool);
          if (o.def.tool === 'text' && o.def.args[1]?.kind === 'str') seen.add('string literal');
        }
    for (const t of ['mark_angle', 'mark_right', 'mark_segment', 'text', 'string literal'])
      expect(seen.has(t), t).toBe(true);
  });
});
