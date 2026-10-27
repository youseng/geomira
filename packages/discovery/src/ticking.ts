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
 * The indices 0 … n−1 of `xs` in increasing order of xs (stable), in bounded steps: a bottom-up
 * merge sort over two index buffers that yields every MERGE_CHUNK elements merged, so sorting
 * the hundreds of thousands of measured groups of a large figure never blocks a step (and
 * allocates two typed arrays, not an object per element).
 */
export function* sortIndexSteps(xs: readonly number[]): Ticking<Int32Array> {
  const n = xs.length;
  let src = new Int32Array(n);
  let dst = new Int32Array(n);
  for (let i = 0; i < n; i++) src[i] = i;
  let done = 0;
  for (let width = 1; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n);
      const hi = Math.min(lo + 2 * width, n);
      let [i, j, k] = [lo, mid, lo];
      while (i < mid || j < hi) {
        const a = src[i] ?? 0;
        const b = src[j] ?? 0;
        // Ties take the left run first (stable).
        const takeB = j < hi && (i >= mid || (xs[b] ?? 0) < (xs[a] ?? 0));
        dst[k++] = takeB ? b : a;
        if (takeB) j++;
        else i++;
        if (++done % MERGE_CHUNK === 0) yield undefined;
      }
    }
    [src, dst] = [dst, src];
  }
  return src;
}
