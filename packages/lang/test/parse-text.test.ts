/**
 * ADR-0047: a text is parsed once while it is typed. The text panel's diagnostics parse
 * (parseText, with repeated constructions as warnings, ADR-0029) is handed on to replaceText,
 * which keeps ids with `rebase`: the result must be exactly parseInto's (law P3).
 */
import { describe, expect, it } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { parse } from '../src/parse';
import { parseInto } from '../src/parse-into';
import { parseText, rebase } from '../src/parse-text';
import { print } from '../src/print';
import { file, parseOk, registry } from './helpers/lang';

const base = parseOk(
  file(
    '@layer aux',
    '@layer r = image(s, main)',
    'A = (0, 0) [color=red]',
    'B = (4, 0)',
    'C = (1, 3) [layers=aux,main]',
    's = reflect(line(A, B))',
    'l = line(A, B)',
    'claim collinear(A, B, C)',
    'assume acute(A, B, C)',
  ),
);

const TEXTS = [
  print(base),
  print(base).replace('B = (4, 0)', 'B = (5, 0)'),
  // A repeated construction: a warning in the panel's parse, accepted by the kernel.
  `${print(base)}m = line(B, A)\n`,
  print(base).replace('A = (0, 0) [color=red]', 'D = (2, 2)\nA = (0, 0)'),
  // An error: rebase reports it as parseInto does.
  `${print(base)}M = midpoint(A, Q)\n`,
  '',
];

describe('parseText and rebase (ADR-0047)', () => {
  it('rebase of the panel parse is parseInto, document and errors', () => {
    for (const text of TEXTS) {
      const p = parseText(text, registry);
      expect(p.text).toBe(text);
      expect(p.registry).toBe(registry);
      const r = rebase(base, p.result);
      const into = parseInto(base, text, registry);
      expect(r.doc, text).toEqual(into.doc);
      const errors = (ds: typeof r.diagnostics) => ds.filter((d) => d.severity === 'error');
      expect(errors(r.diagnostics)).toEqual(errors(into.diagnostics));
    }
  });

  it('the panel parse reports a repeated construction as a warning and keeps its line', () => {
    const text = `${print(base)}m = line(B, A)\n`;
    const p = parseText(text, registry);
    expect(p.result.diagnostics.map((d) => d.severity)).toEqual(['warning']);
    expect(p.result.doc).toEqual(parse(text, registry).doc);
  });

  it('keeps the registry it parsed with (another registry is another parse)', () => {
    const other = createRegistry();
    expect(parseText('A = (0, 0)', other).registry).toBe(other);
  });
});
