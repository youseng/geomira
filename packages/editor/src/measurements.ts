/**
 * The data behind the web app's Measurements list (ADR-0048): every number object of the
 * figure (static kind number, or a number value) in construction order, with its definition,
 * its current value as the figure shows it (the style's `digits` decimals, ° for angles: the
 * scene's formatMeasure) and whether it is drawn. An Undefined or Inexact value is listed as
 * such with its reason (shown as undefined, never as garbage, as the Objects panel does).
 */
import { objectKinds } from '@geomira/kernel/derived';
import { formatExpr } from '@geomira/kernel/selector';
import { digitsOf, formatMeasure, inDegrees, measureDef } from '@geomira/scene/measure';
import type { EditorEnv, EditorState } from './state';

export interface MeasurementRow {
  readonly id: number;
  readonly name: string;
  /** The definition as text, with names. */
  readonly definition: string;
  readonly status: 'ok' | 'undefined' | 'inexact';
  /** The value as shown ("5.00", "90.00°"), or null when it has none. */
  readonly value: string | null;
  /** Why the value is Undefined or Inexact. */
  readonly reason?: string;
  /** The style asks for it to be drawn (`show`, not `hidden`). */
  readonly shown: boolean;
  /** Why it cannot be drawn on the figure (not a drawable measurement), if so. */
  readonly notDrawable?: string;
}

/** Every number object with its value as shown (see the module comment). */
export function measurementRows(state: EditorState, env: EditorEnv): MeasurementRow[] {
  const kinds = objectKinds(state.doc, env.registry);
  const byId = new Map(state.doc.objects.map((x) => [x.id, x.name]));
  const names = (id: number) => byId.get(id);
  return state.doc.objects.flatMap((o): MeasurementRow[] => {
    const v = state.values.values.get(o.id);
    const ks = kinds.get(o.id);
    const isNumber = v?.kind === 'number' || (ks?.length === 1 && ks[0] === 'number');
    if (!isNumber) return [];
    const m = measureDef(o.def);
    const row = {
      id: o.id,
      name: o.name,
      definition: formatExpr(o.def, names),
      shown: o.style.show === true && o.style.hidden !== true,
      ...(m.kind === 'none' ? { notDrawable: m.reason } : {}),
    };
    if (v?.kind === 'number')
      return [
        {
          ...row,
          status: 'ok',
          value: formatMeasure(v.v, digitsOf(o.style), inDegrees(o.def)),
        },
      ];
    if (v?.kind === 'inexact')
      return [{ ...row, status: 'inexact', value: null, reason: v.reason }];
    const reason = v?.kind === 'undefined' ? v.reason : 'not evaluated';
    return [{ ...row, status: 'undefined', value: null, reason }];
  });
}
