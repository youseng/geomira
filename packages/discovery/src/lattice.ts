/**
 * An integer lattice of linear congruences (ADR-0039): angle chasing as linear algebra. Each
 * known fact is a row Σ aᵢ·xᵢ ≡ c (mod 180°) over direction variables, stored as the integer
 * vector (a, −c) with the constant in the last column; the row (0, …, 0, 180) is always in. A
 * candidate congruence FOLLOWS iff its vector is an INTEGER combination of the rows: integer
 * combinations of true congruences mod 180° are true, rational ones are not (2x ≡ 0 does not
 * give x ≡ 0), so the test is lattice membership, not a rational span.
 *
 * The rows are kept in echelon form over Z (each row's first non-zero column is its pivot,
 * pivots distinct, pivot entries positive); a row is inserted by the Euclidean algorithm on
 * pivot entries, a vector is reduced pivot by pivot. Exact: every entry is a safe integer, and
 * an insertion that would leave the safe range is dropped (the lattice then knows less, which is
 * sound: a derivation is only ever missed, never invented).
 */

/** A sparse integer vector: column → coefficient (never 0). */
export type Vector = Map<number, number>;

/** The constant column (after every variable). */
export const CONST = 2 ** 30;

/** Degrees in the modulus of directed angles. */
export const MODULUS = 180;

function minColumn(v: Vector): number | undefined {
  let m: number | undefined;
  for (const k of v.keys()) if (m === undefined || k < m) m = k;
  return m;
}

/** a − q·b, or undefined when an entry would leave the safe integers. */
function axpy(a: Vector, q: number, b: Vector): Vector | undefined {
  const out = new Map(a);
  for (const [k, x] of b) {
    const y = (out.get(k) ?? 0) - q * x;
    if (!Number.isSafeInteger(y)) return undefined;
    if (y === 0) out.delete(k);
    else out.set(k, y);
  }
  return out;
}

function negate(v: Vector): Vector {
  return new Map([...v].map(([k, x]) => [k, -x]));
}

export class Lattice {
  private readonly rows = new Map<number, Vector>();

  constructor(rows?: ReadonlyMap<number, Vector>) {
    if (rows === undefined) this.rows.set(CONST, new Map([[CONST, MODULUS]]));
    else for (const [k, v] of rows) this.rows.set(k, new Map(v));
  }

  /** An independent copy (a snapshot before more rows are inserted). */
  clone(): Lattice {
    return new Lattice(this.rows);
  }

  /** The number of rows (the modulus row included). */
  get size(): number {
    return this.rows.size;
  }

  /** The constant of `v` reduced into [0, g) by the modulus row (g divides 180). */
  private reduceConst(v: Vector): Vector {
    const g = this.rows.get(CONST)?.get(CONST);
    const c = v.get(CONST);
    if (g === undefined || c === undefined) return v;
    const r = ((c % g) + g) % g;
    const out = new Map(v);
    if (r === 0) out.delete(CONST);
    else out.set(CONST, r);
    return out;
  }

  /** Inserts a row; returns false when it had to be dropped (the safe-integer guard). */
  insert(row: Vector): boolean {
    let v: Vector | undefined = new Map([...row].filter(([, x]) => x !== 0));
    for (;;) {
      v = this.reduceConst(v);
      const p = minColumn(v);
      if (p === undefined) return true;
      const old = this.rows.get(p);
      if (old === undefined) {
        this.rows.set(p, (v.get(p) ?? 0) < 0 ? negate(v) : v);
        return true;
      }
      // The Euclidean algorithm on the pivot entries: a keeps the gcd, b ends with 0 there.
      let a: Vector = old;
      let b: Vector = v;
      while ((b.get(p) ?? 0) !== 0) {
        const q = Math.trunc((a.get(p) ?? 0) / (b.get(p) ?? 1));
        const r = axpy(a, q, b);
        if (r === undefined) return false;
        a = b;
        b = r;
      }
      this.rows.set(p, (a.get(p) ?? 0) < 0 ? negate(a) : a);
      if (p === CONST) return true;
      v = b;
    }
  }

  /** Whether `v` is an integer combination of the rows (the congruence follows). */
  contains(vector: Vector): boolean {
    let v: Vector | undefined = new Map([...vector].filter(([, x]) => x !== 0));
    for (;;) {
      v = this.reduceConst(v);
      const p = minColumn(v);
      if (p === undefined) return true;
      const row = this.rows.get(p);
      const x = v.get(p) ?? 0;
      const pivot = row?.get(p);
      if (row === undefined || pivot === undefined || x % pivot !== 0) return false;
      v = axpy(v, x / pivot, row);
      if (v === undefined) return false;
    }
  }
}
