// GEOMIRA export: Asymptote (aops). One unit is 28.571429bp (38.095238 px on screen).
// For AoPS: uses olympiad.asy (foot, circumcenter, incenter); checked by hand, not compiled in CI.
import olympiad;
unitsize(28.571429);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-8.185, -5.835), gm_hi = (12.185, 10.335);
pen gmc0 = rgb("1B1F24");

// ---- helpers ----
// A line p + t*d, t in [lo, hi] where haslo / hashi (a segment: [0, 1]; a ray: [0, oo)).
struct gmline { pair p; pair d; bool haslo; real lo; bool hashi; real hi; }
gmline gm_mkline(pair p, pair d, bool haslo, real lo, bool hashi, real hi) {
  gmline l = new gmline;
  l.p = p; l.d = d; l.haslo = haslo; l.lo = lo; l.hashi = hashi; l.hi = hi;
  return l;
}
// A circle: centre c, radius r.
struct gmcircle { pair c; real r; }
gmcircle gm_mkcircle(pair c, real r) { gmcircle k = new gmcircle; k.c = c; k.r = r; return k; }
gmcircle gm_circler(pair o, real r) { return gm_mkcircle(o, r); }
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
pair P = (0, 0);
pair Q = (5, 1);
pair R = (2, 5);
gmcircle c1 = gm_circler(P, 3);
gmcircle c2 = gm_circler(Q, 2);
gmcircle c3 = gm_circler(R, 5/2);
gmline r12 = gm_mkline((2.980769230769231, 0.5961538461538461), (-1, 5), false, 0, false, 0); // numeric
gmline r23 = gm_mkline((3.635, 2.8200000000000003), (-4, -3), false, 0, false, 0); // numeric
gmline r13 = gm_mkline((1.0948275862068966, 2.7370689655172415), (-5, 2), false, 0, false, 0); // numeric

// ---- drawing, back to front as on the screen ----
// c1
draw(circle(c1.c, c1.r), gmc0 + linewidth(1.125));
// c2
draw(circle(c2.c, c2.r), gmc0 + linewidth(1.125));
// c3
draw(circle(c3.c, c3.r), gmc0 + linewidth(1.125));
// r12
draw(gm_path(r12), gmc0 + linewidth(1.125));
// r23
draw(gm_path(r23), gmc0 + linewidth(1.125));
// r13
draw(gm_path(r13), gmc0 + linewidth(1.125));
// P
gm_dot(P, 0.091875, gmc0, 1);
// Q
gm_dot(Q, 0.091875, gmc0, 1);
// R
gm_dot(R, 0.091875, gmc0, 1);
label("$P$", (-0.167054, 0.167054), (-1, 1), gmc0); // label of P
label("$Q$", (5.167054, 1.167054), (1, 1), gmc0); // label of Q
label("$R$", (2.167054, 5.167054), (1, 1), gmc0); // label of R
draw(box((-6.4, -4.05), (10.4, 8.55)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-6.4, -4.05), (10.4, 8.55)));
