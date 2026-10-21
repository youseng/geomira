# The Asymptote export's numeric fallback for every kind of variable (ADR-0014 decision 10): each
# object below is written numerically (its tool, or an argument, has no constructive mapping), and
# constructive objects built on them use their variables; tex.yml checks all their coordinates.
@version 1
@title "Export: numeric variables"
A = (0, 0)
B = (5, 0)
C = (1, 4)
k = sqrt(2)
T = rotate(C, sqrt(3))
X = apply(T, A)
R = rotate(A, C, k)
l = perp(A, line(B, C))
s = reflect(segment(A, B), perp(C, line(A, B)))
r = apply(T, ray(A, B))
ν = ninepoint_circle(A, B, C)
p = polygon(A, B, excenter(A, B, C))
Y = midpoint(X, foot(B, l))
q = apply(T, p)
