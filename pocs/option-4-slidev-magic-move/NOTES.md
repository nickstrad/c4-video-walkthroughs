# Option 4: Slidev + Shiki Magic Move

A six-slide litefleet walkthrough, with real code moving from the flawed client
constructor to the hardened constructor. The C4 gateway component image connects
architecture to source. Speaker notes contain the narration; captions and timings
stand in for ElevenLabs. The MP4 is intentionally silent.

## Reproduce

```sh
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd /root/Software/c4video-work/option-4/pocs/option-4-slidev-magic-move
npm ci --no-audit --no-fund
npm run sources
python3 evidence/provenance-check.py
npm run record
```

Prerequisites: Node 22.23.2, FFmpeg + ffprobe, and Playwright Chromium. For a fresh
host, `PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install --with-deps chromium`; on this host the recorder can
reuse the existing headless Chromium. `CHROMIUM_PATH` explicitly overrides its
path. `SOURCE_REPO` can point the extractor at another book-notes clone containing
the pinned tags. `FFMPEG` can override the encoder command (ffprobe remains on PATH).

`npm run dev` serves the deck locally on port 4314. Stop any existing instance
before recording: the recorder owns its Slidev process. No public hosting,
external narration API, or repository upload is involved.

## What is proved

- Source extraction records full commits, paths, functions, line ranges and SHA-256
  hashes in `sources/manifest.json`. Every slide contains a real pinned excerpt.
- `slides.template.md` generates `slides.md`; the latter runs as an ordinary Slidev
  deck. One click morphs actual v0 code into actual v1 code through Shiki Magic Move.
- The recorder first builds a static Slidev deck and serves it locally through
  Vite preview. Playwright advances all six slides and the extra animation click. FFmpeg trims browser navigation lead-in, emits H.264/yuv420p with faststart,
  and extracts three PNG frames from the final MP4.
- C4 diagram bytes come from the provided diagram-site evidence; the companion
  JSON is included. CSS crops empty canvas around the diagram; the image is unmodified.
- The fault-injection checks shown at the end are repository source. This POC
  does **not** run Docker/Toxiproxy or claim a successful reliability experiment.

## Friction and limits

- Slidev 53 uses `--bind` for remote binding and does not accept `--host`; the initial
  launch failed with `Unknown argument: host`. The corrected launch uses its default
  local host. This is a browser recording, not a deterministic frame renderer.
- Long real Go constructor lines require visual wrapping. Detailed C4 labels are
  small at 720p; a full technical video should zoom or render a selected component
  subgraph instead of trying to read every edge in a wide diagram.
- There is no voice synthesis, voice timing measurement or audio mux proof here.
  Speaker notes are the complete script. The final caption labels the narration stub.
- The fixed timings are a compressed visual demonstration. The full speaker script
  needs a slower recording or a longer video once voice is supplied.

## Cost of another project

With the theme and recording scripts reused, emitting a deck from an already
verified storyboard should take seconds; choosing a defensible story, mapping
components and checking code still needs review. An engineering estimate is
20–45 minutes per small project after those inputs exist, not a measured automated
throughput claim. Cold dependency installation took about two minutes on this shared
host; subsequent renders avoid that cost.

## Full build needs

A schema for source-backed storyboards; automated C4-to-symbol mapping and extraction;
reusable diagram zoom/layout templates; actual voice clips with phrase timestamps;
a timing file shared by narration and browser actions; subtitle export and audio mux;
explicit fonts/browser/encoder versions; and checks for missing assets, overflow,
incorrect claims and source drift. The current fixed scene schedule is encoded in
`storyboard.md` and `scripts/record.mjs`.

Slidev syntax follows its official [Magic Move documentation](https://sli.dev/features/shiki-magic-move)
and [speaker-note syntax](https://sli.dev/guide/syntax#notes).

## Final validation and measured render time

- Final `demo.mp4`: **28.000 seconds**, **1280×720**, H.264/yuv420p,
  30 fps output, **1,212,927 bytes** (about 1.21 MB). Silent by design.
- Complete static-build / warm-up / recording / encoding / still-extraction run:
  **87.1 seconds** on the shared 8 GB VM. Static build: **21.1 seconds**.
  This is one measured run, not a throughput benchmark.
- Before/after code text and **114 active token animations** were checked in the
  browser. All settled hardened token bounds fit within the slide. No uncaught
  page errors; the documented caught FloatingVue console error remains.
- All six slide screenshots, the settled animation screenshot, and the final
  MP4's architecture/motion/hardened frames were opened and visually inspected.
  The long animated line now wraps within its code panel, with no clipped tokens.
- `frames/01-architecture.png` is taken at 6 s; `02-magic-move.png` at 17.6 s;
  `03-hardened.png` at 18.6 s. These are extracted from the delivered MP4.
- `evidence/render.json` includes actual click times, browser build, console
  diagnostics and complete ffprobe metadata. The largest observed click delay
  was about 0.23 s on the shared host. Browser recording is timing-driven and can
  drift with CPU load, unlike deterministic frame rendering.
- Source provenance verification passes for all five ranges, hashes, deck code,
  and the unchanged architecture PNG. `npm run sources` also generates screen
  citations and rejects source-tag drift.
- Independent Claude Opus implementation review: **NITS**, no material bugs.
  Responses and the original review are under `evidence/`.


Playwright installation note: on a shared host set `PLAYWRIGHT_SKIP_BROWSER_GC=1`
when installing browsers. The first helper install unexpectedly garbage-collected
another version's shared Chromium; those Chromium 1248 and FFmpeg 1013 assets were
restored with Playwright 1.64.1 and cleanup disabled. Playwright 1.61.1 also needs
its own FFmpeg 1011 video helper even when a system encoder is installed.

Slidev 53's installed Twoslash/FloatingVue combination logs a caught
`Failed to patch FloatingVue ... Popper` error during startup; code highlighting,
Magic Move and slide navigation still work. No Twoslash tooltips are used in this
deck. Final console diagnostics are retained in `evidence/render.json`; the local
server startup log is `evidence/slidev.log` and the static build log is `evidence/build.log`. The recorder also
avoids `?print=false`: Slidev treats the presence of `print` as print mode regardless
of its value. It waits for visible headings rather than hidden preloaded slides. After repeat
development-server captures hit transient async-module failures and network-idle
timeouts, the final pipeline switched to a static build and Vite preview. This
also makes the exported deck independently hostable; dist/ stays untracked.
