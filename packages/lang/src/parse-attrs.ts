/**
 * Attributes (ADR-0009): bracket groups `[key, key=value, key=v1,v2]`; a list-valued key
 * (exclude, layers, viewport) takes the rest of its group. Directives also take bare
 * `key=value` items (`@view proof layers=main,inv`).
 */
import type { Attr, AttrValue } from './ast';
import { describe, expect, fail, isPunct, next, peek, since, type Cursor } from './cursor';

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
    } else {
      fail(
        c,
        `unexpected ${describe(t)}`,
        bare ? 'attributes are key=value or [key=value]' : 'attributes go in brackets: [color=red]',
      );
      return undefined;
    }
  }
  return out;
}
