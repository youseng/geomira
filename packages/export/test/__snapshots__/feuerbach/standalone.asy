// GEOMIRA export: Asymptote (standalone). One unit is 12.426407bp (16.568542 px on screen).
// Compile with: asy -f pdf <file>.asy
texpreamble("\usepackage{amssymb}");
unitsize(12.426407);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-20.710764773832476, -21.83208511739212), gm_hi = (26.124978336205576, 15.34680374315355);
pen gmc0 = rgb("1B1F24");
pen gmc1 = rgb("1F6FD1");

// ---- helpers ----
// A circle: centre c, radius r.
struct gmcircle { pair c; real r; }
gmcircle gm_mkcircle(pair c, real r) { gmcircle k = new gmcircle; k.c = c; k.r = r; return k; }
pair gm_incenter(pair a, pair b, pair c) {
  real la = abs(b - c), lb = abs(c - a), lc = abs(a - b);
  return (la * a + lb * b + lc * c) / (la + lb + lc);
}
gmcircle gm_incircle(pair a, pair b, pair c) {
  real p = abs(b - c) + abs(c - a) + abs(a - b);
  return gm_mkcircle(gm_incenter(a, b, c), abs(cross(b - a, c - a)) / p);
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
gmcircle nu = gm_mkcircle((1.25, 1.75), 1.7677669529663689); // numeric
gmcircle i = gm_incircle(A, B, C);
gmcircle x_a = gm_mkcircle((1.8284271247461903, -7.65685424949238), 7.65685424949238); // numeric
gmcircle x_b = gm_mkcircle((6.828427124746191, 4.414213562373096), 4.414213562373096); // numeric

// ---- drawing, back to front as on the screen ----
// abc
draw(abc, gmc0 + linewidth(1.125));
// ν
draw(circle(nu.c, nu.r), gmc1 + linewidth(1.125));
// i
draw(circle(i.c, i.r), gmc0 + linewidth(1.125));
// x_a
draw(circle(x_a.c, x_a.r), gmc0 + linewidth(1.125));
// x_b
draw(circle(x_b.c, x_b.r), gmc0 + linewidth(1.125));
// A
gm_dot(A, 0.2112437, gmc0, 1);
// B
gm_dot(B, 0.2112437, gmc0, 1);
// C
gm_dot(C, 0.2112437, gmc0, 1);
label("$A$", (1.384099, 4.384099), (1, 1), gmc0); // label of A
label("$B$", (-2.384099, 0.384099), (-1, 1), gmc0); // label of B
label("$C$", (5.384099, 0.384099), (1, 1), gmc0); // label of C
draw(box((-16.606602, -17.727922), (22.020815, 11.242641)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-16.606602, -17.727922), (22.020815, 11.242641)));
