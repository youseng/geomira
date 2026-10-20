/** Shared helpers of the language tests. */
import { createRegistry } from '@geomira/kernel/registry';
import type { Document } from '@geomira/kernel/document';
import type { Expr } from '@geomira/kernel/expr';
import { formatDiagnostic, type Diagnostic } from '../../src/diagnostic';
import { parse } from '../../src/parse';

export const registry = createRegistry();

/** Law iteration counts: NIGHTLY=1 runs ten times as many. */
export function runs(n: number): number {
  return process.env.NIGHTLY === '1' ? n * 10 : n;
}

export const LAW_TIMEOUT = 300_000;

/** The document of a text that must have no diagnostics at all. */
export function parseOk(text: string): Document {
  const r = parse(text, registry);
  if (r.diagnostics.length > 0)
    throw new Error(`unexpected diagnostics:\n${r.diagnostics.map(formatDiagnostic).join('\n')}`);
  return r.doc;
}

/** The diagnostics of a text (with `@version 1` prepended unless it has one). */
export function diagnostics(text: string): readonly Diagnostic[] {
  const t = text.includes('@version') ? text : `@version 1\n${text}`;
  return parse(t, registry).diagnostics;
}

/** The first error of a text, with its line counted in the text as given. */
export function firstError(text: string): Diagnostic {
  const shift = text.includes('@version') ? 0 : 1;
  const d = diagnostics(text).find((x) => x.severity === 'error');
  if (d === undefined) throw new Error(`expected an error in:\n${text}`);
  return { ...d, line: d.line - shift };
}

/** An object's definition by name. */
export function defOf(doc: Document, name: string): Expr {
  const o = doc.objects.find((x) => x.name === name);
  if (o === undefined) throw new Error(`no object ${name}`);
  return o.def;
}

export function idOf(doc: Document, name: string): number {
  const o = doc.objects.find((x) => x.name === name);
  if (o === undefined) throw new Error(`no object ${name}`);
  return o.id;
}

/** `@version 1` + lines. */
export function file(...lines: string[]): string {
  return ['@version 1', ...lines].join('\n');
}
