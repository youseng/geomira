/**
 * The exactness table of the tool registry (Run 3a acceptance: "STATUS lists each tool
 * with whether its exact run succeeds, generated, not typed"). Each tool's examples run
 * through `evaluate` over RationalField; the table reports how many succeed exactly and,
 * for the others, the first reason (Inexact: a square root or an angle that is not
 * rational). Exactness is discovered, never declared (SPEC §3.4).
 */
import { RationalField } from '../../packages/num/src/rational-field';
import { exactness, runExample } from '../../packages/kernel/src/docs';
import type { Registry } from '../../packages/kernel/src/registry';

export interface ExactnessRow {
  readonly tool: string;
  readonly family: string;
  /** "can succeed", or why no example succeeds (docs.ts `exactness`). */
  readonly exactRun: string;
  readonly exactExamples: number;
  readonly examples: number;
  /** The first reason of an example that is not exact, or "" when all are exact. */
  readonly otherwise: string;
}

export function exactnessRows(registry: Registry): ExactnessRow[] {
  return registry.tools.map((t) => {
    const runs = t.examples.map((e) => runExample(registry, t, e, RationalField));
    const bad = runs.find((v) => v.kind === 'inexact' || v.kind === 'undefined');
    return {
      tool: t.name,
      family: t.family,
      exactRun: exactness(registry, t),
      exactExamples: runs.filter((v) => v.kind !== 'inexact' && v.kind !== 'undefined').length,
      examples: runs.length,
      otherwise: bad === undefined ? '' : `${bad.kind}: ${bad.reason}`,
    };
  });
}

/** The table as Markdown, one row per tool in registry order. */
export function renderExactnessTable(registry: Registry): string {
  const rows = exactnessRows(registry).map(
    (r) =>
      `| ${r.tool} | ${r.family} | ${r.exactRun} | ${String(r.exactExamples)}/${String(r.examples)} | ${r.otherwise} |`,
  );
  return [
    '| Tool | Family | Exact run (RationalField) | Exact examples | Otherwise |',
    '| ---- | ------ | ------------------------- | -------------- | --------- |',
    ...rows,
  ].join('\n');
}
