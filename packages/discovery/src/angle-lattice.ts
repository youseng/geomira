/**
 * The angle lattice of what is known (ADR-0039): the closure's congruences (angles.ts), the
 * maps' (angle-maps.ts) and those of the facts given, inserted in bounded steps; a fact's angle
 * content follows iff each of its congruences is in the lattice.
 */
import { mapRows } from './angle-maps';
import { AngleVars, closureRows, factRows } from './angles';
import type { ClosureState, TermArg } from './closure-view';
import { Lattice } from './lattice';

/** Rows inserted between two yields of latticeSteps. */
const ROWS_PER_STEP = 64;

/** The lattice of a closure and of the angle facts given (shown facts), in bounded steps. */
export function* latticeSteps(
  c: ClosureState,
  vars: AngleVars,
  given: readonly { readonly kind: string; readonly args: readonly TermArg[] }[],
): Generator<undefined, Lattice, unknown> {
  const l = new Lattice();
  let n = 0;
  const rows = function* () {
    yield* closureRows(c, vars);
    yield* mapRows(c, vars);
    for (const f of given) yield* factRows(c, vars, f.kind, f.args) ?? [];
  };
  for (const v of rows()) {
    l.insert(v);
    if (++n % ROWS_PER_STEP === 0) yield undefined;
  }
  return l;
}

/** Whether every congruence of the fact is in the lattice. */
export function anglesFollow(
  c: ClosureState,
  vars: AngleVars,
  l: Lattice,
  kind: string,
  args: readonly TermArg[],
): boolean {
  const rows = factRows(c, vars, kind, args);
  return rows !== undefined && rows.length > 0 && rows.every((v) => l.contains(v));
}
