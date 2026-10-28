/**
 * A summary of how a figure evaluates and draws, for the Run 16a baseline (ADR-0040): every
 * object's value (kind, numbers to 12 significant digits, or its reason), the scene's drawn
 * primitives and unavailable objects, and every claim's live badge and local verdict (seed 1,
 * n = 40). The summary of each example and fixture was written on the base of Run 16a
 * (main = a9753c0, before ideal points existed) and is compared with the current code, so a
 * change in what any of them draws or reports fails a test.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evalClaim } from '@geomira/claims/eval-claim';
import { testClaim } from '@geomira/claims/job';
import { evalContextFor } from '@geomira/kernel/context';
import { evaluate } from '@geomira/kernel/evaluate';
import type { Registry } from '@geomira/kernel/registry';
import { numbersOf, type Value } from '@geomira/kernel/value';
import { parse } from '@geomira/lang/parse';
import { FloatField } from '@geomira/num/float-field';
import { buildScene } from '@geomira/scene/build';

export interface FigureSummary {
  readonly objects: readonly string[];
  readonly drawn: readonly string[];
  readonly unavailable: readonly string[];
  readonly claims: readonly string[];
}

const ROOT = join(__dirname, '..', '..', '..', '..');

/** Every example and fixture figure of the repository, by path (sorted). */
export function figureFiles(): { path: string; text: string }[] {
  const dirs = ['examples', 'tests/fixtures/export', 'packages/lang/test/fixtures/migration'];
  return dirs
    .flatMap((d) =>
      readdirSync(join(ROOT, d))
        .filter((f) => f.endsWith('.geo'))
        .map((f) => `${d}/${f}`),
    )
    .sort()
    .map((path) => ({ path, text: readFileSync(join(ROOT, path), 'utf8') }));
}

function num(x: number): string {
  return Number.isFinite(x) ? x.toPrecision(12) : String(x);
}

function valueText(v: Value<number> | undefined): string {
  if (v === undefined) return 'missing';
  if (v.kind === 'undefined' || v.kind === 'inexact') return `${v.kind}: ${v.reason}`;
  return `${v.kind} ${numbersOf(v).map(num).join(' ')}`;
}

/** The summary of the figure written as `text`. */
export function summarize(text: string, registry: Registry): FigureSummary {
  const doc = parse(text, registry).doc;
  const c = evalContextFor(doc);
  const values = c.ok
    ? evaluate(doc, registry, FloatField, c.ctx).values
    : new Map<number, Value<number>>();
  const scene = buildScene(doc, values);
  const names = new Map(doc.objects.map((o) => [o.id, o.name]));
  return {
    objects: doc.objects.map((o) => `${o.name}: ${valueText(values.get(o.id))}`),
    drawn: scene.primitives.map((p) => `${names.get(p.id) ?? '?'} ${p.shape.kind}`),
    unavailable: scene.unavailable.map((u) => `${u.name}: ${u.reason}`),
    claims: doc.claims.map((cl) => {
      const badge = evalClaim(doc, cl.id, registry);
      const shown = badge.value === 'undefined' ? `undefined (${badge.reason})` : badge.value;
      const r = testClaim(
        { kind: 'testClaim', regime: 'local', doc, claim: cl.id, seed: 1, n: 40 },
        { registry },
      );
      const verdict =
        r.kind === 'verdict' ? r.verdict.text : r.kind === 'invalid' ? r.reason : r.kind;
      return `${cl.kind}: ${shown}; ${verdict}`;
    }),
  };
}
