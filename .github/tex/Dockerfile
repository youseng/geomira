# TeX Live (latex base, pictures, extra) + Asymptote + Node 22 (with corepack for pnpm), for
# tex.yml. tex.yml tags the image with a hash of this file and pushes it to GHCR once, so later
# runs pull the cached image instead of reinstalling TeX Live. Node runs the export job
# (scripts/export-tex.ts: it writes the exports, compiles them and checks the coordinates).
# Base images come through mirror.gcr.io (Docker Hub's official images): public.ecr.aws
# refused a pull with 429 "data limit exceeded" in Run 9a.
FROM mirror.gcr.io/library/node:22-trixie-slim AS node

FROM mirror.gcr.io/library/debian:trixie-slim

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        asymptote \
        ca-certificates \
        ghostscript \
        texlive-latex-base \
        texlive-latex-extra \
        texlive-pictures \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/ /usr/local/
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

RUN pdflatex --version | head -n 1 && asy -version 2>&1 | head -n 1 && node --version
