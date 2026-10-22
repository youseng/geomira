# A figure 0.001 wide (Run 10 audit): the fitted view's unit is about 340,000 bp per world unit,
# beyond TeX's largest dimension, so TikZ writes coordinates × 10^5 (tikz.ts); tex.yml compiles it
# and checks the Asymptote coordinates.
@version 1
@title "Export: a figure 0.001 wide"
A = (0, 0)
B = (0.001, 0)
C = (0.0003, 0.0008)
t = polygon(A, B, C)
w = circle(A, B, C)
M = midpoint(A, B)
H = orthocenter(A, B, C)
