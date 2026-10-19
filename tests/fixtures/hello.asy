// Smoke test for the Asymptote toolchain (tex.yml). The write() line is checked by
// tests/fixtures/compile-tex.sh, the same mechanism later runs use to compare
// Asymptote coordinates with the kernel (SPEC §14).
size(4cm);
pair A = (0, 0), B = (4, 0), C = (1, 3);
draw(A--B--C--cycle);
dot(A); dot(B); dot(C);
label("$A$", A, SW);
label("$B$", B, SE);
label("$C$", C, N);
write((A + B) / 2);
