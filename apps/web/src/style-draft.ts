/**
 * The style card's model (ADR-0029), pure and DOM-free: which fields an object's kind shows,
 * what the object inherits (an image its source's style), and the draft operations. The card
 * edits a DRAFT Style; the canvas previews it (withDraft) without any edit; "Write to script"
 * applies it as one `style` edit (writeEdit), so every state the user keeps is in the text.
 * The values the card shows are in style-values.ts.
 *
 * A field set back to the value it would have anyway (the inherited value, else the scene's
 * default) is removed from the draft rather than written, so touching a control and moving
 * it back leaves nothing to write.
 */
import type { DocObject, Document, Style } from '@geomira/kernel/document';
import { sourceOf } from '@geomira/kernel/derived';
import type { Value, ValueKind } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';

/** Every field of a Style, in the text's order; the type check below keeps it complete. */
export const STYLE_FIELDS = [
  'color',
  'width',
  'dash',
  'opacity',
  'hidden',
  'noimage',
  'label',
  'z',
  'labelAngle',
  'labelDist',
] as const satisfies readonly (keyof Style)[];

type Missing = Exclude<keyof Style, (typeof STYLE_FIELDS)[number]>;
/** A compile error here means a Style field is missing from STYLE_FIELDS. */
export const STYLE_FIELDS_COMPLETE: [Missing] extends [never] ? true : never = true;

/** What the card offers for a kind of object. */
export type CardKind = 'point' | 'curve' | 'text' | 'none';

/** A field of the card's main rows. */
export type Field = 'color' | 'width' | 'opacity' | 'label' | 'visible';

/** A field behind the card's "More" disclosure. */
export type MoreField = 'dash' | 'z' | 'labelOffset' | 'noimage';

export interface CardFields {
  readonly main: readonly Field[];
  readonly more: readonly MoreField[];
}

/** The fields of each kind (ADR-0029). */
export function fieldsOf(kind: CardKind): CardFields {
  switch (kind) {
    case 'point':
      return {
        main: ['color', 'width', 'opacity', 'label', 'visible'],
        more: ['z', 'labelOffset', 'noimage'],
      };
    case 'curve':
      return {
        main: ['color', 'width', 'opacity', 'label', 'visible'],
        more: ['dash', 'z', 'labelOffset', 'noimage'],
      };
    case 'text':
      return { main: ['color', 'opacity', 'visible'], more: ['z', 'labelOffset', 'noimage'] };
    case 'none':
      return { main: [], more: [] };
    default:
      return assertNever(kind, 'card kind');
  }
}

/**
 * The card kind of a value kind: lines, circles, polygons and marks are curves; numbers,
 * strings and maps (the static kind 'mobius' marks a map, ADR-0032) are not drawn. Undefined and Inexact values have no kind of their own:
 * the object's static kind decides (null when it has none or several: then the card offers
 * the curve fields, the most general set).
 */
export function cardKindOf(v: ValueKind, fixed: ValueKind | null): CardKind {
  switch (v) {
    case 'point':
    case 'text':
      return v;
    case 'line':
    case 'circle':
    case 'polygon':
    case 'angle_mark':
    case 'segment_mark':
      return 'curve';
    case 'number':
    case 'string':
    case 'transform':
    case 'mobius':
      return 'none';
    case 'undefined':
    case 'inexact':
      return fixed === null ? 'curve' : cardKindOf(fixed, null);
    default:
      return assertNever(v, 'value kind');
  }
}

/** The kind the card's header names (a segment, a ray, an arc: as the value is). */
export function kindName(v: Value<number> | undefined, fixed: ValueKind | null): string {
  if (v === undefined) return fixed ?? 'object';
  switch (v.kind) {
    case 'line':
      if (v.lo === null && v.hi === null) return 'line';
      if (v.outside === true) return 'two rays';
      return v.hi === null || v.lo === null ? 'ray' : 'segment';
    case 'circle':
      return v.arc === null ? 'circle' : 'arc';
    case 'angle_mark':
      return 'angle mark';
    case 'segment_mark':
      return 'segment mark';
    case 'transform':
      return 'map';
    case 'inexact':
      return fixed === null ? 'not representable' : `${fixed}, not representable`;
    case 'undefined':
      return fixed === null ? 'undefined' : `${fixed}, undefined`;
    case 'point':
    case 'number':
    case 'polygon':
    case 'text':
    case 'string':
      return v.kind;
    default:
      return assertNever(v, 'value');
  }
}

export type StylePatch = { [K in keyof Style]?: Style[K] | undefined };

/** The style with the fields of `patch` set (a field set to undefined is removed). */
export function patchStyle(s: Style, patch: StylePatch): Style {
  const x = { ...s, ...patch };
  return {
    ...(x.color === undefined ? {} : { color: x.color }),
    ...(x.width === undefined ? {} : { width: x.width }),
    ...(x.dash === undefined ? {} : { dash: x.dash }),
    ...(x.opacity === undefined ? {} : { opacity: x.opacity }),
    ...(x.hidden === undefined ? {} : { hidden: x.hidden }),
    ...(x.noimage === undefined ? {} : { noimage: x.noimage }),
    ...(x.label === undefined ? {} : { label: x.label }),
    ...(x.z === undefined ? {} : { z: x.z }),
    ...(x.labelAngle === undefined ? {} : { labelAngle: x.labelAngle }),
    ...(x.labelDist === undefined ? {} : { labelDist: x.labelDist }),
  };
}

/**
 * The draft with `key` set to `value`, or without `key` when `value` is `base`: what the
 * object shows without the field (its inherited value, else the default).
 */
export function setField<K extends keyof Style>(
  draft: Style,
  key: K,
  value: Style[K],
  base: Style[K],
): Style {
  const patch: StylePatch = {};
  patch[key] = Object.is(value, base) ? undefined : value;
  return patchStyle(draft, patch);
}

/** Whether two styles set the same fields to the same values. */
export function sameStyle(a: Style, b: Style): boolean {
  return STYLE_FIELDS.every((k) => Object.is(a[k], b[k]));
}

/** "Write to script" is offered when the draft differs from the object's style. */
export function canWrite(draft: Style, current: Style): boolean {
  return !sameStyle(draft, current);
}

/** "Reset" is offered when the draft differs from the default style (no attribute at all). */
export function canReset(draft: Style): boolean {
  return !sameStyle(draft, {});
}

/** The one edit "Write to script" applies. */
export function writeEdit(id: number, draft: Style) {
  return { kind: 'style', id, style: draft } as const;
}

/** The document with object `id` styled `draft` (the canvas's preview; not an edit). */
export function withDraft(doc: Document, id: number, draft: Style): Document {
  const o = doc.objects.find((x) => x.id === id);
  if (o === undefined || sameStyle(o.style, draft)) return doc;
  return { ...doc, objects: doc.objects.map((x) => (x.id === id ? { ...x, style: draft } : x)) };
}

/**
 * What an object's own style is laid over: for a managed image, its source's effective style
 * (recursively), the label text taking the rule's suffix as the scene does (scene/style.ts
 * effectiveStyle); for any other object, nothing. A source chain that loops stops.
 */
export function inheritedStyle(doc: Document, o: DocObject): Style {
  const byId = new Map(doc.objects.map((x) => [x.id, x]));
  const sourceOfObject = (x: DocObject) => {
    const id = x.managedBy === undefined ? undefined : sourceOf(x);
    return id === undefined ? undefined : byId.get(id);
  };
  const chain: DocObject[] = [];
  const seen = new Set([o.id]);
  for (let s = sourceOfObject(o); s !== undefined && !seen.has(s.id); s = sourceOfObject(s)) {
    chain.push(s);
    seen.add(s.id);
  }
  let style: Style = {};
  for (const x of [...chain.reverse(), o]) {
    const rule = doc.layers.find((l) => l.id === x.managedBy)?.rule;
    const suffix = x.managedBy === undefined ? '' : (rule?.suffix ?? '');
    const inherited =
      style.label === undefined || style.label === ''
        ? style
        : { ...style, label: style.label + suffix };
    style = x === o ? inherited : { ...inherited, ...x.style };
  }
  return style;
}
