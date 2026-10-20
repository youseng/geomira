# A derived layer: the layer "refl" holds the reflection in BC of every object of the main
# layer (A*, H*, ω*, …). The reflection H* of the orthocentre lies on the circumcircle, and
# the reflected circle ω* passes through H. The side BC is its own image: excluded.
@version 1
@title "Reflection of the orthocentre"
@layer refl = image(s, main) [opacity=0.6] [exclude=a]
A = (1, 4)
B = (-2, 0)
C = (5, 0)
a = line(B, C)
H = orthocenter(A, B, C)
ω = circumcircle(A, B, C)
s = reflect(a)
style A* [color=gray]
claim on(H*, ω) [name=reflected_orthocentre]
claim on(H, ω*)
