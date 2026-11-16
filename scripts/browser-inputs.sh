#!/usr/bin/env bash
# Run from the repository root after installing the pinned browser dependencies.
set -euo pipefail

mkdir -p apps/web/playwright-report
{
  node --version
  pnpm --version
  pnpm --filter @geomira/web exec playwright --version
  python3 - <<'PY'
import hashlib
import json
import platform
import subprocess
from pathlib import Path

print(platform.platform())
for requested in ["system-ui", "sans-serif", "ui-monospace", "monospace", "DejaVu Sans Mono", "Latin Modern Roman", "Liberation Serif", "Liberation Serif:style=Italic"]:
    path = subprocess.check_output(["fc-match", "--format=%{file}", requested], text=True)
    face = subprocess.check_output(["fc-match", "--format=%{family}: %{style}", requested], text=True)
    print(json.dumps({"fontconfig_request": requested, "face": face, "file": path,
                      "sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest()}))
print("Bundled scene font sha256:", hashlib.sha256(Path("apps/web/e2e/fonts/LiberationSerif-Italic.ttf").read_bytes()).hexdigest())
PY
} | tee apps/web/playwright-report/environment.txt
