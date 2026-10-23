/**
 * The verdict LINE the web app shows for a test (SPEC §10.5, ADR-0013): the verdict's name
 * in sentence case, then in parentheses what was checked: the regime, n and the rungs used
 * ("Holds in this configuration (local test, n = 200, exact over Q)"); counts follow only
 * where they add something (mixed rungs, fewer valid figures than tested, rejected samples,
 * mirrored figures, a shortfall against the hypotheses). The seed, the tally and the most frequent
 * reasons of invalid figures go to `detail`, shown under the line.
 *
 * `tone` is how the line is coloured: only a LOCAL verdict can be `false` or `mixed`;
 * every GLOBAL verdict is `info` (SPEC §10.5: global findings are information, never a red
 * badge). The words reserved for the Phase 2 prover never appear.
 */
import { assertNever } from '@geomira/num/assert';
import { RUNG_NAMES } from './rungs';
import type { GlobalKind, LocalKind, Verdict } from './verdict';
import { rejectedNote, selectorPhrase } from './verdict-notes';

export type VerdictTone = 'holds' | 'false' | 'mixed' | 'inconclusive' | 'info';

export interface VerdictLine {
  readonly text: string;
  readonly tone: VerdictTone;
  /** Seed, tally and reasons: what the line does not say. */
  readonly detail: string;
}

export interface LineOptions {
  /**
   * The current figure violates an assumption and the app says so at the assumption's line
   * (note B of Run 8b), so the generic "hard to satisfy" note is left out.
   */
  readonly figureExplains?: boolean;
}

/** The rungs used: one name, or each with its count. */
function rungsText(v: Verdict): string {
  const used = RUNG_NAMES.filter((r) => (v.rungs[r] ?? 0) > 0);
  if (used.length === 1 && used[0] !== undefined) return used[0];
  return used.map((r) => `${r} ${String(v.rungs[r] ?? 0)}`).join(', ');
}

function valid(v: Verdict): number {
  return v.tally.true + v.tally.false;
}

/** "n = 200, exact over Q" and, for a verdict without valid figures, "n = 200". */
function checked(v: Verdict): string {
  const rungs = rungsText(v);
  return `${v.regime} test, n = ${String(v.n)}${rungs === '' ? '' : `, ${rungs}`}`;
}

/** Notes about the hypotheses: a shortfall of tested figures, and "hard to satisfy". */
function hypothesisNotes(v: Verdict, o: LineOptions): string[] {
  const out: string[] = [];
  if (v.tested < v.n)
    out.push(`only ${String(v.tested)} of ${String(v.n)} figures satisfied the hypotheses`);
  if (v.hardToSatisfy === true && o.figureExplains !== true)
    out.push('hard to satisfy: few figures satisfy the hypotheses');
  return out;
}

function validNote(v: Verdict): string[] {
  return valid(v) < v.tested ? [`${String(valid(v))} of ${String(v.tested)} figures valid`] : [];
}

function localBody(v: Verdict, kind: LocalKind, o: LineOptions): string {
  const notes = (...first: string[]) => [...first, ...validNote(v), ...hypothesisNotes(v, o)];
  const joined = (xs: string[]) => (xs.length === 0 ? '' : `; ${xs.join('; ')}`);
  switch (kind) {
    case 'holds':
      return `Holds in this configuration (${checked(v)}${joined(notes())})`;
    case 'false': {
      const only = v.current?.value === 'true' ? ['true in the current figure only'] : [];
      return `False (${checked(v)}${joined(notes(...only))})`;
    }
    case 'mixed':
      return `Mixed (${checked(v)}: ${String(v.tally.true)} true, ${String(v.tally.false)} false${joined(notes())})`;
    case 'inconclusive':
      return inconclusive(v, o);
    default:
      return assertNever(kind, 'local verdict');
  }
}

function inconclusive(v: Verdict, o: LineOptions): string {
  const head = `${String(valid(v))} of ${String(v.tested)} figures valid`;
  const rest = hypothesisNotes(v, o);
  return `Inconclusive (${v.regime} test, n = ${String(v.n)}: ${[head, ...rest].join('; ')})`;
}

function globalBody(v: Verdict, kind: Exclude<GlobalKind, 'inconclusive'>, o: LineOptions): string {
  const f = String(v.tally.false);
  const of = String(valid(v));
  const rejected = rejectedNote(v.tally.rejected);
  const notes = [...validNote(v), ...hypothesisNotes(v, o)];
  const tail = (xs: string[]) => (xs.length === 0 ? '' : `; ${xs.join('; ')}`);
  switch (kind) {
    case 'holds-across':
      return `Holds across the declared configuration (${checked(v)}${tail([...rejected, `${String(v.mirrored ?? 0)} mirrored`, ...notes])})`;
    case 'orientation-dependent': {
      const what =
        v.named === undefined
          ? 'flipping its orientation-dependent selectors together repairs every failure'
          : `${selectorPhrase(v.named)} encodes a side; ${v.named.advice}`;
      return `Orientation-dependent (${checked(v)}: ${f} of ${of} fail and hold with the selectors flipped; ${what}${tail([...rejected, ...notes])})`;
    }
    case 'configuration-dependent': {
      // The verdict's own text says which of the two cases the flip test found.
      const why = v.text.includes('no orientation-dependent selector')
        ? 'no orientation-dependent selector'
        : 'flipping the orientation-dependent selectors does not repair them';
      return `Configuration-dependent (${checked(v)}: ${f} of ${of} fail; ${why}${tail([...rejected, ...notes])})`;
    }
    default:
      return assertNever(kind, 'global verdict');
  }
}

function isLocal(k: LocalKind | GlobalKind): k is LocalKind {
  return k === 'holds' || k === 'false' || k === 'mixed' || k === 'inconclusive';
}

function toneOf(v: Verdict): VerdictTone {
  if (v.regime === 'global') return 'info';
  switch (v.kind) {
    case 'holds':
    case 'false':
    case 'mixed':
    case 'inconclusive':
      return v.kind;
    case 'holds-across':
    case 'orientation-dependent':
    case 'configuration-dependent':
      return 'info';
    default:
      return assertNever(v.kind, 'verdict kind');
  }
}

function detailOf(v: Verdict): string {
  const t = v.tally;
  const parts = [
    `seed ${String(v.seed)}`,
    `${String(v.tested)} figures tested in ${String(v.attempts)} attempts`,
    `${String(t.true)} true, ${String(t.false)} false`,
  ];
  const invalid = t.degenerate + t.undefined + t.ambiguous + t.illConditioned + t.invalid;
  if (invalid > 0) parts.push(`${String(invalid)} not valid`);
  if (v.regime === 'global') parts.push(`${String(v.mirrored ?? 0)} mirrored`);
  const reasons = v.reasons.map((r) => `${r.reason} ×${String(r.count)}`).join('; ');
  return reasons === '' ? parts.join(' · ') : `${parts.join(' · ')} · ${reasons}`;
}

/** The line, tone and detail of a verdict (see the module comment). */
export function verdictLine(v: Verdict, options: LineOptions = {}): VerdictLine {
  const text = isLocal(v.kind)
    ? v.regime === 'local'
      ? localBody(v, v.kind, options)
      : inconclusive(v, options)
    : globalBody(v, v.kind, options);
  return { text, tone: toneOf(v), detail: detailOf(v) };
}
