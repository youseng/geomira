import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { toAsymptote, toAsymptoteCheck } from '../src/asy';
import { ASY_RESERVED, AsyNames } from '../src/asy-names';
import { exactNum } from '../src/asy-plan';
import { asyString } from '../src/asy-draw';
import { frameOf, REGISTRY } from './helpers/figure';

const EULER = readFileSync('examples/euler-line.geo', 'utf8');
const INCENTER = readFileSync('examples/incenter-excenter.geo', 'utf8');

function figureSection(src: string): string[] {
  const lines = src.split('\n');
  const a = lines.indexOf('// ---- the figure ----');
  const b = lines.indexOf('// ---- drawing, back to front as on the screen ----');
  return lines.slice(a + 1, b - 1);
}

describe('Asymptote: named pairs, constructive where mapped (SPEC §14, note C)', () => {
  it('the Euler line example reads as its construction', () => {
    const t = toAsymptote(frameOf(EULER), REGISTRY, 'standalone').text;
    expect(figureSection(t)).toEqual([
      'pair A = (1, 4);',
      'pair B = (-2, 0);',
      'pair C = (5, 0);',
      'path abc = A--B--C--cycle;',
      'pair O = gm_circumcenter(A, B, C);',
      'pair G = gm_centroid(A, B, C);',
      'pair H = gm_orthocenter(A, B, C);',
      'gmline e = gm_line(O, H);',
    ]);
  });

  it('a call that does not map is numeric and marked; its references are still declared', () => {
    const t = toAsymptote(frameOf(INCENTER), REGISTRY, 'standalone').text;
    const fig = figureSection(t);
    expect(fig).toContain('pair I = gm_incenter(A, B, C);');
    expect(fig).toContain('pair M = gm_lc_other(gm_line(A, I), omega, A);');
    expect(fig.find((l) => l.startsWith('pair I_a = '))).toMatch(
      /^pair I_a = \(-?[\d.e-]+, -?[\d.e-]+\); \/\/ numeric$/u,
    );
  });

  it('writes only the helpers it uses, each once, dependencies first', () => {
    const t = toAsymptote(frameOf(EULER), REGISTRY, 'standalone').text;
    expect(t.match(/^pair gm_circumcenter\(/gmu)).toHaveLength(1);
    expect(t.indexOf('pair gm_circumcenter(')).toBeLessThan(t.indexOf('pair gm_orthocenter('));
    expect(t).not.toContain('gm_lc(');
    expect(t).not.toContain('import ');
  });

  it('standalone loads amssymb and clips to the view; the picture is the whole view', () => {
    const t = toAsymptote(frameOf(EULER), REGISTRY, 'standalone').text;
    expect(t).toContain('texpreamble("\\usepackage{amssymb}");');
    expect(t).toMatch(/draw\(box\(.*\), invisible\);.*\nclip\(box\(.*\)\);\n$/u);
  });

  it('the aops dialect imports olympiad and calls only its documented foot, circumcenter, incenter', () => {
    const t = toAsymptote(frameOf(INCENTER), REGISTRY, 'aops').text;
    expect(t).toContain('import olympiad;');
    expect(t).toContain('pair I = incenter(A, B, C);');
    expect(t).not.toContain('texpreamble');
    expect(t).not.toContain('gm_incenter');
    const e = toAsymptote(frameOf(EULER), REGISTRY, 'aops').text;
    expect(e).toContain('pair O = circumcenter(A, B, C);');
    const foot = toAsymptote(
      frameOf('@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\nF = foot(C, A, B)\n'),
      REGISTRY,
      'aops',
    ).text;
    expect(foot).toContain('pair F = foot(C, A, B);');
  });

  it('the check variant is the standalone file plus one write per variable', () => {
    const f = frameOf(EULER);
    const plain = toAsymptote(f, REGISTRY, 'standalone');
    const check = toAsymptoteCheck(f, REGISTRY);
    expect(check.text.startsWith(plain.text)).toBe(true);
    const writes = check.text
      .slice(plain.text.length)
      .split('\n')
      .filter((l) => l.startsWith('gm_w("'));
    expect(writes).toHaveLength(plain.plan.decls.length);
    expect(writes).toContain(`gm_w("${String(plain.plan.decls[0]?.id)}", new real[] {A.x, A.y});`);
    expect(writes.some((l) => l.includes(', abc);'))).toBe(true);
  });

  it('hidden objects a construction needs are declared but not drawn', () => {
    const t = toAsymptote(
      frameOf(
        '@version 1\nA = (0, 0)\nB = (4, 0)\nM = midpoint(A, B) [hidden]\nN = midpoint(M, B)\n',
      ),
      REGISTRY,
      'standalone',
    ).text;
    expect(t).toContain('pair M = gm_midpoint(A, B);');
    expect(t).toContain('pair N = gm_midpoint(M, B);');
    expect(t).not.toContain('// M\n');
  });
});

describe('Asymptote names', () => {
  it.each([
    ['A', 'A'],
    ["H'", 'Hp'],
    ["A_1''", 'A_1pp'],
    ['A*', 'As'],
    ["H'**", 'Hpss'],
    ['M_{ab}', 'M_ab'],
    ['ω', 'omega'],
    ['Γ_1', 'Gamma_1'],
    ['ω*', 'omegas'],
    ['x_a', 'x_a'],
  ])('%s → %s', (name, id) => {
    expect(new AsyNames().of(name)).toBe(id);
  });

  it('reserved words, called functions and gm prefixes get an underscore', () => {
    const n = new AsyNames();
    expect(n.of('path')).toBe('path_');
    expect(n.of('foot')).toBe('foot_');
    expect(n.of('incenter')).toBe('incenter_');
    expect(n.of('gm_x')).toBe('gm_x_');
    expect(ASY_RESERVED).toContain('cycle');
  });

  it('two names that spell the same get distinct identifiers; a name keeps its identifier', () => {
    const n = new AsyNames();
    expect(n.of("A'")).toBe('Ap');
    expect(n.of('Ap')).toBe('Ap_2');
    expect(n.of("A'")).toBe('Ap');
  });

  it('numbers are written so that Asymptote reads back the same double', () => {
    for (const x of [0, -0, 1 / 3, -2.5e21, 1e-7, 123.456, Number.MAX_VALUE])
      expect(Number(exactNum(x))).toBe(Object.is(x, -0) ? 0 : x);
    expect(exactNum(-0)).toBe('0');
  });

  it("Asymptote strings escape only the double quote (TeX's backslashes pass)", () => {
    expect(asyString('$\\omega$ "x"')).toBe('"$\\omega$ \\"x\\""');
  });
});
