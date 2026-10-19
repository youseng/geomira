#!/bin/sh
# Compiles the TeX and Asymptote smoke fixtures; run from the repository root (tex.yml).
set -eu

fixtures="$(pwd)/tests/fixtures"
out="$fixtures/out"
rm -rf "$out"
mkdir -p "$out"

pdflatex -interaction=nonstopmode -halt-on-error -output-directory "$out" \
  "$fixtures/hello-tikz.tex"
test -s "$out/hello-tikz.pdf"

cd "$out"
asy -f pdf -o hello "$fixtures/hello.asy" > asy-stdout.txt
cat asy-stdout.txt
test -s hello.pdf
if ! grep -qx '(2,0)' asy-stdout.txt; then
  echo "hello.asy: expected write() output (2,0)" >&2
  exit 1
fi
echo "TeX and Asymptote fixtures compiled."
