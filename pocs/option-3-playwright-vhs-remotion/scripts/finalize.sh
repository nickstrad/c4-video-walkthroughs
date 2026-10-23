#!/usr/bin/env bash
# Remove Remotion's silent AAC track without re-encoding rendered video.
set -euo pipefail
mkdir -p .work
mv demo.mp4 .work/demo-remotion.mp4
ffmpeg -hide_banner -loglevel error -y -i .work/demo-remotion.mp4 -map 0:v:0 -c:v copy -an -movflags +faststart demo.mp4
