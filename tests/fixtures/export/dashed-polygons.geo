# Dashed and dotted polygons (ADR-0028): the dash pattern restarts at every vertex in every
# format, as the canvas strokes each edge on its own; Asymptote draws each edge with subpath.
# tex.yml compiles it.
@version 1
@title "Export: dashed polygons"
A = (0, 0)
B = (4, 0)
C = (1, 3)
D = (6, 1)
t = polygon(A, B, C) [dash=dashed]
u = polygon(B, D, C) [dash=dotted, color="#2266aa"]
r = reflect(t, line(A, B))
