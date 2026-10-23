# Reusable script index

Run from this POC root; see [NOTES.md](../NOTES.md) for prerequisite versions and order.

| Script | Purpose |
|---|---|
| [prepare.mjs](../scripts/prepare.mjs) | Copy real site (adapting its catalog only if Litefleet is missing), export pinned project, extract the storyboard's exact excerpts and provenance. |
| [site-manifest.mjs](../scripts/site-manifest.mjs) | Hash the locally adapted site bundle used in the capture. |
| [serve.mjs](../scripts/serve.mjs) | Read-only static server bound to loopback, supporting production base path. |
| [capture.mjs](../scripts/capture.mjs) | Drill the real C4 site to the breaker, inspect it and zoom the live canvas, with a timed action log, video and route/inspector/page-error checks. |
| [record-terminal.sh](../scripts/record-terminal.sh) | Run VHS tape against the pinned project export. |
| [normalize.mjs](../scripts/normalize.mjs) | Cut the browser clip to its action windows (1x) and write measured scene timings back into the storyboard. |
| [narrate.mjs](../scripts/narrate.mjs) | Synthesise each storyboard caption's `spoken` text once with ElevenLabs with-timestamps; skips lines already in `narration/`. Needs `ELEVENLABS_API_KEY` in the environment. |
| [retime.mjs](../scripts/retime.mjs) | Time captions, cue-tied highlight steps and scene lengths from the narration alignment; extend the last browser cut into real footage, then hold. |
| [finalize.sh](../scripts/finalize.sh) | Stream-copy the render (video + narration AAC) with the index moved to the front. |
| [frames.sh](../scripts/frames.sh) | Extract five stills (title, three acts, end) from the finished MP4 at storyboard-derived times. |
| [verify.mjs](../scripts/verify.mjs) | Check byte-identical excerpts, C4 IDs, storyboard timeline/cuts, 1x terminal, narration alignment/text match and line spacing, audio stream and duration, per-line loudness, format, hashes, size and whole-file decode. |
