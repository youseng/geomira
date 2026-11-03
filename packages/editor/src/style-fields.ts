/** Styles compared field by field (the GUI tools that build with a style, ADR-0048). */
import type { Style } from '@geomira/kernel/document';

/**
 * `style` with the fields of `fields` set, or undefined when it has them all already (same
 * values, by Object.is): then nothing is to be written.
 */
export function withFields(style: Style, fields: Style): Style | undefined {
  const want = { ...style, ...fields };
  const had = Object.entries(style);
  const same =
    Object.keys(want).length === had.length &&
    had.every(([k, v]) => Object.entries(want).some(([k2, v2]) => k === k2 && Object.is(v, v2)));
  return same ? undefined : want;
}
