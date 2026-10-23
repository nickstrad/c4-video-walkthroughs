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
| [finalize.sh](../scripts/finalize.sh) | Remove silent AAC through a stream-copy remux. |
| [frames.sh](../scripts/frames.sh) | Extract five stills (title, three acts, end) from the finished MP4 at storyboard-derived times. |
| [verify.mjs](../scripts/verify.mjs) | Check byte-identical excerpts, C4 IDs, storyboard timeline/cuts, 1x terminal, format, hashes, size and whole-video decode. |
