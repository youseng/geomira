/**
 * The common points of two conics in floats (internal; ADR-0043 decisions 3–8). Every conic
 * through the four common points is a member s·M₁ + t·M₂ of the pencil; the degenerate members
 * (det = 0, a binary cubic) are the pairs of lines through them. One member is split into its two
 * lines and each line meets a conic by ADR-0042 decision 7, so every count is decided as line ∩
 * conic decides it: on a chord gap as a length with the band. Steps:
 *   - frame: x′ = (x − o)/L, L = ctx.scale, o the given origin (the curves' reference points);
 *   - coincidence on the sine of the angle between the unit coefficient matrices (EPS: they
 *     coincide; the band: ambiguous); the pencil is then spanned by M₁ and the unit difference;
 *   - the real roots of φ(θ) = det(cos θ·M₁ + sin θ·B₂) by sign changes and bisection, the most
 *     isolated used (the line through two merging points is always one of its lines);
 *   - a root with two more roots within ∛EPS (a triple contact) is replaced by the cluster's
 *     centroid and the cluster is one triple point (the member's vertex);
 *   - the lines (or, for a conjugate pair, its real vertex when it lies on both curves); the line
 *     at infinity has no finite point; each line meets the curve on which it is less nearly
 *     asymptotic; candidates within the band of each other are one point; candidates beyond
 *     scale/EPS are at infinity (dropped), beyond scale/BAND near infinity (ambiguous); simple
 *     points are polished by Newton steps on Q₁ = Q₂ = 0.
 * Everything here is FloatField (numbers): over Q and mod p the common points are roots of a
 * quartic, never approximated (the caller returns Inexact).
 */
import { FloatField as F } from '@geomira/num/float-field';
import { isInexact } from '@geomira/num/field';
import { BAND, EPS, type ToleranceContext } from '@geomira/num/tolerance';
import { halfGradient, matrixOf, qDirection, qValue, quadNorm, type Coeffs } from './conic';
import { adj3, det3, type Mat3 } from './transform/projective';
import { lineConicMeet } from './tools/conic-pairs';
import type { Vec } from './value';

type N = number;
type M = Mat3<N>;

/** A common point and its multiplicity as found (1, 2 for a double point, 3 or 4 in a cluster). */
export interface PencilPoint {
  readonly at: Vec<N>;
  readonly mult: number;
}

export type PencilResult =
  | { readonly kind: 'points'; readonly points: readonly PencilPoint[] }
  | { readonly kind: 'undefined'; readonly reason: string };

const SAMPLES = 96;
const BISECTIONS = 200;
const NEWTON_STEPS = 3;

const fro = (m: M): N => Math.hypot(...m);
const dot9 = (a: M, b: M): N => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
/** A 3×3 matrix from its entries by index. */
const m9 = (f: (i: number) => N): M => [f(0), f(1), f(2), f(3), f(4), f(5), f(6), f(7), f(8)];
const scaleM = (m: M, k: N): M => m9((i) => (m[i] ?? 0) * k);
const transpose = (m: M): M => m9((i) => m[3 * (i % 3) + Math.floor(i / 3)] ?? 0);
const fail = (reason: string): PencilResult => ({ kind: 'undefined', reason });

/** The coefficients of q in the frame X = o + L·x′. */
function inFrame(q: Coeffs<N>, o: Vec<N>, L: N): Coeffs<N> {
  const g = halfGradient(F, q, o);
  return [q[0] * L * L, q[1] * L * L, q[2] * L * L, g.x * L, g.y * L, qValue(F, q, o)];
}

/** The pencil's basis: M₁ and the unit difference, or why the conics (nearly) coincide. */
function basis(q1: Coeffs<N>, q2: Coeffs<N>): readonly [M, M] | string {
  const [m1, m2] = [matrixOf(q1), matrixOf(q2)];
  const b1 = scaleM(m1, 1 / fro(m1));
  const u2 = scaleM(m2, 1 / fro(m2));
  const pr = dot9(u2, b1);
  const diff = m9((i) => (u2[i] ?? 0) - pr * (b1[i] ?? 0));
  const eps = fro(diff);
  if (eps <= EPS) return 'the conics coincide';
  if (eps < BAND) return 'ambiguous: the conics nearly coincide';
  return [b1, scaleM(diff, 1 / eps)];
}

const member = ([b1, b2]: readonly [M, M], th: N): M =>
  m9((i) => Math.cos(th) * (b1[i] ?? 0) + Math.sin(th) * (b2[i] ?? 0));

/** A root of φ in [a, c] where φ(a) = fa and φ(c) have opposite signs, bisected to the last bit. */
function bisect(phi: (th: N) => N, a0: N, fa0: N, c0: N): N {
  let [a, fa, c] = [a0, fa0, c0];
  for (let i = 0; i < BISECTIONS; i++) {
    const m = (a + c) / 2;
    if (m <= a || m >= c) break;
    const fm = phi(m);
    if (fm === 0) return m;
    if (fm * fa < 0) c = m;
    else [a, fa] = [m, fm];
  }
  return (a + c) / 2;
}

/** The real roots of φ on [0, π): its sign changes at SAMPLES equal steps, bisected. */
function roots(b: readonly [M, M]): N[] {
  const phi = (th: N): N => det3(F, member(b, th));
  const out: N[] = [];
  let [lo, flo] = [0, phi(0)];
  for (let k = 1; k <= SAMPLES; k++) {
    const hi = (Math.PI * k) / SAMPLES;
    const fhi = phi(hi);
    if (flo === 0) out.push(lo);
    else if (flo * fhi < 0) out.push(bisect(phi, lo, flo, hi));
    [lo, flo] = [hi, fhi];
  }
  return out;
}

/** The angle between two roots on the projective line (mod π). */
function apart(a: N, b: N): N {
  const d = Math.abs(a - b) % Math.PI;
  return Math.min(d, Math.PI - d);
}

/**
 * The most isolated root, moved to its cluster's centroid when two more roots lie within ∛EPS of
 * it (a triple contact: coefficients known to EPS place a triple root only to within ∛EPS, and
 * the root itself is accurate only to u^{1/3}). In the chart at the
 * root, φ ∝ c₀ + c₁τ + c₂τ² + c₃τ³ (τ = tan(θ − θ₀), det(A + τB) expanded), c₀ ≈ 0.
 */
function chosenRoot(b: readonly [M, M]): { readonly th: N; readonly triple: boolean } | undefined {
  const rs = roots(b);
  let best: { th: N; iso: N } | undefined;
  for (const [i, r] of rs.entries()) {
    const iso = Math.min(Infinity, ...rs.filter((_, j) => j !== i).map((s) => apart(r, s)));
    if (best === undefined || iso > best.iso) best = { th: r, iso };
  }
  if (best === undefined) return undefined;
  const [A, B] = [member(b, best.th), member(b, best.th + Math.PI / 2)];
  const tr = (x: M, y: M): N => dot9(transpose(adj3(F, x)), y);
  const [c1, c2, c3] = [tr(A, B), tr(B, A), det3(F, B)];
  const cn = Math.hypot(det3(F, A), c1, c2, c3);
  const w = Math.cbrt(EPS);
  if (Math.abs(c1) <= w * w * cn && Math.abs(c2) <= 2 * w * cn && c3 !== 0)
    return { th: best.th + Math.atan(-c2 / (3 * c3)), triple: true };
  return { th: best.th, triple: false };
}

type Hom3 = readonly [N, N, N];

type Split =
  | { readonly kind: 'lines'; readonly lines: readonly [Hom3, Hom3]; readonly vertex: Hom3 }
  | { readonly kind: 'conjugate'; readonly vertex: Hom3 };

/**
 * The two lines of a rank-2 member through its adjugate (Richter-Gebert's splitting of a
 * degenerate conic): adj(D) = −p·pᵀ (up to a positive factor) for a real pair meeting at p,
 * +p·pᵀ for a conjugate pair; D + [p]× is then of rank 1, its largest row and column the lines.
 */
function split(D: M): Split {
  const B = adj3(F, D);
  let i = 0;
  for (const j of [1, 2]) if (Math.abs(B[4 * j] ?? 0) > Math.abs(B[4 * i] ?? 0)) i = j;
  const bii = B[4 * i] ?? 0;
  const vertex: Hom3 = [B[i] ?? 0, B[3 + i] ?? 0, B[6 + i] ?? 0];
  if (!(bii < 0)) return { kind: 'conjugate', vertex };
  const beta = Math.sqrt(-bii);
  const [p0, p1, p2] = [vertex[0] / beta, vertex[1] / beta, vertex[2] / beta];
  const cross: M = [0, p2, -p1, -p2, 0, p0, p1, -p0, 0];
  const C = m9((k) => (D[k] ?? 0) + (cross[k] ?? 0));
  let jk = 0;
  for (let k = 1; k < 9; k++) if (Math.abs(C[k] ?? 0) > Math.abs(C[jk] ?? 0)) jk = k;
  const [r, c] = [Math.floor(jk / 3), jk % 3];
  const row: Hom3 = [C[3 * r] ?? 0, C[3 * r + 1] ?? 0, C[3 * r + 2] ?? 0];
  const col: Hom3 = [C[c] ?? 0, C[3 + c] ?? 0, C[6 + c] ?? 0];
  return { kind: 'lines', lines: [row, col], vertex };
}

export interface PencilInput {
  /** The two curves' coefficients (world coordinates, any scale). */
  readonly q1: Coeffs<N>;
  readonly q2: Coeffs<N>;
  /** The frame's origin (the curves' reference points). */
  readonly o: Vec<N>;
  readonly ctx: ToleranceContext;
}

/** |Q(X)|/|∇Q(X)|: X's distance to the curve to first order (a length). */
function gapTo(q: Coeffs<N>, X: Vec<N>): N {
  const g = halfGradient(F, q, X);
  const n = 2 * Math.hypot(g.x, g.y);
  return n > 0 ? Math.abs(qValue(F, q, X)) / n : Infinity;
}

/** Whether a length is zero or inside the band (a decision: merged, double, on). */
const within = (len: N, ctx: ToleranceContext): boolean => {
  // gapTo is Infinity at a curve's centre (no first-order distance): not within (ADR-0045).
  if (!Number.isFinite(len)) return false;
  const s = F.sign(len, 'length', ctx);
  return s === 0 || s === 'ambiguous';
};

/** |α|/(|d|²·√(a² + 2b² + c²)): how far d is from an asymptotic direction of q (dimensionless). */
function openness(q: Coeffs<N>, d: Vec<N>): N {
  return Math.abs(qDirection(F, q, d)) / ((d.x * d.x + d.y * d.y) * Math.sqrt(quadNorm(F, q)));
}

/**
 * The finite common points on one line l (homogeneous, frame coordinates): none for the line at
 * infinity, Undefined (ambiguous) for a line within the band of it, else the line ∩ conic points
 * of the curve on which l is less nearly asymptotic.
 */
function onLine(inp: PencilInput, l: Hom3, out: PencilPoint[]): string | undefined {
  const [L, o] = [inp.ctx.scale, inp.o];
  const n = Math.hypot(l[0], l[1]);
  if (!(Math.abs(l[2]) * EPS < n)) return undefined;
  if (!(Math.abs(l[2]) * BAND < n)) return 'ambiguous: a common point is near infinity';
  const k = (-l[2] / (n * n)) * L;
  const line = { p: { x: o.x + k * l[0], y: o.y + k * l[1] }, d: { x: -l[1], y: l[0] } };
  const q = openness(inp.q1, line.d) >= openness(inp.q2, line.d) ? inp.q1 : inp.q2;
  const m = lineConicMeet(F, q, line.p, line.d, inp.ctx);
  if (isInexact(m)) return m.reason;
  // Inside the band of an asymptotic direction: a common point near infinity.
  if ('kind' in m) return 'ambiguous: a common point is near infinity';
  for (const at of m.points) out.push({ at, mult: m.double ? 2 : 1 });
  return undefined;
}

/** Candidates within the band of each other are one point (their mean, by multiplicity). */
function merged(points: readonly PencilPoint[], ctx: ToleranceContext): PencilPoint[] {
  const out: PencilPoint[] = [];
  for (const p of points) {
    const i = out.findIndex((r) => within(Math.hypot(r.at.x - p.at.x, r.at.y - p.at.y), ctx));
    const r = out[i];
    if (r === undefined) out.push(p);
    else {
      const m = r.mult + p.mult;
      const at = {
        x: (r.at.x * r.mult + p.at.x * p.mult) / m,
        y: (r.at.y * r.mult + p.at.y * p.mult) / m,
      };
      out[i] = { at, mult: m };
    }
  }
  return out;
}

/** A homogeneous frame point in world coordinates, or undefined when it is at infinity. */
function worldOf(inp: PencilInput, v: Hom3): Vec<N> | undefined {
  if (!(Math.hypot(v[0], v[1]) * EPS < Math.abs(v[2]))) return undefined;
  const L = inp.ctx.scale;
  return { x: inp.o.x + (L * v[0]) / v[2], y: inp.o.y + (L * v[1]) / v[2] };
}

/** A triple contact (ADR-0043 decision 6): the vertex, plus the farthest candidate beyond ∛EPS. */
function tripleOf(inp: PencilInput, vertex: Hom3, pts: readonly PencilPoint[]): PencilPoint[] {
  const T = worldOf(inp, vertex);
  if (T === undefined) return [...pts];
  const far = [...pts].sort(
    (a, b) => Math.hypot(b.at.x - T.x, b.at.y - T.y) - Math.hypot(a.at.x - T.x, a.at.y - T.y),
  )[0];
  const d = far === undefined ? 0 : Math.hypot(far.at.x - T.x, far.at.y - T.y);
  return far !== undefined && d > Math.cbrt(EPS) * inp.ctx.scale
    ? [
        { at: T, mult: 3 },
        { at: far.at, mult: 1 },
      ]
    : [{ at: T, mult: 4 }];
}

/** At most NEWTON_STEPS Newton steps on Q₁ = Q₂ = 0, each kept only if it lowers the gap. */
export function polish(inp: Pick<PencilInput, 'q1' | 'q2'>, X0: Vec<N>): Vec<N> {
  const gap = (X: Vec<N>) => Math.max(gapTo(inp.q1, X), gapTo(inp.q2, X));
  let [X, g] = [X0, gap(X0)];
  for (let k = 0; k < NEWTON_STEPS; k++) {
    const [g1, g2] = [halfGradient(F, inp.q1, X), halfGradient(F, inp.q2, X)];
    const [f1, f2] = [qValue(F, inp.q1, X), qValue(F, inp.q2, X)];
    const J = 2 * (g1.x * g2.y - g1.y * g2.x);
    if (!(Math.abs(J) > 0)) break;
    const next = { x: X.x - (f1 * g2.y - f2 * g1.y) / J, y: X.y - (g1.x * f2 - g2.x * f1) / J };
    const gn = gap(next);
    if (!(gn < g)) break;
    [X, g] = [next, gn];
  }
  return X;
}

/** Why the two curves coincide or nearly coincide in floats (decision 4), or undefined. */
export function pencilCoincidence(inp: PencilInput): string | undefined {
  const L = inp.ctx.scale;
  const b = basis(inFrame(inp.q1, inp.o, L), inFrame(inp.q2, inp.o, L));
  return typeof b === 'string' ? b : undefined;
}

/**
 * The real common points of two valid curves (ADR-0043 decisions 3–8), or why there is no
 * answer: the conics coincide or nearly coincide, a decision inside the band of an asymptotic
 * direction, a common point near infinity. No common point → an empty list.
 */
export function pencilPoints(inp: PencilInput): PencilResult {
  const L = inp.ctx.scale;
  const b = basis(inFrame(inp.q1, inp.o, L), inFrame(inp.q2, inp.o, L));
  if (typeof b === 'string') return fail(b);
  const root = chosenRoot(b);
  if (root === undefined) return { kind: 'points', points: [] };
  const s = split(member(b, root.th));
  let pts: PencilPoint[] = [];
  if (s.kind === 'conjugate') {
    const V = worldOf(inp, s.vertex);
    if (V !== undefined && within(Math.max(gapTo(inp.q1, V), gapTo(inp.q2, V)), inp.ctx))
      pts.push({ at: V, mult: 2 });
  } else {
    for (const l of s.lines) {
      const bad = onLine(inp, l, pts);
      if (bad !== undefined) return fail(bad);
    }
    pts = merged(pts, inp.ctx);
    if (root.triple) pts = tripleOf(inp, s.vertex, pts);
  }
  return finish(inp, pts);
}

/** Drops points at infinity (ambiguous near it), polishes simple points, orders by x then y. */
function finish(inp: PencilInput, pts: readonly PencilPoint[]): PencilResult {
  const L = inp.ctx.scale;
  const out: PencilPoint[] = [];
  for (const p of pts) {
    const r = Math.hypot(p.at.x - inp.o.x, p.at.y - inp.o.y);
    if (!(r * EPS < L)) continue;
    if (!(r * BAND < L)) return fail('ambiguous: a common point is near infinity');
    out.push(p.mult === 1 ? { at: polish(inp, p.at), mult: 1 } : p);
  }
  if (!out.every((p) => Number.isFinite(p.at.x) && Number.isFinite(p.at.y)))
    return fail('the common points are beyond the double range');
  out.sort((a, b) => a.at.x - b.at.x || a.at.y - b.at.y);
  return { kind: 'points', points: out };
}
