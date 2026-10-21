// GEOMIRA export: Asymptote (aops). One unit is 60bp (80 px on screen).
// For AoPS: uses olympiad.asy (foot, circumcenter, incenter); checked by hand, not compiled in CI.
import olympiad;
unitsize(60);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-3.35, -1.85), gm_hi = (6.35, 5.85);
pen gmc0 = rgb("1B1F24");
pen gmc1 = rgb("FF0000");

// ---- helpers ----
// A line p + t*d, t in [lo, hi] where haslo / hashi (a segment: [0, 1]; a ray: [0, oo)).
struct gmline { pair p; pair d; bool haslo; real lo; bool hashi; real hi; }
gmline gm_mkline(pair p, pair d, bool haslo, real lo, bool hashi, real hi) {
  gmline l = new gmline;
  l.p = p; l.d = d; l.haslo = haslo; l.lo = lo; l.hashi = hashi; l.hi = hi;
  return l;
}
gmline gm_line(pair a, pair b) { return gm_mkline(a, b - a, false, 0, false, 0); }
pair gm_circumcenter(pair a, pair b, pair c) {
  pair u = b - a, v = c - a;
  real k = 2 * cross(u, v);
  return a + ((v.y * dot(u, u) - u.y * dot(v, v)) / k, (u.x * dot(v, v) - v.x * dot(u, u)) / k);
}
pair gm_centroid(pair a, pair b, pair c) { return (a + b + c) / 3; }
pair gm_orthocenter(pair a, pair b, pair c) { return a + b + c - 2 * gm_circumcenter(a, b, c); }
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
pair A = (1, 4);
pair B = (-2, 0);
pair C = (5, 0);
path abc = A--B--C--cycle;
pair O = circumcenter(A, B, C);
pair G = gm_centroid(A, B, C);
pair H = gm_orthocenter(A, B, C);
gmline e = gm_line(O, H);

// ---- drawing, back to front as on the screen ----
// abc
fill(abc, gmc0 + opacity(0.08));
draw(abc, gmc0 + linewidth(1.125));
// e
draw(gm_path(e), gmc1 + linewidth(1.125) + linetype(new real[] {6.75, 5.25}, false));
// A
gm_dot(A, 0.04375, gmc0, 1);
// B
gm_dot(B, 0.04375, gmc0, 1);
// C
gm_dot(C, 0.04375, gmc0, 1);
// O
gm_dot(O, 0.04375, gmc0, 1);
// G
gm_dot(G, 0.04375, gmc0, 1);
// H
gm_dot(H, 0.04375, gmc0, 1);
label("$A$", (1.07955, 4.07955), (1, 1), gmc0); // label of A
label("$B$", (-2.07955, 0.07955), (-1, 1), gmc0); // label of B
label("$C$", (5.07955, 0.07955), (1, 1), gmc0); // label of C
label("$O$", (1.57955, 0.57955), (1, 1), gmc0); // label of O
label("$G$", (1.412883, 1.412883), (1, 1), gmc0); // label of G
label("$H$", (1.07955, 3.07955), (1, 1), gmc0); // label of H
draw(box((-2.5, -1), (5.5, 5)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-2.5, -1), (5.5, 5)));
