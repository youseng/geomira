# Display values, labels and styles in every export format (notes B and D of Run 9a): angle
# marks (1–3 arcs, the right-angle square), segment ticks, texts with Greek letters and TeX
# specials, every name form of the grammar, image names with stars in a derived layer (marks
# and texts have images too), colours, dashes, widths, layer opacity, z-order, hidden objects.
@version 1
@title "Export: display values & labels"
@layer refl = image(s, main) [opacity=0.5] [suffix=*]
A = (0, 0)
B = (6, 0)
C = (1, 4)
H = orthocenter(A, B, C)
F = foot(C, A, B)
tri = polygon(A, B, C) [color="#2266aa"]
a1 = mark_angle(B, A, C)
a2 = mark_angle(C, B, A, 2) [color="rgb(200, 30, 30)"]
a3 = mark_angle(A, C, B, 3) [color="hsl(120, 60%, 30%)"]
r1 = mark_right(C, F, B)
m1 = mark_segment(A, F)
m2 = mark_segment(F, B, 2)
m3 = mark_segment(B, C, 3) [dash=dashed]
t1 = text((1, 5), "Let \\omega be the circle; ∠ACB ≠ 90°, AB ≤ AC & 50% #1 {x} ~y")
t2 = text((7, 3), "ℓ₁ ∥ ℓ₂ ⟂ m, √(3)/2 — done")
t3 = text((5, -1), "café ☃")
M_a = midpoint(B, C)
M_{ab} = midpoint(A, B) [label_angle=270, label_dist=14]
H' = reflect(H, line(A, B))
A_1'' = midpoint(A, H)
P1 = midpoint(A, C)
ω = circumcircle(A, B, C) [color=darkorange, width=2.5, dash=dotted]
x_a = line(C, F) [color=notacolour]
ν = circle(H, 1) [z=-1, label="\\nu-circle"]
Q = midpoint(F, H) [hidden]
s = reflect(line(A, B))
style A* [color=purple]
