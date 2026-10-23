#!/usr/bin/env bash
# Record actual pinned breaker tests using VHS, retaining independent exit evidence.
set -euo pipefail
export GOMAXPROCS=2 GOFLAGS='-p=2'
export VHS_NO_SANDBOX=true
mkdir -p .work/bin
ln -sf "${CHROME_PATH:-/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome}" .work/bin/chromium
export PATH="$PWD/.work/bin:$PATH"
command -v ffmpeg
command -v ttyd
vhs demo.tape
