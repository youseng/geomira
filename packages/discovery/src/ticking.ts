/**
 * Computations in bounded chunks: a generator that yields between chunks, so a job's step
 * (SPEC §16) stays short however large the figure; `drain` runs one to the end where no host
 * slices it (tests, buildClosure).
 */

/** Work between two yields of the incremental steps (counting, measuring, claim keys). */
export const TICK = 128;

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

/** Elements merged between two yields of sortSteps. */
const MERGE_CHUNK = 4096;

/**
 * `xs` sorted by `less` (stable), in bounded steps: a bottom-up merge sort that yields every
 * MERGE_CHUNK elements merged, so sorting the hundreds of thousands of measured groups of a
 * large figure never blocks a step.
 */
export function* sortSteps<T extends object>(
  xs: readonly T[],
  less: (a: T, b: T) => boolean,
): Ticking<T[]> {
  let src = [...xs];
  let dst = new Array<T>(src.length);
  let done = 0;
  for (let width = 1; width < src.length; width *= 2) {
    for (let lo = 0; lo < src.length; lo += 2 * width) {
      const mid = Math.min(lo + width, src.length);
      const hi = Math.min(lo + 2 * width, src.length);
      let [i, j, k] = [lo, mid, lo];
      while (i < mid || j < hi) {
        const a = i < mid ? src[i] : undefined;
        const b = j < hi ? src[j] : undefined;
        // Ties take the left run first (stable).
        if (b !== undefined && (a === undefined || less(b, a))) {
          dst[k++] = b;
          j++;
        } else if (a !== undefined) {
          dst[k++] = a;
          i++;
        } else break;
        if (++done % MERGE_CHUNK === 0) yield undefined;
      }
    }
    [src, dst] = [dst, src];
  }
  return src;
}
