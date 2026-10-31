# Measurements shown on the figure (ADR-0048) in every export format: distances as their value
# at the middle of the measured segment (two points; a point and a line, to its foot), angles as
# an arc at the vertex with the value in degrees (angle, dangle), digits, a label prefix with a
# subscript and a Greek letter, colours and opacity, a dragged label offset, a measurement not
# shown (not drawn), a shown ratio (not a drawable measurement: not drawn) and an Undefined
# angle (listed as a warning, never drawn).
@version 1
@title "Export: measurements"
A = (0, 0)
B = (6, 0)
C = (1, 4)
D = (-2, 3)
s = segment(A, B)
l = line(B, C)
d = dist(A, B) [show]
e = dist(A, C) [color=blue, label="b_1", show, digits=3]
h = dist(A, l) [label_angle=200, label_dist=12, show]
α = angle(B, A, C) [color=red, show]
β = angle(A, C, B) [opacity=0.5, label="\\beta", show, digits=0]
γ = dangle(C, B, A) [show, digits=1]
n = dist(B, C)
r = ratio(A, B, A, C) [show]
u = angle(D, D, A) [show]
