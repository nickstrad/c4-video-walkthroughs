# Reusable script index

Run from this POC root; see [NOTES.md](../NOTES.md) for prerequisite versions and order.

| Script | Purpose |
|---|---|
| [prepare.mjs](../scripts/prepare.mjs) | Copy real site, adapt local catalog, export pinned project, extract exact code and provenance. |
| [site-manifest.mjs](../scripts/site-manifest.mjs) | Hash the locally adapted site bundle used in the capture. |
| [serve.mjs](../scripts/serve.mjs) | Read-only static server bound to loopback, supporting production base path. |
| [capture.mjs](../scripts/capture.mjs) | Select dataset and navigate real C4 drill-down with Playwright video and page-error checks. |
| [record-terminal.sh](../scripts/record-terminal.sh) | Run VHS tape against the pinned project export. |
| [normalize.mjs](../scripts/normalize.mjs) | Convert browser clip and retime real terminal capture, recording measured timing. |
| [finalize.sh](../scripts/finalize.sh) | Remove silent AAC through a stream-copy remux. |
| [frames.sh](../scripts/frames.sh) | Extract three stills from the finished MP4. |
| [verify.mjs](../scripts/verify.mjs) | Check pinned sources, C4 IDs, timeline, format, hashes, size and whole-video decode. |
