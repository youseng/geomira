// GEOMIRA export: Asymptote (standalone). One unit is 40.423562bp (53.898083 px on screen).
// Compile with: asy -f pdf <file>.asy
texpreamble("\usepackage{amssymb}");
unitsize(40.423562);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-5.003781845099897, -2.8372314910840224), gm_hi = (9.393761782654918, 8.591746440226501);
pen gmc0 = rgb("1B1F24");

// ---- helpers ----
// A line p + t*d, t in [lo, hi] where haslo / hashi (a segment: [0, 1]; a ray: [0, oo)).
struct gmline { pair p; pair d; bool haslo; real lo; bool hashi; real hi; }
gmline gm_mkline(pair p, pair d, bool haslo, real lo, bool hashi, real hi) {
  gmline l = new gmline;
  l.p = p; l.d = d; l.haslo = haslo; l.lo = lo; l.hashi = hashi; l.hi = hi;
  return l;
}
gmline gm_ray(pair a, pair b) { return gm_mkline(a, b - a, true, 0, false, 0); }
// A circle: center c, radius r.
struct gmcircle { pair c; real r; }
gmcircle gm_mkcircle(pair c, real r) { gmcircle k = new gmcircle; k.c = c; k.r = r; return k; }
pair gm_midpoint(pair a, pair b) { return (a + b) / 2; }
pair gm_foot(pair p, gmline l) { return l.p + dot(p - l.p, l.d) / dot(l.d, l.d) * l.d; }
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
// A point as the canvas draws it: a dot of radius r, outlined in the paper color, opacity a.
void gm_dot(pair z, real r, pen p, real a) {
  filldraw(circle(z, r), p + opacity(a), gm_paper + opacity(a) + linewidth(0.75));
}

// ---- the figure ----
pair A = (0, 0);
pair B = (5, 0);
pair C = (1, 4);
real k = 1.4142135623730951;
transform T = (0.121358432628205, -0.02839781998829327, 0.9995431086661747, -0.030225385323594926, 0.030225385323594926, 0.9995431086661747); // numeric
pair X = T * A;
pair R = rotate(k, C) * A;
gmline l = gm_mkline((0, 0), (-4, -4), false, 0, false, 0); // numeric
gmline s = gm_mkline((2, 0), (-5, 0), true, 0, true, 1); // numeric
gmline r = gm_apply(T, gm_ray(A, B));
gmcircle nu = gm_mkcircle((1.75, 1.25), 1.4577379737113252); // numeric
path p = (0, 0)--(5, 0)--(7.389979937555022, 5.769921979044934)--cycle; // numeric
pair Y = gm_midpoint(X, gm_foot(B, l));
path q = T * p;

// ---- drawing, back to front as on the screen ----
// p
draw(p, gmc0 + linewidth(1.125));
// q
draw(q, gmc0 + linewidth(1.125));
// ν
draw(circle(nu.c, nu.r), gmc0 + linewidth(1.125));
// l
draw(gm_path(l), gmc0 + linewidth(1.125));
// s
draw(gm_path(s), gmc0 + linewidth(1.125));
// r
draw(gm_path(r), gmc0 + linewidth(1.125));
// A
gm_dot(A, 0.0649374, gmc0, 1);
// B
gm_dot(B, 0.0649374, gmc0, 1);
// C
gm_dot(C, 0.0649374, gmc0, 1);
// X
gm_dot(X, 0.0649374, gmc0, 1);
// R
gm_dot(R, 0.0649374, gmc0, 1);
// Y
gm_dot(Y, 0.0649374, gmc0, 1);
label("$A$", (-0.118074, 0.118074), (-1, 1), gmc0); // label of A
label("$B$", (4.881926, 0.118074), (-1, 1), gmc0); // label of B
label("$C$", (1.118074, 4.118074), (1, 1), gmc0); // label of C
label("$X$", (0.239432, -0.146472), (1, -1), gmc0); // label of X
label("$R$", (-0.019049, -0.141536), (-1, -1), gmc0); // label of R
label("$Y$", (1.192605, 1.353875), (-1, 1), gmc0); // label of Y
draw(box((-3.742141, -1.575591), (8.132121, 7.330106)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-3.742141, -1.575591), (8.132121, 7.330106)));
