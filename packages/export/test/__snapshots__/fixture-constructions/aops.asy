// GEOMIRA export: Asymptote (aops). One unit is 18.942261bp (25.256349 px on screen).
// For AoPS: uses olympiad.asy (foot, circumcenter, incenter); checked by hand, not compiled in CI.
import olympiad;
unitsize(18.942261);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-13.559698382809884, -13.276152562418872), gm_hi = (17.165249658273876, 11.113754645451738);
pen gmc0 = rgb("1B1F24");

// ---- helpers ----
// A line p + t*d, t in [lo, hi] where haslo / hashi (a segment: [0, 1]; a ray: [0, oo)).
struct gmline { pair p; pair d; bool haslo; real lo; bool hashi; real hi; }
gmline gm_mkline(pair p, pair d, bool haslo, real lo, bool hashi, real hi) {
  gmline l = new gmline;
  l.p = p; l.d = d; l.haslo = haslo; l.lo = lo; l.hashi = hashi; l.hi = hi;
  return l;
}
gmline gm_line(pair a, pair b) { return gm_mkline(a, b - a, false, 0, false, 0); }
gmline gm_segment(pair a, pair b) { return gm_mkline(a, b - a, true, 0, true, 1); }
gmline gm_ray(pair a, pair b) { return gm_mkline(a, b - a, true, 0, false, 0); }
// A circle: centre c, radius r.
struct gmcircle { pair c; real r; }
gmcircle gm_mkcircle(pair c, real r) { gmcircle k = new gmcircle; k.c = c; k.r = r; return k; }
gmcircle gm_circle(pair o, pair a) { return gm_mkcircle(o, abs(a - o)); }
gmcircle gm_circler(pair o, real r) { return gm_mkcircle(o, r); }
pair gm_midpoint(pair a, pair b) { return (a + b) / 2; }
pair gm_foot(pair p, gmline l) { return l.p + dot(p - l.p, l.d) / dot(l.d, l.d) * l.d; }
pair gm_circumcenter(pair a, pair b, pair c) {
  pair u = b - a, v = c - a;
  real k = 2 * cross(u, v);
  return a + ((v.y * dot(u, u) - u.y * dot(v, v)) / k, (u.x * dot(v, v) - v.x * dot(u, u)) / k);
}
pair gm_centroid(pair a, pair b, pair c) { return (a + b + c) / 3; }
pair gm_orthocenter(pair a, pair b, pair c) { return a + b + c - 2 * gm_circumcenter(a, b, c); }
pair gm_incenter(pair a, pair b, pair c) {
  real la = abs(b - c), lb = abs(c - a), lc = abs(a - b);
  return (la * a + lb * b + lc * c) / (la + lb + lc);
}
gmcircle gm_circumcircle(pair a, pair b, pair c) {
  pair o = gm_circumcenter(a, b, c);
  return gm_mkcircle(o, abs(a - o));
}
gmcircle gm_incircle(pair a, pair b, pair c) {
  real p = abs(b - c) + abs(c - a) + abs(a - b);
  return gm_mkcircle(gm_incenter(a, b, c), abs(cross(b - a, c - a)) / p);
}
// line meets line
pair gm_meet(gmline l, gmline m) { return l.p + cross(m.p - l.p, m.d) / cross(l.d, m.d) * l.d; }
// line meets circle: {along(-), along(+)}
pair[] gm_lc(gmline l, gmcircle k) {
  pair f = gm_foot(k.c, l);
  real h = sqrt(max(0, k.r^2 - abs(f - k.c)^2));
  return new pair[] {f - h * unit(l.d), f + h * unit(l.d)};
}
// other(P): the second intersection, 2F - P (Vieta)
pair gm_lc_other(gmline l, gmcircle k, pair p) { return 2 * gm_foot(k.c, l) - p; }
// circle meets circle: {orient(-), orient(+)}
pair[] gm_cc(gmcircle a, gmcircle b) {
  pair d = b.c - a.c;
  real s = dot(d, d);
  real x = (s + a.r^2 - b.r^2) / (2 * s);
  real h = sqrt(max(0, a.r^2 - x^2 * s));
  pair n = (-d.y, d.x) / sqrt(s);
  return new pair[] {a.c + x * d - h * n, a.c + x * d + h * n};
}
// other(P): the reflection of P in the line of centres
pair gm_cc_other(gmcircle a, gmcircle b, pair p) { return reflect(a.c, b.c) * p; }
// Selectors on a pair of candidates (index 0, 1).
pair gm_low(pair[] x, int s) { return s > 0 ? x[1] : x[0]; }
pair gm_near(pair[] x, pair p) { return abs(x[0] - p) <= abs(x[1] - p) ? x[0] : x[1]; }
pair gm_far(pair[] x, pair p) { return abs(x[0] - p) >= abs(x[1] - p) ? x[0] : x[1]; }
pair gm_side(pair[] x, pair q, gmline m, bool same) {
  bool s0 = cross(m.d, x[0] - m.p) * cross(m.d, q - m.p) > 0;
  return s0 == same ? x[0] : x[1];
}
transform gm_reflect(gmline l) { return reflect(l.p, l.p + l.d); }
transform gm_homothety(pair o, real k) { return shift(o) * scale(k) * shift(-o); }
// The direct similarity with a -> c and b -> d: z -> m*z + (c - m*a), m = (d - c)/(b - a).
transform gm_spiral(pair a, pair b, pair c, pair d) {
  pair m = (d - c) / (b - a), t = c - m * a;
  return (t.x, t.y, m.x, -m.y, m.y, m.x);
}
gmline gm_apply(transform t, gmline l) {
  return gm_mkline(t * l.p, t * (l.p + l.d) - t * l.p, l.haslo, l.lo, l.hashi, l.hi);
}
gmcircle gm_apply(transform t, gmcircle k) {
  return gm_mkcircle(t * k.c, k.r * sqrt(abs(t.xx * t.yy - t.xy * t.yx)));
}
// The part of a line inside the drawn region gm_lo..gm_hi (as the canvas clips it).
path gm_path(gmline l) {
  real t0 = l.haslo ? l.lo : -realMax, t1 = l.hashi ? l.hi : realMax;
  real[] lo = {gm_lo.x, gm_lo.y}, hi = {gm_hi.x, gm_hi.y}, p = {l.p.x, l.p.y}, d = {l.d.x, l.d.y};
  for (int i = 0; i < 2; ++i) {
    if (d[i] == 0) { if (p[i] < lo[i] || p[i] > hi[i]) return nullpath; continue; }
    real a = (lo[i] - p[i]) / d[i], b = (hi[i] - p[i]) / d[i];
    t0 = max(t0, min(a, b)); t1 = min(t1, max(a, b));
  }
  return t0 <= t1 ? (l.p + t0 * l.d)--(l.p + t1 * l.d) : nullpath;
}
// A point as the canvas draws it: a dot of radius r, outlined in the paper colour, opacity a.
void gm_dot(pair z, real r, pen p, real a) {
  filldraw(circle(z, r), p + opacity(a), gm_paper + opacity(a) + linewidth(0.75));
}

// ---- the figure ----
pair A = (0, 0);
pair B = (6, 0);
pair C = (1, 5);
pair P = (3, -2);
pair M = gm_midpoint(A, B);
gmline l = gm_line(A, B);
gmline s1 = gm_segment(B, C);
gmline r1 = gm_ray(C, A);
pair F1 = gm_foot(C, l);
pair F2 = foot(P, B, C);
pair O = circumcenter(A, B, C);
pair G = gm_centroid(A, B, C);
pair H = gm_orthocenter(A, B, C);
pair I = incenter(A, B, C);
gmcircle w = gm_circumcircle(A, B, C);
gmcircle i = gm_incircle(A, B, C);
gmcircle c1 = gm_circle(O, A);
gmcircle c2 = gm_circler(P, 3);
gmcircle c3 = gm_circumcircle(A, B, C);
path t = A--B--C--cycle;
pair X1 = gm_meet(l, gm_line(C, P));
pair X2 = gm_lc_other(gm_line(C, H), w, C);
pair X3 = gm_low(gm_lc(gm_line(P, I), w), +1);
pair X4 = gm_near(gm_lc(gm_line(P, I), w), P);
pair X5 = gm_far(gm_lc(gm_line(P, I), w), P);
pair X6 = gm_side(gm_lc(gm_line(P, I), w), P, l, true);
pair X7 = gm_side(gm_lc(gm_line(P, I), w), P, l, false);
pair X8 = gm_lc_other(gm_line(C, H), w, C);
pair X9 = gm_low(gm_lc(l, i), +1);
pair Y1 = gm_low(gm_cc(w, c2), +1);
pair Y2 = gm_cc_other(w, gm_circle(B, A), A);
pair Y3 = gm_near(gm_cc(w, c2), B);
pair Y4 = gm_far(gm_cc(w, c2), B);
pair Y5 = gm_side(gm_cc(w, c2), B, gm_line(O, P), true);
pair Y6 = gm_side(gm_cc(w, c2), B, gm_line(O, P), false);
gmcircle k1 = gm_circler(A, 6);
gmcircle k2 = gm_circler(M, 3);
pair Z = gm_low(gm_cc(k1, k2), +1);
pair N1 = (2.8867924528301887, -1.6037735849056602); // numeric
transform T1 = gm_reflect(l);
transform T2 = rotate(180, P);
transform T3 = rotate(60, O);
transform T4 = gm_homothety(G, -1/2);
transform T5 = shift(P - A);
transform T6 = gm_spiral(A, B, A, C);
transform T7 = T1 * T3;
transform T8 = inverse(T6);
pair C1 = T7 * C;
pair C2 = T2 * C;
gmline l1 = gm_apply(T4, l);
gmcircle w1 = gm_apply(T5, w);
path t1 = T8 * t;
pair R1 = gm_reflect(l) * C;
pair R2 = rotate(90, O) * C;
pair R3 = gm_homothety(G, 2) * H;
pair R4 = shift(B - A) * C;
pair R5 = gm_spiral(A, B, A, C) * C;
gmline s2 = gm_apply(rotate(180, P), s1);
gmcircle w2 = gm_apply(rotate(30, A), w);
path t2 = gm_reflect(l) * t;
real k = 2/3;
real n1 = k + (1/2);
real n2 = k - 1;
real n3 = k * 3;
real n4 = k / 4;
real n5 = -k;
pair R6 = rotate(n3 * 45, A) * B;
pair R7 = gm_homothety(A, n1) * C;
pair R8 = gm_homothety(A, n2) * C;
pair R9 = gm_homothety(A, n4) * C;
pair R10 = gm_homothety(A, n5) * C;
pair H_d = gm_midpoint(C, H);
pair D = gm_midpoint(H_d, A);

// ---- drawing, back to front as on the screen ----
// t
fill(t, gmc0 + opacity(0.08));
draw(t, gmc0 + linewidth(1.125));
// t1
fill(t1, gmc0 + opacity(0.08));
draw(t1, gmc0 + linewidth(1.125));
// t2
fill(t2, gmc0 + opacity(0.08));
draw(t2, gmc0 + linewidth(1.125));
// w
draw(circle(w.c, w.r), gmc0 + linewidth(1.125));
// i
draw(circle(i.c, i.r), gmc0 + linewidth(1.125));
// c1
draw(circle(c1.c, c1.r), gmc0 + linewidth(1.125));
// c2
draw(circle(c2.c, c2.r), gmc0 + linewidth(1.125));
// c3
draw(circle(c3.c, c3.r), gmc0 + linewidth(1.125));
// k1
draw(circle(k1.c, k1.r), gmc0 + linewidth(1.125));
// k2
draw(circle(k2.c, k2.r), gmc0 + linewidth(1.125));
// w1
draw(circle(w1.c, w1.r), gmc0 + linewidth(1.125));
// w2
draw(circle(w2.c, w2.r), gmc0 + linewidth(1.125));
// l
draw(gm_path(l), gmc0 + linewidth(1.125));
// s1
draw(gm_path(s1), gmc0 + linewidth(1.125));
// r1
draw(gm_path(r1), gmc0 + linewidth(1.125));
// l1
draw(gm_path(l1), gmc0 + linewidth(1.125));
// s2
draw(gm_path(s2), gmc0 + linewidth(1.125));
// A
gm_dot(A, 0.138579, gmc0, 1);
// B
gm_dot(B, 0.138579, gmc0, 1);
// C
gm_dot(C, 0.138579, gmc0, 1);
// P
gm_dot(P, 0.138579, gmc0, 1);
// M
gm_dot(M, 0.138579, gmc0, 1);
// F1
gm_dot(F1, 0.138579, gmc0, 1);
// F2
gm_dot(F2, 0.138579, gmc0, 1);
// O
gm_dot(O, 0.138579, gmc0, 1);
// G
gm_dot(G, 0.138579, gmc0, 1);
// H
gm_dot(H, 0.138579, gmc0, 1);
// I
gm_dot(I, 0.138579, gmc0, 1);
// X1
gm_dot(X1, 0.138579, gmc0, 1);
// X2
gm_dot(X2, 0.138579, gmc0, 1);
// X3
gm_dot(X3, 0.138579, gmc0, 1);
// X4
gm_dot(X4, 0.138579, gmc0, 1);
// X5
gm_dot(X5, 0.138579, gmc0, 1);
// X6
gm_dot(X6, 0.138579, gmc0, 1);
// X7
gm_dot(X7, 0.138579, gmc0, 1);
// X8
gm_dot(X8, 0.138579, gmc0, 1);
// X9
gm_dot(X9, 0.138579, gmc0, 1);
// Y1
gm_dot(Y1, 0.138579, gmc0, 1);
// Y2
gm_dot(Y2, 0.138579, gmc0, 1);
// Y3
gm_dot(Y3, 0.138579, gmc0, 1);
// Y4
gm_dot(Y4, 0.138579, gmc0, 1);
// Y5
gm_dot(Y5, 0.138579, gmc0, 1);
// Y6
gm_dot(Y6, 0.138579, gmc0, 1);
// Z
gm_dot(Z, 0.138579, gmc0, 1);
// N1
gm_dot(N1, 0.138579, gmc0, 1);
// C1
gm_dot(C1, 0.138579, gmc0, 1);
// C2
gm_dot(C2, 0.138579, gmc0, 1);
// R1
gm_dot(R1, 0.138579, gmc0, 1);
// R2
gm_dot(R2, 0.138579, gmc0, 1);
// R3
gm_dot(R3, 0.138579, gmc0, 1);
// R4
gm_dot(R4, 0.138579, gmc0, 1);
// R5
gm_dot(R5, 0.138579, gmc0, 1);
// R6
gm_dot(R6, 0.138579, gmc0, 1);
// R7
gm_dot(R7, 0.138579, gmc0, 1);
// R8
gm_dot(R8, 0.138579, gmc0, 1);
// R9
gm_dot(R9, 0.138579, gmc0, 1);
// R10
gm_dot(R10, 0.138579, gmc0, 1);
// D
gm_dot(D, 0.138579, gmc0, 1);
label("$A$", (0.251975, 0.251975), (1, 1), gmc0); // label of A
label("$B$", (6.251975, -0.251975), (1, -1), gmc0); // label of B
label("$C$", (0.748025, 5.251975), (-1, 1), gmc0); // label of C
label("$P$", (3.251975, -1.748025), (1, 1), gmc0); // label of P
label("$M$", (2.748025, 0.251975), (-1, 1), gmc0); // label of M
label("$F1$", (1.251975, 0.251975), (1, 1), gmc0); // label of F1
label("$F2$", (5.751975, 0.751975), (1, 1), gmc0); // label of F2
label("$O$", (2.748025, 2.251975), (-1, 1), gmc0); // label of O
label("$G$", (2.081359, 1.918641), (-1, 1), gmc0); // label of G
label("$H$", (1.251975, 1.251975), (1, 1), gmc0); // label of H
label("$I$", (2.370322, 1.651065), (1, 0), gmc0); // label of I
label("$X1$", (2.680546, -0.251975), (1, -1), gmc0); // label of X1
label("$X2$", (1.251975, -0.748025), (1, 1), gmc0); // label of X2
label("$X3$", (1.449649, 5.060148), (1, 0), gmc0); // label of X3
label("$X4$", (2.64107, -1.855939), (-1, -1), gmc0); // label of X4
label("$X5$", (0.841328, 5.312123), (-1, 1), gmc0); // label of X5
label("$X6$", (3.145019, -1.35199), (1, 1), gmc0); // label of X6
label("$X7$", (0.841328, 5.312123), (-1, 1), gmc0); // label of X7
label("$X8$", (0.748025, -1.251975), (-1, -1), gmc0); // label of X8
label("$X9$", (2.265951, 0.251975), (1, 1), gmc0); // label of X9
label("$Y1$", (5.24173, -0.5), (-1, 0), gmc0); // label of Y1
label("$Y2$", (3.944282, 5.790436), (1, 1), gmc0); // label of Y2
label("$Y3$", (5.598076, -0.143654), (0, 1), gmc0); // label of Y3
label("$Y4$", (0.045578, -0.5), (-1, 0), gmc0); // label of Y4
label("$Y5$", (5.598076, -0.856346), (0, -1), gmc0); // label of Y5
label("$Y6$", (0.75827, -0.5), (1, 0), gmc0); // label of Y6
label("$Z$", (6.251975, -0.251975), (1, -1), gmc0); // label of Z
label("$N1$", (3.138767, -1.351799), (1, 1), gmc0); // label of N1
label("$C1$", (-0.850051, -1.515974), (-1, 1), gmc0); // label of C1
label("$C2$", (5.251975, -8.748025), (1, 1), gmc0); // label of C2
label("$R1$", (0.748025, -5.251975), (-1, -1), gmc0); // label of R1
label("$R2$", (0.251975, 0.251975), (1, 1), gmc0); // label of R2
label("$R3$", (-0.585308, 0.585308), (-1, 1), gmc0); // label of R3
label("$R4$", (7.251975, 5.251975), (1, 1), gmc0); // label of R4
label("$R5$", (-3.748025, 1.918641), (1, 1), gmc0); // label of R5
label("$R6$", (0.251975, 6.251975), (1, 1), gmc0); // label of R6
label("$R7$", (1.418641, 6.085308), (1, 1), gmc0); // label of R7
label("$R8$", (-0.081359, -1.918641), (1, -1), gmc0); // label of R8
label("$R9$", (0.418641, 1.085308), (1, 1), gmc0); // label of R9
label("$R10$", (-0.918641, -3.081359), (-1, 1), gmc0); // label of R10
label("$D$", (0.248025, 1.751975), (-1, 1), gmc0); // label of D
draw(box((-10.867306, -10.58376), (14.472857, 8.421362)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-10.867306, -10.58376), (14.472857, 8.421362)));
