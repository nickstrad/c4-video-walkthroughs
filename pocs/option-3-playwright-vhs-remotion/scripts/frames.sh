#!/usr/bin/env bash
# Extract final-output evidence rather than independently generated slides.
set -euo pipefail
for pair in '2 architecture' '19 code' '30 terminal'; do
  read -r second name <<< "$pair"
  ffmpeg -hide_banner -loglevel error -y -ss "$second" -i demo.mp4 -frames:v 1 -threads 2 "frames/$name.png"
done
