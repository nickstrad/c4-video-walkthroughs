#!/usr/bin/env bash
# Extract final-output evidence from the finished MP4 (not independently generated slides),
# at moments chosen from storyboard.json: one per card/act at its most informative point.
set -euo pipefail
node -e '
const s=require("./storyboard.json"),at=(id,k)=>{const x=s.scenes.find(y=>y.id===id);return ((x.from+x.duration*k)/s.fps).toFixed(3);};
console.log(["title",at("title",0.8)].join(" "));console.log(["architecture",at("where",0.9)].join(" "));
console.log(["code",at("how-guard",0.85)].join(" "));console.log(["terminal",at("proof-terminal",0.8)].join(" "));console.log(["end",at("end",0.8)].join(" "));' |
while read -r name second; do
  ffmpeg -nostdin -hide_banner -loglevel error -y -ss "$second" -i demo.mp4 -frames:v 1 -threads 2 "frames/$name.png"
done
