/** Test figures: a text parsed by the language and evaluated in floats (as the app does). */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evalContextFor } from '@geomira/kernel/context';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import { createRegistry } from '@geomira/kernel/registry';
import type { Value } from '@geomira/kernel/value';
import { parse } from '@geomira/lang/parse';
import { FloatField } from '@geomira/num/float-field';
import { exportFrame, type ExportFrame, type ExportOptions } from '../../src/frame';

export const REGISTRY = createRegistry();

export interface Figure {
  readonly doc: Document;
  readonly values: ReadonlyMap<number, Value<number>>;
}

export function figure(text: string): Figure {
  const r = parse(text, REGISTRY);
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) throw new Error(`test figure has errors: ${JSON.stringify(errors)}`);
  const c = evalContextFor(r.doc);
  const values = evaluate(r.doc, REGISTRY, FloatField, c.ok ? c.ctx : { scale: 1 }).values;
  return { doc: r.doc, values };
}

export function frameOf(text: string, options: ExportOptions = {}): ExportFrame {
  const { doc, values } = figure(text);
  const r = exportFrame(doc, values, options);
  if (!r.ok) throw new Error(r.problem);
  return r.frame;
}

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** The repository's examples (name without .geo, text). */
export function examples(): { name: string; text: string }[] {
  const dir = `${ROOT}examples/`;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.geo'))
    .sort()
    .map((f) => ({ name: f.slice(0, -4), text: readFileSync(dir + f, 'utf8') }));
}
