/**
 * The self-contained Asymptote helpers of the export (SPEC §14 "self-contained helper
 * functions"): plain Asymptote only (no module is imported), each defined once and written
 * only when used, with the helpers it needs before it. Lines are `gmline` (p + t·d, t in
 * [lo, hi] where `haslo`/`hashi`, as the kernel's Line), circles `gmcircle` (centre, radius).
 * Branch helpers return the candidate the kernel's selector picks (ADR-0006): line ∩ circle
 * as {mid − h·û, mid + h·û} (along(−), along(+): further along d), circle ∩ circle as
 * {base − h·n, base + h·n} with n = rot90(c₂ − c₁)/|c₂ − c₁| (orient(−), orient(+): the sign
 * of cross(c₂ − c₁, X − c₁)); other(P) is Vieta / the reflection in the line of centres, as
 * in the kernel. The coordinate check (check.ts, tex.yml) compares every helper's result
 * with the kernel's value.
 */

export interface AsyHelper {
  readonly deps: readonly string[];
  readonly code: string;
}

const H = (deps: readonly string[], ...code: readonly string[]): AsyHelper => ({
  deps,
  code: code.join('\n'),
});

/** The helpers by id, in an order where every helper follows its dependencies. */
export const ASY_HELPERS: readonly (readonly [string, AsyHelper])[] = Object.freeze([
  [
    'gmline',
    H(
      [],
      '// A line p + t*d, t in [lo, hi] where haslo / hashi (a segment: [0, 1]; a ray: [0, oo)).',
      'struct gmline { pair p; pair d; bool haslo; real lo; bool hashi; real hi; }',
      'gmline gm_mkline(pair p, pair d, bool haslo, real lo, bool hashi, real hi) {',
      '  gmline l = new gmline;',
      '  l.p = p; l.d = d; l.haslo = haslo; l.lo = lo; l.hashi = hashi; l.hi = hi;',
      '  return l;',
      '}',
    ),
  ],
  [
    'line',
    H(
      ['gmline'],
      'gmline gm_line(pair a, pair b) { return gm_mkline(a, b - a, false, 0, false, 0); }',
    ),
  ],
  [
    'segment',
    H(
      ['gmline'],
      'gmline gm_segment(pair a, pair b) { return gm_mkline(a, b - a, true, 0, true, 1); }',
    ),
  ],
  [
    'ray',
    H(
      ['gmline'],
      'gmline gm_ray(pair a, pair b) { return gm_mkline(a, b - a, true, 0, false, 0); }',
    ),
  ],
  [
    'gmcircle',
    H(
      [],
      '// A circle: center c, radius r.',
      'struct gmcircle { pair c; real r; }',
      'gmcircle gm_mkcircle(pair c, real r) { gmcircle k = new gmcircle; k.c = c; k.r = r; return k; }',
    ),
  ],
  [
    'circle_point',
    H(['gmcircle'], 'gmcircle gm_circle(pair o, pair a) { return gm_mkcircle(o, abs(a - o)); }'),
  ],
  [
    'circle_radius',
    H(['gmcircle'], 'gmcircle gm_circler(pair o, real r) { return gm_mkcircle(o, r); }'),
  ],
  ['midpoint', H([], 'pair gm_midpoint(pair a, pair b) { return (a + b) / 2; }')],
  [
    'foot',
    H(
      ['gmline'],
      'pair gm_foot(pair p, gmline l) { return l.p + dot(p - l.p, l.d) / dot(l.d, l.d) * l.d; }',
    ),
  ],
  [
    'foot_points',
    H(
      ['foot', 'line'],
      'pair gm_foot(pair p, pair a, pair b) { return gm_foot(p, gm_line(a, b)); }',
    ),
  ],
  [
    'circumcenter',
    H(
      [],
      'pair gm_circumcenter(pair a, pair b, pair c) {',
      '  pair u = b - a, v = c - a;',
      '  real k = 2 * cross(u, v);',
      '  return a + ((v.y * dot(u, u) - u.y * dot(v, v)) / k, (u.x * dot(v, v) - v.x * dot(u, u)) / k);',
      '}',
    ),
  ],
  ['centroid', H([], 'pair gm_centroid(pair a, pair b, pair c) { return (a + b + c) / 3; }')],
  [
    'orthocenter',
    H(
      ['circumcenter'],
      'pair gm_orthocenter(pair a, pair b, pair c) { return a + b + c - 2 * gm_circumcenter(a, b, c); }',
    ),
  ],
  [
    'incenter',
    H(
      [],
      'pair gm_incenter(pair a, pair b, pair c) {',
      '  real la = abs(b - c), lb = abs(c - a), lc = abs(a - b);',
      '  return (la * a + lb * b + lc * c) / (la + lb + lc);',
      '}',
    ),
  ],
  [
    'circumcircle',
    H(
      ['gmcircle', 'circumcenter'],
      'gmcircle gm_circumcircle(pair a, pair b, pair c) {',
      '  pair o = gm_circumcenter(a, b, c);',
      '  return gm_mkcircle(o, abs(a - o));',
      '}',
    ),
  ],
  [
    'incircle',
    H(
      ['gmcircle', 'incenter'],
      'gmcircle gm_incircle(pair a, pair b, pair c) {',
      '  real p = abs(b - c) + abs(c - a) + abs(a - b);',
      '  return gm_mkcircle(gm_incenter(a, b, c), abs(cross(b - a, c - a)) / p);',
      '}',
    ),
  ],
  [
    'meet',
    H(
      ['gmline'],
      '// line meets line',
      'pair gm_meet(gmline l, gmline m) { return l.p + cross(m.p - l.p, m.d) / cross(l.d, m.d) * l.d; }',
    ),
  ],
  [
    'lc',
    H(
      ['gmline', 'gmcircle', 'foot'],
      '// line meets circle: {along(-), along(+)}',
      'pair[] gm_lc(gmline l, gmcircle k) {',
      '  pair f = gm_foot(k.c, l);',
      '  real h = sqrt(max(0, k.r^2 - abs(f - k.c)^2));',
      '  return new pair[] {f - h * unit(l.d), f + h * unit(l.d)};',
      '}',
      '// other(P): the second intersection, 2F - P (Vieta)',
      'pair gm_lc_other(gmline l, gmcircle k, pair p) { return 2 * gm_foot(k.c, l) - p; }',
    ),
  ],
  [
    'cc',
    H(
      ['gmcircle'],
      '// circle meets circle: {orient(-), orient(+)}',
      'pair[] gm_cc(gmcircle a, gmcircle b) {',
      '  pair d = b.c - a.c;',
      '  real s = dot(d, d);',
      '  real x = (s + a.r^2 - b.r^2) / (2 * s);',
      '  real h = sqrt(max(0, a.r^2 - x^2 * s));',
      '  pair n = (-d.y, d.x) / sqrt(s);',
      '  return new pair[] {a.c + x * d - h * n, a.c + x * d + h * n};',
      '}',
      '// other(P): the reflection of P in the line of centers',
      'pair gm_cc_other(gmcircle a, gmcircle b, pair p) { return reflect(a.c, b.c) * p; }',
    ),
  ],
  [
    'pick',
    H(
      ['gmline'],
      '// Selectors on a pair of candidates (index 0, 1).',
      'pair gm_low(pair[] x, int s) { return s > 0 ? x[1] : x[0]; }',
      'pair gm_near(pair[] x, pair p) { return abs(x[0] - p) <= abs(x[1] - p) ? x[0] : x[1]; }',
      'pair gm_far(pair[] x, pair p) { return abs(x[0] - p) >= abs(x[1] - p) ? x[0] : x[1]; }',
      'pair gm_side(pair[] x, pair q, gmline m, bool same) {',
      '  bool s0 = cross(m.d, x[0] - m.p) * cross(m.d, q - m.p) > 0;',
      '  return s0 == same ? x[0] : x[1];',
      '}',
    ),
  ],
  ['reflect', H(['gmline'], 'transform gm_reflect(gmline l) { return reflect(l.p, l.p + l.d); }')],
  [
    'homothety',
    H([], 'transform gm_homothety(pair o, real k) { return shift(o) * scale(k) * shift(-o); }'),
  ],
  [
    'spiral',
    H(
      [],
      '// The direct similarity with a -> c and b -> d: z -> m*z + (c - m*a), m = (d - c)/(b - a).',
      'transform gm_spiral(pair a, pair b, pair c, pair d) {',
      '  pair m = (d - c) / (b - a), t = c - m * a;',
      '  return (t.x, t.y, m.x, -m.y, m.y, m.x);',
      '}',
    ),
  ],
  [
    'apply',
    H(
      ['gmline', 'gmcircle'],
      'gmline gm_apply(transform t, gmline l) {',
      '  return gm_mkline(t * l.p, t * (l.p + l.d) - t * l.p, l.haslo, l.lo, l.hashi, l.hi);',
      '}',
      'gmcircle gm_apply(transform t, gmcircle k) {',
      '  return gm_mkcircle(t * k.c, k.r * sqrt(abs(t.xx * t.yy - t.xy * t.yx)));',
      '}',
    ),
  ],
  [
    'path',
    H(
      ['gmline'],
      '// The part of a line inside the drawn region gm_lo..gm_hi (as the canvas clips it).',
      'path gm_path(gmline l) {',
      '  real t0 = l.haslo ? l.lo : -realMax, t1 = l.hashi ? l.hi : realMax;',
      '  real[] lo = {gm_lo.x, gm_lo.y}, hi = {gm_hi.x, gm_hi.y}, p = {l.p.x, l.p.y}, d = {l.d.x, l.d.y};',
      '  for (int i = 0; i < 2; ++i) {',
      '    if (d[i] == 0) { if (p[i] < lo[i] || p[i] > hi[i]) return nullpath; continue; }',
      '    real a = (lo[i] - p[i]) / d[i], b = (hi[i] - p[i]) / d[i];',
      '    t0 = max(t0, min(a, b)); t1 = min(t1, max(a, b));',
      '  }',
      '  return t0 <= t1 ? (l.p + t0 * l.d)--(l.p + t1 * l.d) : nullpath;',
      '}',
    ),
  ],
  [
    'dot',
    H(
      [],
      '// A point as the canvas draws it: a dot of radius r, outlined in the paper color, opacity a.',
      'void gm_dot(pair z, real r, pen p, real a) {',
      '  filldraw(circle(z, r), p + opacity(a), gm_paper + opacity(a) + linewidth(0.75));',
      '}',
    ),
  ],
] as const);

/** The helper of an id, or undefined. */
export function asyHelper(id: string): AsyHelper | undefined {
  return ASY_HELPERS.find(([k]) => k === id)?.[1];
}

/** The helpers `ids` need, dependencies first, in ASY_HELPERS order. */
export function helperClosure(ids: Iterable<string>): string[] {
  const want = new Set<string>();
  const visit = (id: string) => {
    if (want.has(id)) return;
    want.add(id);
    for (const d of asyHelper(id)?.deps ?? []) visit(d);
  };
  for (const id of ids) visit(id);
  return ASY_HELPERS.map(([k]) => k).filter((k) => want.has(k));
}
