#!/usr/bin/env bash
set -euo pipefail

# Ubuntu's regional mirrors on GitHub runners can return 503 for every dependency.
# Prefer the signed Ubuntu Azure archive if reachable and retain the runner's fallbacks.
mirrors=/etc/apt/apt-mirrors.txt
azure=https://azure.archive.ubuntu.com/ubuntu
if [[ -f "$mirrors" ]] && ! grep -Fq "$azure" "$mirrors" &&
  curl -fsSL --connect-timeout 4 --max-time 10 -o /dev/null "$azure/dists/noble/InRelease"; then
  printf '\n%s\tpriority:0\n' "$azure" | sudo tee -a "$mirrors" >/dev/null
fi

pnpm --filter @geomira/web exec playwright install --with-deps "$@"
