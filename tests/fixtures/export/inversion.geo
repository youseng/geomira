# Images under an inversion (ADR-0032) in every export format: a derived layer of the
# inversion in w, with a segment through the center (two rays), a segment with an end at the
# center (a ray), a segment off it (an arc), a line through the center, circles through and off
# the center (a line and a circle), an arc, an angle mark (on the tangents of the image arms),
# a text, and a polygon whose image is undefined (listed, never drawn). A Möbius map has no
# Asymptote variable: everything built from it is written numerically. tex.yml compiles it.
@version 1
@title "Export: inversion"
@layer inv = image(f, main) [suffix=*]
O = (0, 0)
A = (2, 0)
w = circle(O, A) [color=gray, noimage]
f = inversion(w)
P = (-1, -1)
Q = (3, 1)
R = (1, 2)
S = (-2, 1)
T = (2, 2)
pq = segment(P, Q) [color=blue]
pt = segment(P, T) [color=brown]
oq = segment(O, R) [color=red]
sr = segment(S, R) [color=green]
k = circle(R, O) [color=orange]
c = circle(Q, 1) [color=purple]
a = arc(A, R, S) [color=teal]
m = mark_angle(Q, R, S)
t = text((1, -2), "inverted")
tri = polygon(P, Q, R)
