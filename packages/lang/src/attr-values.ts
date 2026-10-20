/**
 * The meaning of attributes (ADR-0009): every Style field (color, width, dash, hidden,
 * noimage, label; z, label_angle, label_dist since ADR-0010), an object's layers, a claim's name, layer options and rules, view
 * contents, triangle types. Each statement kind accepts its own keys; anything else is an
 * error with the list of keys it takes.
 */
import type { Style } from '@geomira/kernel/document';
import type { Attr, AttrValue } from './ast';
import { error, type Diagnostic } from './diagnostic';
import { floatLiteral } from './lex-literals';

export const STYLE_KEYS: readonly string[] = Object.freeze([
  'color',
  'width',
  'dash',
  'hidden',
  'noimage',
  'label',
  'z',
  'label_angle',
  'label_dist',
]);
export const DASHES: readonly string[] = Object.freeze(['solid', 'dashed', 'dotted']);

export interface Checked {
  readonly diags: Diagnostic[];
}

/** The attributes by key; unknown or repeated keys are reported. */
export function byKey(
  attrs: readonly Attr[],
  allowed: readonly string[],
  what: string,
  out: Checked,
): Map<string, Attr> {
  const m = new Map<string, Attr>();
  for (const a of attrs) {
    if (!allowed.includes(a.key)) {
      out.diags.push(
        error(a.span, `${what} has no attribute "${a.key}"`, `${what} takes ${allowed.join(', ')}`),
      );
    } else if (m.has(a.key)) {
      out.diags.push(error(a.span, `the attribute "${a.key}" is given twice`, 'keep one'));
    } else m.set(a.key, a);
  }
  return m;
}

function single(a: Attr, out: Checked): AttrValue | undefined {
  const v = a.values?.[0];
  if (a.values?.length !== 1 || v === undefined) {
    out.diags.push(error(a.span, `"${a.key}" takes one value`, `write ${a.key}=…`));
    return undefined;
  }
  return v;
}

/** `key` alone is true; `key=true` / `key=false`. */
export function boolAttr(a: Attr, out: Checked): boolean | undefined {
  if (a.values === null) return true;
  const v = single(a, out);
  if (v?.kind === 'word' && !v.minus && (v.text === 'true' || v.text === 'false'))
    return v.text === 'true';
  if (v !== undefined)
    out.diags.push(
      error(v.span, `"${a.key}" is true or false`, `write ${a.key} or ${a.key}=false`),
    );
  return undefined;
}

/** A finite double in [lo, hi]. */
export function numberAttr(a: Attr, lo: number, hi: number, out: Checked): number | undefined {
  const v = single(a, out);
  const x = v?.kind === 'number' ? floatLiteral(v.text) : undefined;
  if (x !== undefined && x >= lo && x <= hi) return x;
  if (v !== undefined) {
    out.diags.push(
      error(
        v.span,
        `"${a.key}" takes a number in [${String(lo)}, ${String(hi)}]`,
        `write ${a.key}=1`,
      ),
    );
  }
  return undefined;
}

export function textAttr(a: Attr, words: boolean, out: Checked): string | undefined {
  const v = single(a, out);
  if (v?.kind === 'string' || (words && v?.kind === 'word' && !v.minus)) return v.text;
  if (v !== undefined)
    out.diags.push(
      error(
        v.span,
        `"${a.key}" takes ${words ? 'a word or ' : ''}a quoted text`,
        `write ${a.key}="…"`,
      ),
    );
  return undefined;
}

/** A list of names (exclude, layers); `minus` marks `-name` (views only). */
export function namesAttr(a: Attr, allowMinus: boolean, out: Checked): readonly AttrValue[] {
  const vs = a.values ?? [];
  const bad = vs.find((v) => v.kind !== 'word' || (v.minus && !allowMinus));
  if (a.values === null || bad !== undefined) {
    out.diags.push(
      error(bad?.span ?? a.span, `"${a.key}" takes a list of names`, `write ${a.key}=a,b`),
    );
    return [];
  }
  return vs;
}

/** The Style of an object's attributes (layers are read by the caller). */
export function styleOf(m: ReadonlyMap<string, Attr>, out: Checked): Style {
  let s: Style = {};
  const color = m.get('color');
  const width = m.get('width');
  const dash = m.get('dash');
  const hidden = m.get('hidden');
  const noimage = m.get('noimage');
  const label = m.get('label');
  if (color !== undefined) {
    const c = textAttr(color, true, out);
    if (c !== undefined) s = { ...s, color: c };
  }
  if (width !== undefined) {
    const w = numberAttr(width, 0, Number.MAX_VALUE, out);
    if (w !== undefined) s = { ...s, width: w };
  }
  if (dash !== undefined) {
    const d = textAttr(dash, true, out);
    if (d === 'solid' || d === 'dashed' || d === 'dotted') s = { ...s, dash: d };
    else if (d !== undefined)
      out.diags.push(error(dash.span, `dash is ${DASHES.join(', ')}`, 'write dash=dashed'));
  }
  const h = hidden === undefined ? undefined : boolAttr(hidden, out);
  if (h !== undefined) s = { ...s, hidden: h };
  const n = noimage === undefined ? undefined : boolAttr(noimage, out);
  if (n !== undefined) s = { ...s, noimage: n };
  if (label !== undefined) {
    const t = textAttr(label, false, out);
    if (t !== undefined) s = { ...s, label: t };
  }
  return { ...s, ...sceneStyle(m, out) };
}

/** The scene's Style fields (ADR-0010): z, label_angle (degrees), label_dist (pixels). */
function sceneStyle(m: ReadonlyMap<string, Attr>, out: Checked): Style {
  const [z, angle, dist] = [m.get('z'), m.get('label_angle'), m.get('label_dist')];
  const zv = z === undefined ? undefined : numberAttr(z, -Number.MAX_VALUE, Number.MAX_VALUE, out);
  const av =
    angle === undefined ? undefined : numberAttr(angle, -Number.MAX_VALUE, Number.MAX_VALUE, out);
  const dv = dist === undefined ? undefined : numberAttr(dist, 0, Number.MAX_VALUE, out);
  return {
    ...(zv === undefined ? {} : { z: zv }),
    ...(av === undefined ? {} : { labelAngle: av }),
    ...(dv === undefined ? {} : { labelDist: dv }),
  };
}
