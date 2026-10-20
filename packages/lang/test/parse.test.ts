import { describe, expect, it } from 'vitest';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import { checkInvariants } from '@geomira/kernel/invariants';
import { syncProblems } from '@geomira/kernel/derived';
import { formatExpr } from '@geomira/kernel/selector';
import { rational } from '@geomira/num/rational';
import { parse } from '../src/parse';
import { defOf, file, idOf, parseOk, registry } from './helpers/lang';

const text = (doc: ReturnType<typeof parseOk>, name: string): string =>
  formatExpr(defOf(doc, name), (id) => doc.objects.find((o) => o.id === id)?.name);

describe('definitions and expressions', () => {
  const doc = parseOk(
    file('A = (0, 0)', 'B = point(4, -3/4)', 'k = 2/3 + 0.5 * -k0', 'k0 = 1').replace(
      'k = 2/3 + 0.5 * -k0\nk0 = 1',
      'k0 = 1\nk = 2/3 + 0.5 * -k0',
    ),
  );

  it('(x, y) is point(x, y); numbers are exact, kept as written', () => {
    expect(defOf(doc, 'A')).toEqual(call('point', [lit(rational(0n)), lit(rational(0n))]));
    expect(defOf(doc, 'B')).toEqual(call('point', [lit(rational(4n)), lit(rational(-3n, 4n))]));
    const k = defOf(doc, 'k');
    expect(k).toEqual(
      call('add', [
        lit(rational(2n, 3n)),
        call('mul', [lit(rational(1n, 2n), '0.5'), call('neg', [ref(idOf(doc, 'k0'))])]),
      ]),
    );
  });

  it('precedence and associativity: unary > product > sum, left-associative', () => {
    const d = parseOk(
      file(
        'a = 1',
        'b = a - a - a',
        'c = a - (a - a)',
        'e = -a * a',
        'f = -(a * a)',
        'g = a / a * a',
        'h = -2 * a',
        'i = - 2',
      ),
    );
    expect(text(d, 'b')).toBe('sub(sub(a, a), a)');
    expect(text(d, 'c')).toBe('sub(a, sub(a, a))');
    expect(text(d, 'e')).toBe('mul(neg(a), a)');
    expect(text(d, 'f')).toBe('neg(mul(a, a))');
    expect(text(d, 'g')).toBe('mul(div(a, a), a)');
    expect(text(d, 'h')).toBe('mul(-2, a)');
    expect(text(d, 'i')).toBe('neg(2)');
  });

  it('nested calls, selectors last, other(P) as selector vs other(a, b, P) as tool', () => {
    const d = parseOk(
      file(
        'A = (1, 3)',
        'B = (0, 0)',
        'C = (4, 0)',
        'ω = circumcircle(A, B, C)',
        'X = intersect(line(A, midpoint(B, C)), ω, other(A))',
        'Y = other(line(A, B), ω, A)',
        'Z = intersect(line(B, C), ω, along(+))',
        'W = intersect(ω, circle(B, A), orient(-))',
        'V = intersect(line(A, C), ω, on_arc(B, C, not A))',
        'U = intersect(line(A, C), ω, same_side(B, line(A, B)), near(C))',
      ),
    );
    expect(text(d, 'X')).toBe('intersect(line(A, midpoint(B, C)), ω, other(A))');
    expect(text(d, 'Y')).toBe('other(line(A, B), ω, A)');
    expect(text(d, 'Z')).toBe('intersect(line(B, C), ω, along(+))');
    expect(text(d, 'W')).toBe('intersect(ω, circle(B, A), orient(-))');
    expect(text(d, 'V')).toBe('intersect(line(A, C), ω, on_arc(B, C, not A))');
    expect(text(d, 'U')).toBe('intersect(line(A, C), ω, same_side(B, line(A, B)), near(C))');
  });

  it('on(obj) without a parameter gets an explicit one (ADR-0004 item 9)', () => {
    const d = parseOk(
      file(
        'A = (0, 0)',
        'B = (4, 0)',
        'l = line(A, B)',
        'P = on(l)',
        'ω = circle(A, B)',
        'Q = on(ω)',
        'c = circle(A, 2)',
        'R = on(c)',
      ),
    );
    expect(text(d, 'P')).toBe('on(l, 1/3)');
    expect(text(d, 'Q')).toBe('on(ω, 2, 1)');
    expect(text(d, 'R')).toBe('on(c, 90)');
  });

  it('math functions may start an expression; Greek escapes name objects', () => {
    const d = parseOk(file('t = 9/4', 'k = sqrt(t)', '\\omega = circle((0, 0), 1)'));
    expect(text(d, 'k')).toBe('sqrt(t)');
    expect(d.objects.map((o) => o.name)).toContain('ω');
  });
});

describe('statements', () => {
  it('triangle A B C [acute]: free points, polygon, assume lines; deterministic', () => {
    const t = file('triangle A B C [acute]');
    const d = parseOk(t);
    expect(d.objects.map((o) => o.name)).toEqual(['A', 'B', 'C', 'tri_ABC']);
    expect(d.assumptions.map((a) => a.kind)).toEqual(['acute']);
    expect(parseOk(t)).toEqual(d);
    const o = parseOk(file('triangle P Q R [obtuse_at_Q, scalene]'));
    expect(o.assumptions.map((a) => a.kind)).toEqual(['scalene', 'greater']);
  });

  it('style, label and attributes cover every Style field', () => {
    const d = parseOk(
      file(
        'A = (0, 0) [color=red, width=2.5, dash=dotted, hidden, noimage=false, label="A₀"]',
        'B = (1, 0)',
        'style B [color="#00ff00"] [hidden=false]',
        'label B "the \\"B\\""',
      ),
    );
    expect(d.objects[0]?.style).toEqual({
      color: 'red',
      width: 2.5,
      dash: 'dotted',
      hidden: true,
      noimage: false,
      label: 'A₀',
    });
    expect(d.objects[1]?.style).toEqual({ color: '#00ff00', hidden: false, label: 'the "B"' });
  });

  it('layers, derived layers (suffix, exclude), views, viewport, title, author', () => {
    const d = parseOk(
      file(
        '@title "T"',
        '@author "me"',
        '@layer aux [visible=false] [locked] [opacity=0.5]',
        '@layer inv = image(s, main) [suffix=**] [exclude=a]',
        '@view only [layers=inv,-main] [viewport=1,-2,50]',
        '@viewport 0 0 40',
        'A = (1, 3)',
        'B = (0, 0)',
        'a = line(A, B)',
        's = reflect(a)',
        'C = (2, 2) [layers=aux,main]',
      ),
    );
    expect(d.meta.title).toBe('T');
    expect(d.meta.author).toBe('me');
    expect(d.viewport).toEqual({ cx: 0, cy: 0, zoom: 40 });
    const aux = d.layers.find((l) => l.name === 'aux');
    const inv = d.layers.find((l) => l.name === 'inv');
    expect(aux).toMatchObject({ visible: false, locked: true, opacity: 0.5, order: 1 });
    expect(inv?.rule).toEqual({
      transform: ref(idOf(d, 's')),
      source: 'main',
      suffix: '**',
      exclude: [idOf(d, 'a')],
    });
    expect(d.objects.map((o) => o.name)).toEqual(['A', 'B', 'a', 's', 'A**', 'B**', 'C', 'C**']);
    expect(d.objects.find((o) => o.name === 'C')?.layers).toEqual([aux?.id, 'main']);
    expect(d.views).toEqual([
      {
        name: 'only',
        layerVisibility: { [inv?.id ?? '']: true, main: false },
        viewport: { cx: 1, cy: -2, zoom: 50 },
      },
    ]);
    expect(checkInvariants(d)).toEqual([]);
    expect(syncProblems(d, registry)).toEqual([]);
  });

  it('@layer lines may come before or after what they name; the main layer can be renamed', () => {
    const d = parseOk(
      file(
        'A = (0, 0)',
        'T = translate(A, (1, 0))',
        '@layer base [main] [visible=false]',
        '@layer t = image(T, base)',
      ),
    );
    expect(d.layers[0]).toMatchObject({ id: 'main', name: 'base', visible: false });
    expect(d.objects.map((o) => o.name)).toEqual(['A', 'T', 'A*']);
  });

  it('images of images, managed lowercase names and their styles', () => {
    const d = parseOk(
      file(
        '@layer one = image(t, main)',
        '@layer two = image(t, one)',
        'A = (1, 0)',
        'B = (0, 1)',
        'l = line(A, B)',
        't = rotate((0, 0), 90)',
        'm = l**',
        'style l* [color=red]',
      ),
    );
    expect(d.objects.map((o) => o.name)).toEqual([
      'A',
      'B',
      'l',
      't',
      'A*',
      'A**',
      'B*',
      'B**',
      'l*',
      'l**',
      'm',
      'm*',
      'm**',
    ]);
    expect(d.objects.find((o) => o.name === 'l*')?.style).toEqual({ color: 'red' });
  });

  it('claims and assumptions may name objects defined later', () => {
    const d = parseOk(
      file(
        'claim collinear(A, B, C) [name=c1]',
        'assume AB < AC',
        'A = (0, 0)',
        'B = (1, 0)',
        'C = (5, 1)',
      ),
    );
    expect(d.claims).toEqual([
      {
        id: d.claims[0]?.id,
        name: 'c1',
        kind: 'collinear',
        args: [ref(1), ref(2), ref(3)].map((r, i) => ref(d.objects[i]?.id ?? r.id)),
      },
    ]);
    const a = d.assumptions[0];
    expect(a?.kind).toBe('less');
    const args: readonly Expr[] = a?.args ?? [];
    expect(args.map((x) => (x.kind === 'call' ? x.tool : x.kind))).toEqual(['dist', 'dist']);
  });

  it('comments: before a statement, inline, on style lines, at the end; header before @version', () => {
    const d = parseOk(
      [
        '# head',
        '@version 1',
        '# about A',
        'A = (0, 0)  # origin',
        '# styled',
        'style A [hidden]',
        '# end',
      ].join('\n'),
    );
    expect(d.meta.comments).toEqual([
      { anchor: { kind: 'header' }, lines: [' head'] },
      {
        anchor: { kind: 'object', id: idOf(d, 'A') },
        lines: [' about A', ' styled'],
        inline: ' origin',
      },
      { anchor: { kind: 'end' }, lines: [' end'] },
    ]);
  });

  it('per-line recovery: the other lines are built; the result is always valid', () => {
    const r = parse(
      file(
        'A = (0, 0)',
        'B = midpoint(A, Q)',
        'C = (1, 1)',
        'D = midpoint(B, C)',
        'E = midpoint(A, C)',
      ),
      registry,
    );
    expect(r.doc.objects.map((o) => o.name)).toEqual(['A', 'C', 'E']);
    expect(r.diagnostics.map((d) => [d.line, d.message])).toEqual([
      [3, 'unknown name "Q"'],
      [5, 'B is not defined: its line 3 has an error'],
    ]);
    expect(checkInvariants(r.doc)).toEqual([]);
  });

  it('CRLF line ends are read like LF', () => {
    expect(parseOk(file('A = (0, 0)', 'B = (1, 2)').replace(/\n/gu, '\r\n'))).toEqual(
      parseOk(file('A = (0, 0)', 'B = (1, 2)')),
    );
  });
});
