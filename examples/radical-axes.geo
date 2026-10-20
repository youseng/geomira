# Radical axes: for three circles with non-collinear centres, the three radical axes are
# concurrent (at the radical centre).
@version 1
@title "Radical axes"
P = (0, 0)
Q = (5, 1)
R = (2, 5)
c1 = circle(P, 3)
c2 = circle(Q, 2)
c3 = circle(R, 2.5)
r12 = radical_axis(c1, c2)
r23 = radical_axis(c2, c3)
r13 = radical_axis(c1, c3)
claim concurrent(r12, r23, r13) [name=radical_centre]
claim perpendicular(r12, line(P, Q))
