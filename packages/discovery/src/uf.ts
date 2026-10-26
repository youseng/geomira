/**
 * Union–find over string keys (internal): an explicit object created per use (no module
 * state), with path halving. Keys are added on first sight.
 */
export class UnionFind {
  private readonly parent = new Map<string, string>();

  find(k: string): string {
    let x = k;
    for (;;) {
      const p = this.parent.get(x);
      if (p === undefined) {
        this.parent.set(x, x);
        return x;
      }
      if (p === x) return x;
      const g = this.parent.get(p) ?? p;
      this.parent.set(x, g);
      x = g;
    }
  }

  /** Joins the classes of a and b; returns whether they were apart. */
  union(a: string, b: string): boolean {
    const [ra, rb] = [this.find(a), this.find(b)];
    if (ra === rb) return false;
    // The smaller key represents the class, so representatives do not depend on order.
    if (ra < rb) this.parent.set(rb, ra);
    else this.parent.set(ra, rb);
    return true;
  }

  same(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }

  /** Every key seen so far. */
  keys(): string[] {
    return [...this.parent.keys()];
  }
}
