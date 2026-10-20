import { describe, expect, it } from 'vitest';
import { call, lit, ref } from '@geomira/kernel/expr';
import { emptyDocument, type Document } from '@geomira/kernel/document';
import { rational } from '@geomira/num/rational';
import { print } from '../src/print';
import { printExpr } from '../src/print-expr';
import { file, parseOk } from './helpers/lang';

const roundTrip = (text: string): string => print(parseOk(text));

describe('the printer (deterministic, @version always, numbers as written, comments kept)', () => {
  it('@version is always printed, even for an empty document', () => {
    expect(print(emptyDocument())).toBe('@version 1\n');
  });

  it('a canonical text prints back unchanged', () => {
    const t = [
      '# header',
      '@version 1',
      '@title "Figure \\"1\\""',
      '@author "Ann"',
      '@layer base [main, visible=false]',
      '@layer aux [locked, opacity=0.25, order=7]',
      '@layer inv = image(s, base) [suffix=**] [exclude=l]',
      '@view v [layers=aux,-inv] [viewport=1.5,-2,40]',
      '@viewport -0 1e-7 50',
      'A = (0.50, -3/4)  # A',
      'B = (2, 60°) [color=red, width=1.5, dash=dashed, hidden=false, noimage, label="b\\n"]',
      'l = line(A, B) [layers=aux,base]',
      '# the map',
      's = reflect(l)',
      'style A** [hidden]',
      'k = -(2) * -1/2 - (3 - 4) / -k0',
      'assume AB < AB',
      'claim parallel(l, l) [name=c]  # trivially',
      '# end',
      '',
    ].join('\n');
    const withK0 = t.replace('k = -(2)', 'k0 = 1\nk = -(2)');
    expect(roundTrip(withK0)).toBe(withK0);
  });

  it('is deterministic and order-preserving', () => {
    const t = file('B = (1, 1)', 'A = (0, 0)', 'claim A = B', 'claim B = A');
    expect(roundTrip(t)).toBe(roundTrip(t));
    expect(roundTrip(t)).toBe(`${t}\n`);
  });

  it('numbers: as written when that text reads back, else canonical', () => {
    const e = (text: string | undefined): string =>
      printExpr(
        text === undefined ? lit(rational(1n, 2n)) : lit(rational(1n, 2n), text),
        () => undefined,
      );
    expect([
      e(undefined),
      e('0.5'),
      e('0.50'),
      e('2/4'),
      e('1/2°'),
      e('0.6'),
      e('garbage'),
      e('1e-1'),
    ]).toEqual(['1/2', '0.5', '0.50', '2/4', '1/2°', '1/2', '1/2', '1/2']);
  });

  it('arithmetic: fewest parentheses that keep the tree', () => {
    const n = (id: number): string | undefined => ['', 'a', 'b', 'c'][id];
    const [a, b, c] = [ref(1), ref(2), ref(3)];
    const p = (x: Parameters<typeof printExpr>[0]): string => printExpr(x, n);
    expect(p(call('sub', [a, call('sub', [b, c])]))).toBe('a - (b - c)');
    expect(p(call('sub', [call('sub', [a, b]), c]))).toBe('a - b - c');
    expect(p(call('add', [a, call('add', [b, c])]))).toBe('a + (b + c)');
    expect(p(call('mul', [call('add', [a, b]), c]))).toBe('(a + b) * c');
    expect(p(call('neg', [call('mul', [a, b])]))).toBe('-(a * b)');
    expect(p(call('neg', [lit(rational(2n))]))).toBe('-(2)');
    expect(p(call('neg', [call('neg', [a])]))).toBe('-(-a)');
    expect(p(call('mul', [call('neg', [a]), b]))).toBe('-a * b');
    expect(p(call('sub', [a, lit(rational(-1n))]))).toBe('a - -1');
    expect(p(call('point', [a, call('neg', [b])]))).toBe('(a, -b)');
    expect(p(call('add', [a]))).toBe('add(a)');
  });

  it('strings and colours: words stay words, everything else is quoted and escaped', () => {
    const t = file(
      'A = (0, 0) [color="Dark Red", label="tab\\tquote\\"\\u{1}"]',
      'B = (1, 0) [color=blue_2]',
    );
    expect(roundTrip(t)).toBe(`${t}\n`);
  });

  it('a managed image appears only as a style line when it has a style or a comment', () => {
    const t = file(
      '@layer r = image(s, main)',
      'A = (1, 0)',
      'B = (2, 0)',
      's = reflect((0, 0))',
      '# B* matters',
      'style B*',
      'claim A* = B*',
    );
    expect(roundTrip(t)).toBe(`${t}\n`);
  });

  it('comments whose anchor is gone are kept at the end', () => {
    const doc: Document = {
      ...emptyDocument(),
      meta: { comments: [{ anchor: { kind: 'object', id: 9 }, lines: [' lost'] }] },
    };
    expect(print(doc)).toBe('@version 1\n# lost\n');
  });
});
