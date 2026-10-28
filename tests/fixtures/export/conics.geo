# Conics in every export format (Run 16b, ADR-0042): an ellipse, a hyperbola (two branches,
# each a path of its own), a parabola and a circle's projective image, clipped to the view and
# written numerically; points on them, the tangents from a point, a pole and a polar, a line
# meeting a conic, the centre. tex.yml compiles every format and checks Asymptote's points.
@version 1
@title "Export: conics"
A = (2, 0)
B = (0, 1)
C = (-2, 0)
D = (0, -1)
E = (6/5, 4/5)
e = conic(A, B, C, D, E) [color=teal, label="\\Gamma"]
O = conic_center(e)
H1 = (1, 1)
H2 = (2, 1/2)
H3 = (-1, -1)
H4 = (4, 1/4)
H5 = (1/2, 2)
h = conic(H1, H2, H3, H4, H5) [color=darkorange, width=2]
G = on(h, 3, 2)
P = (3, 2)
t_1 = tangent_from(P, e, orient(+))
t_2 = tangent_from(P, e, orient(-)) [dash=dashed]
p = polar(P, e) [dash=dotted]
T = pole(line(H1, H2), h)
X = intersect(line(C, B), h, along(+))
V = (0, -3)
q = conic(V, (1, -2), (-1, -2), (2, 1), (-2, 1)) [color=purple]
w = circle((-3, 2), 1)
f = projective((0, 0), (1, 0), (0, 1), (1, 1), (0, 0), (1, 0), (0, 1), (3/2, 3/2))
w' = apply(f, w) [dash=dashed]
