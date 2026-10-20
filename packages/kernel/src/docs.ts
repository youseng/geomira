/**
 * The tool reference, generated from the registry (CLAUDE.md: docs generated from the
 * registry; SPEC §3.4: the docs list, for each tool, whether its exact run can succeed).
 * Every example is run through `evaluate` over FloatField and RationalField, so the
 * "exact run" column is discovered, never declared. scripts/gen-tool-docs.ts writes the
 * result to docs/tools.md; a test fails when that file is stale.
 */
import { assertNever } from '@geomira/num/assert';
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { formatRational, parseRational, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { evalContextFor } from './context';
import { MAIN_LAYER_ID, emptyDocument, type Document } from './document';
import { evaluate } from './evaluate';
import { call, lit, type Expr, type Selector } from './expr';
import { formatExpr, formatSelector } from './selector';
import type { Registry } from './registry';
import {
  formatSignature,
  type ExampleArg,
  type ExampleSelector,
  type ToolExample,
  type ToolFamily,
  type ToolSpec,
} from './tool';
import { undef, type Value } from './value';

function number(text: string): Expr {
  const r = parseRational(text);
  return r.ok ? lit(r.value) : call('invalid_example_number', []);
}

function pointExpr(p: readonly [string, string]): Expr {
  return call('point', [number(p[0]), number(p[1])]);
}

function argExpr(a: ExampleArg): Expr {
  if (typeof a === 'string') return number(a);
  if ('through' in a) return call(a.as, [pointExpr(a.through[0]), pointExpr(a.through[1])]);
  if ('polygon' in a) return call('polygon', a.polygon.map(pointExpr));
  if ('call' in a) return call(a.call, a.args.map(argExpr));
  return pointExpr(a);
}

/** The id of the only object of an example document. */
const EXAMPLE_ID = 1;

function selectorOf(s: ExampleSelector): Selector {
  switch (s.kind) {
    case 'along':
    case 'orient':
      return { kind: s.kind, sign: s.sign };
    case 'other':
    case 'near':
    case 'far_from':
      return { kind: s.kind, p: argExpr(s.p) };
    default:
      return assertNever(s, 'example selector');
  }
}

/** A one-object document `x = tool(args…, selectors…)` for an example. */
export function exampleDocument(tool: ToolSpec, example: ToolExample): Document {
  const def = call(tool.name, example.args.map(argExpr), (example.selectors ?? []).map(selectorOf));
  const x = { id: EXAMPLE_ID, name: 'x', def, style: {}, layers: [MAIN_LAYER_ID] };
  return { ...emptyDocument(), nextId: EXAMPLE_ID + 1, objects: [x] };
}

/** The value of an example over a field (Undefined when its document has no context). */
export function runExample<T>(
  registry: Registry,
  tool: ToolSpec,
  example: ToolExample,
  F: Field<T>,
): Value<T> {
  const doc = exampleDocument(tool, example);
  const c = evalContextFor(doc);
  if (!c.ok) return undef(c.reason);
  return evaluate(doc, registry, F, c.ctx).values.get(EXAMPLE_ID) ?? undef('no example value');
}

/** An example expression as text (example documents have no named objects). */
function exprText(e: Expr): string {
  return formatExpr(e, () => undefined);
}

function argText(a: ExampleArg): string {
  if (typeof a === 'string') return a;
  if ('through' in a) return `${a.as}(${argText(a.through[0])}, ${argText(a.through[1])})`;
  if ('polygon' in a) return `polygon(${a.polygon.map(argText).join(', ')})`;
  if ('call' in a) return `${a.call}(${a.args.map(argText).join(', ')})`;
  return `(${a[0]}, ${a[1]})`;
}

/** Shows exact results as fractions and float results with 12 significant digits. */
export function formatValue<T>(v: Value<T>, show: (x: T) => string): string {
  const pair = (p: { readonly x: T; readonly y: T }): string => `(${show(p.x)}, ${show(p.y)})`;
  switch (v.kind) {
    case 'point':
      return `point ${pair(v)}`;
    case 'line': {
      const range = `[${v.lo === null ? '−∞' : show(v.lo)}, ${v.hi === null ? '∞' : show(v.hi)}]`;
      return `line ${pair(v.p)} + t·${pair(v.d)}, t ∈ ${range}${v.chiral ? ', chiral' : ''}`;
    }
    case 'circle': {
      const anchor = v.anchor === undefined ? '' : `, anchor ${pair(v.anchor)}`;
      return `circle centre ${pair(v.c)}, r² = ${show(v.r2)}${anchor}`;
    }
    case 'number':
      return `number ${show(v.v)}`;
    case 'polygon':
      return `polygon ${v.pts.map(pair).join(' ')}`;
    case 'transform':
      return `similarity${v.t.anti ? ' (anti)' : ''}`;
    case 'undefined':
      return `Undefined (${v.reason})`;
    case 'inexact':
      return `Inexact (${v.reason})`;
    default:
      return assertNever(v, 'value');
  }
}

/**
 * formatValue, with a map's coefficients: "similarity z ↦ (a)·z + (b)", z̄ for an anti map
 * (the reference shows what a transformation example computes).
 */
function formatDocValue<T>(v: Value<T>, show: (x: T) => string): string {
  if (v.kind !== 'transform') return formatValue(v, show);
  const c = (z: { readonly re: T; readonly im: T }): string => `(${show(z.re)}, ${show(z.im)})`;
  return `${formatValue(v, show)} z ↦ ${c(v.t.a)}·${v.t.anti ? 'z̄' : 'z'} + ${c(v.t.b)}`;
}

const showFloat = (x: number): string => String(Number.parseFloat(x.toPrecision(12)));
const showRational = (x: Rational): string => formatRational(x);

/** "can succeed" when some example runs over RationalField without Inexact. */
export function exactness(registry: Registry, tool: ToolSpec): string {
  const runs = tool.examples.map((e) => runExample(registry, tool, e, RationalField));
  if (runs.some((v) => v.kind !== 'inexact' && v.kind !== 'undefined')) return 'can succeed';
  const why = runs.find((v) => v.kind === 'inexact');
  return why === undefined ? 'not shown by the examples' : `not in the examples: ${why.reason}`;
}

const FAMILIES: readonly ToolFamily[] = [
  'points',
  'lines',
  'circles',
  'transformations',
  'measures',
  'display',
  'arithmetic',
];

function toolSection(registry: Registry, t: ToolSpec): string[] {
  const lines = [`### ${t.name}`, '', t.doc, ''];
  lines.push(
    `- Signatures: ${t.signatures.map((s) => `\`${formatSignature(t.name, s)}\``).join(', ')}`,
  );
  lines.push(`- Result: ${t.outputKinds.join(', ')}`);
  lines.push(`- Exact run (RationalField): ${exactness(registry, t)}`);
  lines.push(`- Export: ${t.export}`);
  lines.push(`- Degenerate cases:${t.degenerate.length === 0 ? ' none' : ''}`);
  for (const d of t.degenerate) lines.push(`  - ${d}`);
  lines.push('- Examples:');
  for (const e of t.examples) {
    const sels = (e.selectors ?? []).map((s) => formatSelector(selectorOf(s), exprText));
    const callText = `${t.name}(${[...e.args.map(argText), ...sels].join(', ')})`;
    const q = runExample(registry, t, e, RationalField);
    const shown =
      q.kind === 'inexact'
        ? formatDocValue(runExample(registry, t, e, FloatField), showFloat)
        : formatDocValue(q, showRational);
    lines.push(`  - \`${callText}\` → ${shown}`);
  }
  lines.push('');
  return lines;
}

/** The whole reference as Markdown (deterministic). */
export function renderToolDocs(registry: Registry): string {
  const out = [
    '# Tool reference',
    '',
    'Generated from the tool registry by `pnpm docs:tools` (packages/kernel/src/docs.ts). Do not',
    'edit by hand: a test fails when this file differs from the registry. Exact results are',
    'shown as fractions; results that are not exact (Inexact over RationalField) are shown',
    'from FloatField with 12 significant digits.',
    '',
  ];
  for (const family of FAMILIES) {
    const tools = registry.tools.filter((t) => t.family === family);
    if (tools.length === 0) continue;
    out.push(`## ${family[0]?.toUpperCase() ?? ''}${family.slice(1)}`, '');
    for (const t of tools) out.push(...toolSection(registry, t));
  }
  return `${out.join('\n').trimEnd()}\n`;
}
