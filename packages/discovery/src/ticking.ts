/**
 * Computations in bounded chunks: a generator that yields between chunks, so a job's step
 * (SPEC §16) stays short however large the figure; `drain` runs one to the end where no host
 * slices it (tests, buildClosure).
 */

/** Work between two yields of the incremental steps (counting, measuring, claim keys). */
export const TICK = 512;

/** A computation that yields between bounded chunks of work (the job's steps stay short). */
export type Ticking<T> = Generator<undefined, T, unknown>;

/** Runs `g` to its end; returns its value. */
export function drain<T>(g: Ticking<T>): T {
  for (;;) {
    const r = g.next();
    if (r.done === true) return r.value;
  }
}

/**
 * Runs `g` as a job's steps: one progress report per chunk, the host's command answered
 * between two chunks (the value, or the command that interrupted it).
 */
export function* asSteps<T, P, C>(
  g: Ticking<T>,
  progress: () => P,
): Generator<P, { readonly value: T } | { readonly cmd: NonNullable<C> }, C> {
  for (let r = g.next(); ; r = g.next()) {
    if (r.done === true) return { value: r.value };
    const cmd = yield progress();
    if (cmd !== undefined && cmd !== null) return { cmd };
  }
}
