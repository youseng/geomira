/**
 * The style card of a measurement (ADR-0048), pure and DOM-free. A number whose definition
 * the figure can draw (dist, angle or dangle of named objects: scene measureDef) gets the card
 * kind 'distance' or 'angle'; its "Visible" control is the `show` attribute (numbers were never
 * drawn, so absent means not drawn), and its fields are those of a drawn object while the
 * draft shows it, else only "Visible" and the decimals, with a note. Any other number stays
 * "Not drawn", with the reason when its style asks for `show`.
 */
import type { DocObject, Style } from '@geomira/kernel/document';
import type { Value, ValueKind } from '@geomira/kernel/value';
import { MAX_DIGITS, measureDef } from '@geomira/scene/measure';
import { cardKindOf, fieldsOf, patchStyle, type CardFields, type CardKind } from './style-draft';

/** The card kind of an object: a drawable measurement's, else by its value's kind. */
export function cardKindFor(
  o: DocObject,
  v: Value<number> | undefined,
  fixed: ValueKind | null,
): CardKind {
  const kind = cardKindOf(v?.kind ?? 'undefined', fixed);
  const number = v?.kind === 'number' || fixed === 'number';
  if (!number) return kind;
  const m = measureDef(o.def);
  return m.kind === 'none' ? kind : m.kind;
}

/** Whether the card kind is a measurement's. */
export function isMeasure(kind: CardKind): kind is 'distance' | 'angle' {
  return kind === 'distance' || kind === 'angle';
}

/** Whether a measurement's style draws it: `show`, not `hidden`. */
export function measureShown(s: Style): boolean {
  return s.show === true && s.hidden !== true;
}

/** The draft shown (`show`, and not hidden) or not (no `show`). */
export function withShown(draft: Style, shown: boolean): Style {
  return shown
    ? patchStyle(draft, { show: true, hidden: undefined })
    : patchStyle(draft, { show: undefined });
}

/** The card's fields: a measurement not shown offers only "Visible" and its decimals. */
export function cardFields(kind: CardKind, shown: Style): CardFields {
  if (isMeasure(kind) && !measureShown(shown)) return { main: ['visible'], more: ['digits'] };
  return fieldsOf(kind);
}

/**
 * The card's "Not drawn" note, or undefined when the object can be drawn as styled: a
 * measurement not shown says how to show it; a number that is not a drawable measurement says
 * why when its style asks for `show`; other undrawn values (strings, maps) as before.
 */
export function notDrawnNote(o: DocObject, kind: CardKind, shown: Style): string | undefined {
  if (isMeasure(kind))
    return measureShown(shown) ? undefined : 'Not drawn: tick "shown" to draw its value.';
  if (kind !== 'none') return undefined;
  const m = measureDef(o.def);
  return m.kind === 'none' && shown.show === true
    ? `Not drawn: ${m.reason}.`
    : 'Not drawn: nothing to style.';
}

/** Typed decimals: empty removes the field; a whole number in [0, MAX_DIGITS]; else null. */
export function typedDigits(text: string): number | undefined | null {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isInteger(n) && n >= 0 && n <= MAX_DIGITS ? n : null;
}
