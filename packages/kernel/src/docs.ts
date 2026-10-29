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
  type ArgSymmetry,
  type GuaranteeTerm,
  type MapFacts,
  type ExampleArg,
  type ExampleSelector,
  type ToolExample,
  type ToolFamily,
  type ToolSpec,
} from './tool';
import { undef, type TransformData, type Value } from './value';

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
  if ('text' in a) return { kind: 'str', value: a.text };
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
  if ('text' in a) return exprText({ kind: 'str', value: a.text });
  if ('call' in a) return `${a.call}(${a.args.map(argText).join(', ')})`;
  return `(${a[0]}, ${a[1]})`;
}

/** Shows exact results as fractions and float results with 12 significant digits. */
export function formatValue<T>(v: Value<T>, show: (x: T) => string): string {
  const pair = (p: { readonly x: T; readonly y: T }): string => `(${show(p.x)}, ${show(p.y)})`;
  switch (v.kind) {
    case 'point':
      return `point ${pair(v)}`;
    case 'ideal_point':
      return `point at infinity, direction ${pair(v.d)}${v.chiral ? ', chiral' : ''}`;
    case 'line': {
      const range = `[${v.lo === null ? '−∞' : show(v.lo)}, ${v.hi === null ? '∞' : show(v.hi)}]`;
      const where = v.outside === true ? `t ∉ (${range.slice(1, -1)})` : `t ∈ ${range}`;
      return `line ${pair(v.p)} + t·${pair(v.d)}, ${where}${v.chiral ? ', chiral' : ''}`;
    }
    case 'circle': {
      const anchor = v.anchor === undefined ? '' : `, anchor ${pair(v.anchor)}`;
      const arc =
        v.arc === null
          ? ''
          : `, arc counter-clockwise from ${pair(v.arc.from)} to ${pair(v.arc.to)}`;
      return `circle center ${pair(v.c)}, r² = ${show(v.r2)}${arc}${anchor}`;
    }
    case 'conic': {
      const anchor = v.anchor === undefined ? '' : `, anchor ${pair(v.anchor)}`;
      const q = [v.a, v.b, v.c, v.d, v.e, v.f].map(show).join(', ');
      return `conic (a, b, c, d, e, f) = (${q})${anchor}`;
    }
    case 'number':
      return `number ${show(v.v)}`;
    case 'polygon':
      return `polygon ${v.pts.map(pair).join(' ')}`;
    case 'transform':
      return mapName(v.t);
    case 'angle_mark': {
      const what = v.right ? 'right-angle mark' : `angle mark (${String(v.arcs)} arc(s))`;
      return `${what} at ${pair(v.b)} from ${pair(v.from)} to ${pair(v.to)}`;
    }
    case 'segment_mark':
      return `segment mark (${String(v.ticks)} tick(s)) ${pair(v.p)} – ${pair(v.q)}`;
    case 'text':
      return `text "${v.text}" at ${pair(v.at)}`;
    case 'string':
      return `string "${v.s}"`;
    case 'undefined':
      return `Undefined (${v.reason})`;
    case 'inexact':
      return `Inexact (${v.reason})`;
    default:
      return assertNever(v, 'value');
  }
}

/** "similarity", "Möbius map (anti)", "projective map", "composite of 2 maps". */
function mapName<T>(t: TransformData<T>): string {
  switch (t.type) {
    case 'similarity':
      return `similarity${t.anti ? ' (anti)' : ''}`;
    case 'mobius':
      return `Möbius map${t.anti ? ' (anti)' : ''}`;
    case 'projective':
      return 'projective map';
    case 'composite':
      return `composite of ${String(t.maps.length)} maps`;
    default:
      return assertNever(t, 'transform');
  }
}

/**
 * A map's coefficients: "z ↦ (a)·z + (b)", z̄ for an anti map; a projective map's matrix by
 * rows; a composite's maps in the order they apply.
 */
function mapFormula<T>(t: TransformData<T>, show: (x: T) => string): string {
  const c = (z: { readonly re: T; readonly im: T }): string => `(${show(z.re)}, ${show(z.im)})`;
  switch (t.type) {
    case 'similarity':
      return `z ↦ ${c(t.a)}·${t.anti ? 'z̄' : 'z'} + ${c(t.b)}`;
    case 'mobius': {
      const z = t.anti ? 'z̄' : 'z';
      return `z ↦ (${c(t.a)}·${z} + ${c(t.b)}) / (${c(t.c)}·${z} + ${c(t.d)})`;
    }
    case 'projective': {
      const r = (i: number): string =>
        t.m
          .slice(i, i + 3)
          .map(show)
          .join(', ');
      return `[${r(0)}; ${r(3)}; ${r(6)}]`;
    }
    case 'composite':
      return t.maps.map((m) => `${mapName(m)} ${mapFormula(m, show)}`).join(', then ');
    default:
      return assertNever(t, 'transform');
  }
}

/**
 * formatValue, with a map's coefficients (the reference shows what a transformation example
 * computes).
 */
function formatDocValue<T>(v: Value<T>, show: (x: T) => string): string {
  return v.kind === 'transform'
    ? `${formatValue(v, show)} ${mapFormula(v.t, show)}`
    : formatValue(v, show);
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

/** "numeric", "constructive (foot)": a mapping as the reference shows it (ADR-0014). */
function exportText(m: ToolSpec['export']): string {
  return m === 'numeric' ? 'numeric' : `constructive (${m.constructive})`;
}

/** "arguments 1, 2 in any order (the same value)": a symmetry as the reference shows it. */
function symmetryText(s: ArgSymmetry): string {
  const same =
    s.same === 'value'
      ? 'the same value'
      : 'the same figure; a direction, an anchor or the vertex order may differ';
  switch (s.kind) {
    case 'permute': {
      const flips = s.flipsOrient === true ? ', and swapping them flips orient(±)' : '';
      return `arguments ${s.positions.map((p) => String(p + 1)).join(', ')} in any order (${same})${flips}`;
    }
    case 'dihedral':
      return `the arguments in any rotation or reversal (${same})`;
    default:
      return assertNever(s, 'argument symmetry');
  }
}

/**
 * When two calls of the tool are the same construction (ADR-0029): its argument symmetries,
 * per overload, the tool it is the same as, or that it is a free input.
 */
function sameConstructionLines(t: ToolSpec): string[] {
  if (t.input === true)
    return ['- Same construction: never (a free input: two of them are independent objects)'];
  const out: string[] = [];
  if (t.sameAs !== undefined)
    out.push(`- Same construction: \`${t.name}(…)\` is \`${t.sameAs}(…)\` with the same arguments`);
  const syms = t.signatures.flatMap((s) =>
    (s.symmetry ?? []).map((x) => `\`${formatSignature(t.name, s)}\`: ${symmetryText(x)}`),
  );
  out.push(`- Symmetry:${syms.length === 0 ? ' none' : ''}`);
  for (const s of syms) out.push(`  - ${s}`);
  return out;
}

/** A guarantee term as the reference shows it: `result`, `#1` (the first argument), calls. */
function termText(x: GuaranteeTerm): string {
  if (x === 'result') return 'result';
  if (typeof x === 'number') return `#${String(x + 1)}`;
  if ('lit' in x) return x.lit;
  return `${x.tool}(${x.args.map(termText).join(', ')})`;
}

/** The facts the tool's results have by construction (ADR-0035), per overload. */
function guaranteeLines(t: ToolSpec): string[] {
  const facts = t.signatures.flatMap((s) =>
    (s.guarantees ?? []).length === 0
      ? []
      : [
          `\`${formatSignature(t.name, s)}\`: ${(s.guarantees ?? [])
            .map((g) => `${g.claim}(${g.args.map(termText).join(', ')})`)
            .join('; ')}`,
        ],
  );
  return [
    `- By construction:${facts.length === 0 ? ' nothing' : ''}`,
    ...facts.map((f) => `  - ${f}`),
  ];
}

/** A map's facts as the reference shows them (ADR-0039). */
function mapFactsText(m: MapFacts): string {
  const parts: string[] = [m.type];
  if (m.involution === true) parts.push('an involution');
  if (m.ratio !== undefined) parts.push(`ratio ${termText(m.ratio)}`);
  if (m.turn !== undefined) parts.push(`turn ${termText(m.turn)}°`);
  for (const p of m.fixedPoints ?? []) parts.push(`fixes ${termText(p)}`);
  if (m.fixedCurve !== undefined) parts.push(`fixes every point of ${termText(m.fixedCurve)}`);
  for (const c of m.invariantCurves ?? []) parts.push(`takes ${termText(c)} onto itself`);
  if (m.center !== undefined) parts.push(`centre ${termText(m.center)}`);
  if (m.infinityImage !== undefined)
    parts.push(`takes the line at infinity onto ${termText(m.infinityImage)}`);
  if (m.factor !== undefined) parts.push(`signed ratio ${termText(m.factor)}`);
  for (const [a, b] of m.sends ?? []) parts.push(`${termText(a)} ↦ ${termText(b)}`);
  return parts.join('; ');
}

/** What the tool's maps do and whose images its image overloads are (ADR-0039). */
function mapLines(t: ToolSpec): string[] {
  const maps = t.signatures.flatMap((s) =>
    s.map === undefined ? [] : [`\`${formatSignature(t.name, s)}\`: ${mapFactsText(s.map)}`],
  );
  const images = t.signatures.flatMap((s) =>
    s.imageOf === undefined
      ? []
      : [
          `\`${formatSignature(t.name, s)}\`: the image of ${termText(s.imageOf.of)} under ${termText(s.imageOf.map)}`,
        ],
  );
  if (maps.length === 0 && images.length === 0) return [];
  return ['- As a map:', ...[...maps, ...images].map((x) => `  - ${x}`)];
}

function toolSection(registry: Registry, t: ToolSpec): string[] {
  const lines = [`### ${t.name}`, '', t.doc, ''];
  lines.push(
    `- Signatures: ${t.signatures.map((s) => `\`${formatSignature(t.name, s)}\``).join(', ')}`,
  );
  lines.push(`- Result: ${t.outputKinds.join(', ')}`);
  lines.push(`- Exact run (RationalField): ${exactness(registry, t)}`);
  lines.push(`- Export: ${exportText(t.export)}`);
  lines.push(...sameConstructionLines(t));
  lines.push(...guaranteeLines(t));
  lines.push(...mapLines(t));
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
