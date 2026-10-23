#!/usr/bin/env bash
# Stream-copy Remotion's render (H.264 video + AAC narration) and move the index to the front for web playback.
set -euo pipefail
mkdir -p .work
mv demo.mp4 .work/demo-remotion.mp4
ffmpeg -hide_banner -loglevel error -y -i .work/demo-remotion.mp4 -map 0:v:0 -map 0:a:0 -c copy -movflags +faststart demo.mp4
