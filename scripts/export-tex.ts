/**
 * The export job of tex.yml (SPEC §14, Run 9a): for every example (examples/*.geo) and every
 * export fixture (tests/fixtures/export/*.geo) it writes the standalone TikZ document, the
 * TikZ snippet inside a minimal document, and the standalone Asymptote file with its
 * coordinate check; compiles them (pdflatex, asy -f pdf); and compares Asymptote's write()
 * numbers with the kernel's values (packages/export check.ts: within EXPORT_TOL·scale).
 * Then the same Asymptote check on FUZZ random documents of the language laws' generator.
 * Exits non-zero on the first failing step of any input, after printing every result.
 *
 * Usage: tsx scripts/export-tex.ts <out dir> [--fuzz N] [--seed S]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalContextFor } from '../packages/kernel/src/context';
import type { Document } from '../packages/kernel/src/document';
import { evaluate } from '../packages/kernel/src/evaluate';
import { createRegistry } from '../packages/kernel/src/registry';
import { parse } from '../packages/lang/src/parse';
import { FloatField } from '../packages/num/src/float-field';
import { createRng } from '../packages/num/src/rng';
import { toAsymptoteCheck } from '../packages/export/src/asy';
import { checkCoordinates } from '../packages/export/src/check';
import { exportFrame } from '../packages/export/src/frame';
import { toTikz, toTikzStandalone } from '../packages/export/src/tikz';
import { buildDoc, type Step } from '../packages/lang/test/helpers/gen-doc';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const registry = createRegistry();

interface Input {
  readonly name: string;
  readonly doc: Document;
  /** Compile TikZ too (examples and fixtures; the fuzz checks Asymptote only). */
  readonly tikz: boolean;
}

function geoFiles(dir: string, prefix: string): Input[] {
  return readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith('.geo'))
    .sort()
    .map((f) => {
      const r = parse(readFileSync(join(ROOT, dir, f), 'utf8'), registry);
      const errors = r.diagnostics.filter((d) => d.severity === 'error');
      if (errors.length > 0) throw new Error(`${f}: ${JSON.stringify(errors)}`);
      return { name: `${prefix}${f.slice(0, -4)}`, doc: r.doc, tikz: true };
    });
}

function run(cmd: string, args: readonly string[], cwd: string): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 120_000 });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` };
}

function snippetDocument(snippet: string): string {
  return [
    '\\documentclass{article}',
    '\\usepackage{tikz}',
    '\\usepackage{amssymb}',
    '\\pagestyle{empty}',
    '\\begin{document}',
    snippet,
    '\\end{document}',
    '',
  ].join('\n');
}

type Outcome = 'ok' | 'refused' | 'failed';

/**
 * Compiles and checks one input; returns its report line, or throws nothing: failures are lines.
 * A figure exportFrame refuses (e.g. a view zoomed in beyond the coordinates' precision) is
 * 'refused': allowed for a random document, a failure for an example or a fixture.
 */
function check(input: Input, out: string): { outcome: Outcome; line: string } {
  const c = evalContextFor(input.doc);
  const ctx = c.ok ? c.ctx : { scale: 1 };
  const values = evaluate(input.doc, registry, FloatField, ctx).values;
  const fr = exportFrame(input.doc, values);
  if (!fr.ok)
    return input.tikz
      ? { outcome: 'failed', line: `FAIL ${input.name}: refused: ${fr.problem}` }
      : { outcome: 'refused', line: `refused ${input.name}: ${fr.problem}` };
  const f = fr.frame;
  const fail = (what: string, log: string) => ({
    outcome: 'failed' as const,
    line: `FAIL ${input.name}: ${what}\n${log.split('\n').slice(-30).join('\n')}`,
  });
  if (input.tikz) {
    writeFileSync(join(out, `${input.name}.tex`), toTikzStandalone(f).text);
    writeFileSync(join(out, `${input.name}-snippet.tex`), snippetDocument(toTikz(f).text));
    for (const tex of [`${input.name}.tex`, `${input.name}-snippet.tex`]) {
      const r = run('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', tex], out);
      if (!r.ok) return fail(`pdflatex ${tex}`, r.out);
    }
  }
  const asy = toAsymptoteCheck(f, registry);
  writeFileSync(join(out, `${input.name}.asy`), asy.text);
  const r = run('asy', ['-f', 'pdf', '-o', `${input.name}-asy`, `${input.name}.asy`], out);
  if (!r.ok) return fail('asy', r.out);
  const result = checkCoordinates(asy.plan, values, ctx.scale, r.out);
  if (result.problems.length > 0)
    return fail('coordinates', JSON.stringify(result.problems, null, 1));
  return {
    outcome: 'ok',
    line:
      `ok   ${input.name}: ${input.tikz ? 'TikZ (standalone, snippet), ' : ''}Asymptote; ` +
      `${String(result.checked)} variables (${String(result.constructive)} constructive), ` +
      `largest error ${result.worst.toExponential(2)} of the scale`,
  };
}

function fuzzInputs(n: number, seed: number): Input[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, (_, k) => {
    const steps: Step[] = Array.from({ length: 10 + rng.nextInt(40) }, () => [
      rng.nextInt(100),
      rng.nextInt(1 << 30),
    ]);
    return { name: `fuzz-${String(k)}`, doc: buildDoc(steps, registry), tikz: false };
  });
}

function main(): void {
  const [outArg, ...rest] = process.argv.slice(2);
  if (outArg === undefined) throw new Error('usage: export-tex.ts <out dir> [--fuzz N] [--seed S]');
  const opt = (k: string, d: number) => {
    const i = rest.indexOf(k);
    return i >= 0 ? Number(rest[i + 1]) : d;
  };
  const out = join(process.cwd(), outArg);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const inputs = [
    ...geoFiles('examples', ''),
    ...geoFiles('tests/fixtures/export', 'fixture-'),
    ...fuzzInputs(opt('--fuzz', 0), opt('--seed', 20261021)),
  ];
  const count: Record<Outcome, number> = { ok: 0, refused: 0, failed: 0 };
  for (const input of inputs) {
    const r = check(input, out);
    count[r.outcome]++;
    process.stdout.write(`${r.line}\n`);
  }
  process.stdout.write(
    `${String(inputs.length)} inputs: ${String(count.ok)} compiled and checked, ` +
      `${String(count.refused)} random documents refused by exportFrame, ` +
      `${String(count.failed)} failed\n`,
  );
  if (count.failed > 0) process.exitCode = 1;
}

main();
