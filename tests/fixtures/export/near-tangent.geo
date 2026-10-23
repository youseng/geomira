# Tangencies within the kernel's band (ADR-0027): the kernel gives the double point, and so must
# the Asymptote helpers gm_lc and gm_cc; tex.yml checks the coordinates.
@version 1
@title "Export: near tangencies"
O = (0, 0)
A = (-10, 4.9999995)
B = (10, 4.9999995)
l = line(A, B)
c = circle(O, 5)
T = intersect(l, c, along(+))
c2 = circle((10.0000001, 0), 5)
U = intersect(c, c2, orient(+))
c3 = circle((0, 1), 4.0000001)
V = intersect(c, c3, orient(-))
