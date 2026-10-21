import { describe, expect, it } from 'vitest';
import { isUserName } from '@geomira/kernel/names';
import { createRng, type Rng } from '@geomira/num/rng';
import { parseLabel, type LabelRun } from '@geomira/scene/label-text';
import { texLabel, texProse } from '../src/tex-label';
import { TEX_TABLE } from '../src/tex-text';

const label = (name: string, star?: string) =>
  texLabel(parseLabel(name), star === undefined ? {} : { star }).tex;

describe('texLabel: names map to math (note D)', () => {
  it.each([
    ['A', '$A$'],
    ['A1', '$A1$'],
    ['A_1', '$A_{1}$'],
    ['M_a', '$M_{a}$'],
    ['A_{12}', '$A_{12}$'],
    ['M_{ab}', '$M_{ab}$'],
    ["H'", "$H'$"],
    ["A_1''", "$A_{1}''$"],
    ['A*', '$A^{*}$'],
    ['A**', '$A^{**}$'],
    ["H'*", '$H^{\\prime *}$'],
    ["M_a'*", '$M_{a}^{\\prime *}$'],
    ['ω', '$\\omega$'],
    ['\\omega', '$\\omega$'],
    ["ω'", "$\\omega'$"],
    ['ω*', '$\\omega^{*}$'],
    ['x_a', '$x_{a}$'],
    ['ν', '$\\nu$'],
    ['ωa', '$\\omega a$'],
    ['Γ_1', '$\\Gamma_{1}$'],
    ['l*', '$l^{*}$'],
  ])('%s → %s', (name, tex) => {
    const r = texLabel(parseLabel(name));
    expect(r.tex).toBe(tex);
    expect(r.math).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("an image's star is configurable", () => {
    expect(label('A*', '\\ast')).toBe('$A^{\\ast}$');
    expect(label('A**', '\\ast')).toBe('$A^{\\ast\\ast}$');
    expect(label("H'*", '\\star')).toBe('$H^{\\prime \\star}$');
  });

  it('labels that are not names are prose', () => {
    const r = texLabel(parseLabel('Feuerbach point'));
    expect(r).toEqual({ tex: 'Feuerbach point', math: false, warnings: [] });
    expect(texLabel(parseLabel('X_{1} & co')).tex).toBe('X\\textsubscript{1} \\& co');
    expect(texLabel(parseLabel('50%^2')).tex).toBe('50\\%\\textsuperscript{2}');
  });

  it('a text object is always prose, with the label grammar', () => {
    expect(texProse(parseLabel('Let \\omega be the circle')).tex).toBe(
      'Let $\\omega$ be the circle',
    );
    expect(texProse(parseLabel('A')).tex).toBe('A');
    expect(texProse(parseLabel('M_a')).tex).toBe('M\\textsubscript{a}');
  });

  it('unknown characters warn in labels and in prose', () => {
    const r = texLabel(parseLabel('Pé'));
    expect(r.tex).toBe('P?');
    expect(r.warnings.map((w) => w.char)).toEqual(['é']);
    expect(texProse(parseLabel('☃')).warnings.map((w) => w.codePoint)).toEqual([0x2603]);
  });

  it('an empty label is empty', () => {
    expect(texLabel([])).toEqual({ tex: '', math: false, warnings: [] });
  });
});

// ---- round trip: every name form of the grammar (ADR-0009) reads back from its TeX ----

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const GREEK = Object.entries(TEX_TABLE)
  .filter(([c, e]) => e.kind === 'atom' && /\p{Script=Greek}/u.test(c))
  .map(([c]) => c);

function pick(rng: Rng, s: readonly string[] | string): string {
  const xs = Array.from(s);
  return xs[rng.nextInt(xs.length)] ?? 'A';
}

/** A random name of the grammar: point names in every form, other names, primes, stars. */
function randomName(rng: Rng): string {
  let n: string;
  if (rng.nextInt(2) === 0) {
    n = pick(rng, UPPER);
    const form = rng.nextInt(5);
    if (form === 1) n += String(rng.nextInt(100));
    if (form === 2) n += `_${String(rng.nextInt(100))}`;
    if (form === 3) n += `_${pick(rng, UPPER + LOWER)}`;
    if (form === 4) {
      let g = '';
      for (let k = 0, len = 1 + rng.nextInt(4); k < len; k++)
        g += pick(rng, UPPER + LOWER + '0123456789');
      n += `_{${g}}`;
    }
  } else {
    n = rng.nextInt(3) === 0 ? pick(rng, GREEK) : pick(rng, LOWER);
    for (let k = 0, len = rng.nextInt(5); k < len; k++)
      n += pick(rng, [...Array.from(LOWER), ...Array.from('0123456789'), ...GREEK]);
  }
  n += "'".repeat(rng.nextInt(3));
  n += '*'.repeat(rng.nextInt(3));
  return n;
}

const PRIME_CHARS = ['', '′', '″', '‴', '⁗'];
const BY_TEX = new Map(
  Object.entries(TEX_TABLE).flatMap(([c, e]) =>
    e.kind === 'atom' && e.tex !== 'o' ? [[e.tex, c] as const] : [],
  ),
);

/** Reads a math label back into runs (the test's own reader, independent of the writer). */
function readMath(tex: string): LabelRun[] {
  expect(tex.startsWith('$') && tex.endsWith('$')).toBe(true);
  const s = tex.slice(1, -1);
  const runs: LabelRun[] = [];
  const push = (text: string, pos: LabelRun['pos']) => {
    if (text === '') return;
    const last = runs[runs.length - 1];
    if (last?.pos === pos) runs[runs.length - 1] = { text: last.text + text, pos };
    else runs.push({ text, pos });
  };
  let primes = 0;
  const flushPrimes = () => {
    if (primes > 0) push(PRIME_CHARS[primes] ?? '′'.repeat(primes), 'base');
    primes = 0;
  };
  const token = (src: string, i: number): [string, number] => {
    if (src[i] === '\\') {
      const m = /^\\(mathrm\{[A-Z]\}|[A-Za-z]+) ?/u.exec(src.slice(i));
      const word = m?.[1] ?? '';
      return [`\\${word}`, i + (m?.[0].length ?? 1)];
    }
    return [src[i] ?? '', i + 1];
  };
  const group = (i: number): [string, number] => {
    expect(s[i]).toBe('{');
    const end = s.indexOf('}', i);
    return [s.slice(i + 1, end), end + 1];
  };
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === "'") {
      primes++;
      i++;
    } else if (c === '_' || c === '^') {
      flushPrimes();
      const [g, next] = group(i + 1);
      let text = '';
      let p = 0;
      for (let j = 0; j < g.length;) {
        const [t, n] = token(g, j);
        if (t === '\\prime') p++;
        else text += BY_TEX.get(t) ?? t;
        j = n;
      }
      if (p > 0) push(PRIME_CHARS[p] ?? '′'.repeat(p), 'base');
      push(text, c === '_' ? 'sub' : 'sup');
      i = next;
    } else if (c === '{' && s[i + 1] === '}') {
      i += 2;
    } else {
      flushPrimes();
      const [t, next] = token(s, i);
      push(BY_TEX.get(t) ?? t, 'base');
      i = next;
    }
  }
  flushPrimes();
  return runs;
}

/** TeX writes omicron as the letter o (they are the same glyph), so the reader cannot tell them apart. */
function omicronAsO(runs: readonly LabelRun[]): LabelRun[] {
  return runs.map((r) => ({ text: r.text.replaceAll('ο', 'o'), pos: r.pos }));
}

describe('every name form round-trips through its TeX label', () => {
  it('2000 random names of the grammar read back to the scene label runs', () => {
    const rng = createRng(20261021);
    let tested = 0;
    for (let k = 0; k < 2000; k++) {
      const name = randomName(rng);
      if (!isUserName(name.replace(/\*+$/u, ''))) continue;
      const runs = parseLabel(name);
      const r = texLabel(runs);
      expect(r.math, name).toBe(true);
      expect(readMath(r.tex), name).toEqual(omicronAsO(runs));
      tested++;
    }
    expect(tested).toBeGreaterThan(1500);
  });
});
