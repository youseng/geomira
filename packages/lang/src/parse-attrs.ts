/**
 * Attributes (ADR-0009): bracket groups `[key, key=value, key=v1,v2]`; a list-valued key
 * (exclude, layers, viewport) takes the rest of its group. Directives also take bare
 * `key=value` items (`@view proof layers=main,inv`). Statements also take Geomdraw's style
 * words (ADR-0025): `@red`, `@dashed`, `@thick`, `@hidden`, `@nolabel`, … each one of the
 * attributes above (`@red` is `[color=red]`).
 */
import type { Attr, AttrValue } from './ast';
import type { Token } from './token';
import { describe, expect, fail, isPunct, next, peek, since, type Cursor } from './cursor';

/** Geomdraw's style words: `@word` and the attribute it stands for (key, value). */
const STYLE_WORDS: Readonly<Record<string, readonly [string, AttrValue['kind'] | null, string]>> =
  Object.freeze({
    dashed: ['dash', 'word', 'dashed'],
    dotted: ['dash', 'word', 'dotted'],
    solid: ['dash', 'word', 'solid'],
    thick: ['width', 'number', '2.5'],
    thin: ['width', 'number', '1'],
    hidden: ['hidden', null, ''],
    nolabel: ['label', 'string', ''],
    noimage: ['noimage', null, ''],
    ...Object.fromEntries(
      ['black', 'red', 'blue', 'green', 'orange', 'purple', 'brown', 'teal', 'gray', 'grey'].map(
        (w) => [w, ['color', 'word', w] as const],
      ),
    ),
  });

/** The words `@word` may be (for hints). */
export const STYLE_WORD_LIST: readonly string[] = Object.freeze(Object.keys(STYLE_WORDS));

function styleWord(c: Cursor): Attr | undefined {
  const t = next(c);
  const w = t === undefined ? undefined : STYLE_WORDS[t.value];
  if (t === undefined || w === undefined) {
    fail(
      c,
      `unexpected ${describe(t)}`,
      `style words are @${STYLE_WORD_LIST.join(', @')}; or write [color=…]`,
      t,
    );
    return undefined;
  }
  const [key, kind, text] = w;
  const values = kind === null ? null : [{ text, kind, minus: false, span: t }];
  return { key, values, span: t };
}

/** Keys whose value is a comma-separated list. */
export const LIST_KEYS: readonly string[] = Object.freeze(['exclude', 'layers', 'viewport']);

function value(c: Cursor): AttrValue | undefined {
  const t = peek(c);
  if (t === undefined) {
    fail(c, 'expected a value, found the end of the line', 'write key=value');
    return undefined;
  }
  if (t.kind === 'punct' && t.value === '*') {
    const start = t;
    let text = '';
    while (isPunct(c, '*') && (text === '' || peek(c)?.spaceBefore === false)) {
      next(c);
      text += '*';
    }
    return { text, kind: 'stars', minus: false, span: since(c, start) };
  }
  const minus = t.kind === 'punct' && t.value === '-';
  if (minus) next(c);
  const v = next(c);
  if (v === undefined) {
    fail(c, 'expected a value after "-"', 'write -main or -2');
    return undefined;
  }
  if (minus && v.spaceBefore) {
    fail(c, 'nothing may separate "-" from its value', 'write -main or -2', v);
    return undefined;
  }
  const span = since(c, t);
  switch (v.kind) {
    case 'number':
      return { text: (minus ? '-' : '') + v.text, kind: 'number', minus: false, span };
    case 'name':
    case 'point':
      return { text: v.value, kind: 'word', minus, span };
    case 'string':
      if (!minus) return { text: v.value, kind: 'string', minus, span };
      fail(c, 'a string cannot be negative', 'remove the "-"', span);
      return undefined;
    case 'punct':
    case 'directive': {
      fail(c, `expected a value, found ${describe(v)}`, 'write key=value', v);
      return undefined;
    }
    default: {
      fail(c, `expected a value, found ${describe(v)}`, 'write key=value', v);
      return undefined;
    }
  }
}

/** One item; `inGroup` lets a list run to the closing bracket. */
function item(c: Cursor, inGroup: boolean): Attr | undefined {
  const k = next(c);
  if (k === undefined || (k.kind !== 'name' && k.kind !== 'point')) {
    fail(
      c,
      `expected an attribute name, found ${describe(k)}`,
      'write [color=red], [hidden] or [name=foo]',
      k,
    );
    return undefined;
  }
  if (!isPunct(c, '=')) return { key: k.value, values: null, span: k };
  next(c);
  const values: AttrValue[] = [];
  const list = LIST_KEYS.includes(k.value);
  for (;;) {
    const v = value(c);
    if (v === undefined) return undefined;
    values.push(v);
    if (!list || !isPunct(c, ',')) break;
    if (!inGroup && peek(c, 1)?.spaceBefore === true) break;
    next(c);
  }
  return { key: k.value, values, span: since(c, k) };
}

/** `[item, item, …]` at the cursor. */
function group(c: Cursor): Attr[] | undefined {
  next(c);
  const out: Attr[] = [];
  if (isPunct(c, ']')) {
    next(c);
    return out;
  }
  for (;;) {
    const a = item(c, true);
    if (a === undefined) return undefined;
    out.push(a);
    if (!isPunct(c, ',')) break;
    next(c);
  }
  return expect(c, ']', 'close the attribute group with ]') === undefined ? undefined : out;
}

/**
 * The hint for a token after a complete expression: `2a`, `2 a`, `2(…)` and `(…)(…)` are
 * products, `sqrt 2` a call without parentheses, `1,5` a decimal comma; otherwise the token
 * starts attributes outside brackets.
 */
function strayHint(c: Cursor, t: Token): string {
  const prev = c.tokens[c.i - 1];
  const after = c.tokens[c.i + 1];
  const operand = t.kind === 'number' || t.kind === 'name' || t.kind === 'point' || t.value === '(';
  const attr = t.kind === 'name' && after?.kind === 'punct' && after.value === '=';
  const right = t.value === '(' ? '(…)' : t.text;
  if (t.value === ',' && prev?.kind === 'number' && after?.kind === 'number' && !after.spaceBefore)
    return `write ${prev.text}.${after.text}: decimals use a point`;
  if (prev?.kind === 'number' && (t.text === 'deg' || t.text === 'degrees'))
    return `angles are in degrees: write ${prev.text} or ${prev.text}°`;
  if (operand && !attr && prev?.kind === 'name')
    return `write ${prev.text}(${right}) to call ${prev.text}, or ${prev.text} * ${right} for a product`;
  if (operand && !attr && (prev?.kind === 'number' || prev?.value === ')'))
    return `write ${prev.kind === 'number' ? prev.text : '(…)'} * ${right} for a product`;
  return 'attributes go in brackets: [color=red]';
}

/** Every attribute up to the end of the line; `bare` allows items outside brackets. */
export function parseAttrs(c: Cursor, bare: boolean): Attr[] | undefined {
  const out: Attr[] = [];
  for (let t = peek(c); t !== undefined; t = peek(c)) {
    if (t.kind === 'punct' && t.value === '[') {
      const g = group(c);
      if (g === undefined) return undefined;
      out.push(...g);
    } else if (bare && (t.kind === 'name' || t.kind === 'point')) {
      const a = item(c, false);
      if (a === undefined) return undefined;
      out.push(a);
    } else if (!bare && t.kind === 'directive') {
      const a = styleWord(c);
      if (a === undefined) return undefined;
      out.push(a);
    } else {
      fail(
        c,
        `unexpected ${describe(t)}`,
        bare ? 'attributes are key=value or [key=value]' : strayHint(c, t),
      );
      return undefined;
    }
  }
  return out;
}
