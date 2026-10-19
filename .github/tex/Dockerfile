# TeX Live (latex base, pictures, extra) + Asymptote, for tex.yml.
# tex.yml tags the image with a hash of this file and pushes it to GHCR once, so later
# runs pull the cached image instead of reinstalling TeX Live.
FROM public.ecr.aws/docker/library/debian:trixie-slim

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        asymptote \
        ca-certificates \
        ghostscript \
        texlive-latex-base \
        texlive-latex-extra \
        texlive-pictures \
    && rm -rf /var/lib/apt/lists/*

RUN pdflatex --version | head -n 1 && asy -version 2>&1 | head -n 1
