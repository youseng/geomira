// GEOMIRA export: Asymptote (standalone). One unit is 37.169803bp (49.559737 px on screen).
// Compile with: asy -f pdf <file>.asy
texpreamble("\usepackage{amssymb}");
unitsize(37.169803);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-6.328935777509512, -6.214722215136416), gm_hi = (9.328935777509512, 6.214722215136416);
pen gmc0 = rgb("1B1F24");
pen gmc1 = rgb("777777");

// ---- helpers ----
// A line p + t*d, t in [lo, hi] where haslo / hashi (a segment: [0, 1]; a ray: [0, oo)).
struct gmline { pair p; pair d; bool haslo; real lo; bool hashi; real hi; }
gmline gm_mkline(pair p, pair d, bool haslo, real lo, bool hashi, real hi) {
  gmline l = new gmline;
  l.p = p; l.d = d; l.haslo = haslo; l.lo = lo; l.hashi = hashi; l.hi = hi;
  return l;
}
gmline gm_line(pair a, pair b) { return gm_mkline(a, b - a, false, 0, false, 0); }
// A circle: center c, radius r.
struct gmcircle { pair c; real r; }
gmcircle gm_mkcircle(pair c, real r) { gmcircle k = new gmcircle; k.c = c; k.r = r; return k; }
pair gm_circumcenter(pair a, pair b, pair c) {
  pair u = b - a, v = c - a;
  real k = 2 * cross(u, v);
  return a + ((v.y * dot(u, u) - u.y * dot(v, v)) / k, (u.x * dot(v, v) - v.x * dot(u, u)) / k);
}
pair gm_orthocenter(pair a, pair b, pair c) { return a + b + c - 2 * gm_circumcenter(a, b, c); }
gmcircle gm_circumcircle(pair a, pair b, pair c) {
  pair o = gm_circumcenter(a, b, c);
  return gm_mkcircle(o, abs(a - o));
}
transform gm_reflect(gmline l) { return reflect(l.p, l.p + l.d); }
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
pair A = (1, 4);
pair B = (-2, 0);
pair C = (5, 0);
gmline a = gm_line(B, C);
pair H = gm_orthocenter(A, B, C);
gmcircle omega = gm_circumcircle(A, B, C);
transform s = gm_reflect(a);
pair As = s * A;
pair Hs = s * H;
gmcircle omegas = gm_apply(s, omega);

// ---- drawing, back to front as on the screen ----
// ω
draw(circle(omega.c, omega.r), gmc0 + linewidth(1.125));
// a
draw(gm_path(a), gmc0 + linewidth(1.125));
// A
gm_dot(A, 0.0706218, gmc0, 1);
// B
gm_dot(B, 0.0706218, gmc0, 1);
// C
gm_dot(C, 0.0706218, gmc0, 1);
// H
gm_dot(H, 0.0706218, gmc0, 1);
// ω*
draw(circle(omegas.c, omegas.r), gmc0 + linewidth(1.125) + opacity(0.6));
// A*
gm_dot(As, 0.0706218, gmc1, 0.6);
// H*
gm_dot(Hs, 0.0706218, gmc0, 0.6);
label("$A$", (0.87159, 4.12841), (-1, 1), gmc0); // label of A
label("$B$", (-1.87159, 0.12841), (1, 1), gmc0); // label of B
label("$C$", (5.12841, 0.12841), (1, 1), gmc0); // label of C
label("$H$", (0.87159, 3.12841), (-1, 1), gmc0); // label of H
label("$A^{*}$", (1.12841, -3.87159), (1, 1), gmc1 + opacity(0.6)); // label of A*
label("$H^{*}$", (1.12841, -2.87159), (1, 1), gmc0 + opacity(0.6)); // label of H*
draw(box((-4.956854, -4.842641), (7.956854, 4.842641)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-4.956854, -4.842641), (7.956854, 4.842641)));
