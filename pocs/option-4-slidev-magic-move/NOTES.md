# Option 4: Slidev + Shiki Magic Move

A five-slide, 38.5-second litefleet walkthrough that proves one design lesson: a
timeout turns a hang into an error. The real C4 gateway render zooms to the node
client. One Shiki Magic Move then carries the real constructor through three pinned
commits (v0-flawed, lesson-02, v1-hardened), and the repository's recorded outage
figures close the argument. Speaker notes are the narration script. Burned-in
captions carry it on screen, because there is no ElevenLabs key and the MP4 is silent.
The current version is the Opus improvement pass described at the end of this file.

## Reproduce

```sh
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd pocs/option-4-slidev-magic-move
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
  hashes in `sources/manifest.json`. Every excerpt on screen is a pinned range.
- `slides.template.md` generates `slides.md`; the latter runs as an ordinary Slidev
  deck. Two clicks morph actual v0 code into actual lesson-02 code and then actual v1
  code through Shiki Magic Move. Callouts, captions, step chips and citations switch
  with Slidev's `$clicks`, so they add no clicks of their own.
- The recorder first builds a static Slidev deck and serves it locally through
  Vite preview. Playwright warms and screenshots every slide and click state, then
  records the timed schedule. FFmpeg trims browser navigation lead-in, emits
  H.264/yuv420p with faststart, and extracts seven PNG frames from the final MP4.
- C4 diagram bytes come from the provided diagram-site evidence; the companion
  JSON is included. CSS crops, zooms and rings the diagram; the image is unmodified.
- The outage figures on slide 4 are quoted, byte-identical, from the repository's
  `lessons/02-timeouts.md`. This POC does **not** run Docker/Toxiproxy; the slide
  says so on screen.

## Friction and limits

- The initial Slidev development-server launch rejected `--host` (it uses
  `--bind` for remote binding). The final recorder uses `vite preview --host
  localhost`, where `--host` is supported. This is a browser recording, not a deterministic frame renderer.
- Long real Go constructor lines require visual wrapping. The C4 zoom upsamples a
  1216-pixel render: component titles are readable, edge labels are not. A full
  build should render the selected subgraph at a higher resolution instead.
- There is no voice synthesis, voice timing measurement or audio mux proof here.
  Speaker notes are the complete script; captions are a condensed version of it.
- The scene timings fit the captions, not the full speaker notes. Read aloud, the
  notes need roughly twice as long; voice clips should drive the schedule.

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

## Original POC validation (Sol, superseded by the improvement pass)

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
  A second fresh Opus review of the final recording/fixup commit `6cf86df`
  returned **PASS**. Reports, responses and machine-readable output are under
  `evidence/`.


Playwright installation note: on a shared host set `PLAYWRIGHT_SKIP_BROWSER_GC=1`
when installing browsers. The first helper install unexpectedly garbage-collected
another version's shared Chromium; those Chromium 1248 and FFmpeg 1013 assets were
restored with Playwright 1.64.1 and cleanup disabled. Playwright 1.61.1 also needs
its own FFmpeg 1011 video helper even when a system encoder is installed.

Slidev 53's installed Twoslash/FloatingVue combination logs a caught
`Failed to patch FloatingVue ... Popper` error during startup; code highlighting,
Magic Move and slide navigation still work. No Twoslash tooltips are used in this
deck. Console diagnostics are retained in `evidence/render.json`; the local
server startup log is `evidence/slidev.log` and the static build log is `evidence/build.log`. The recorder also
avoids `?print=false`: Slidev treats the presence of `print` as print mode regardless
of its value. It waits for visible headings rather than hidden preloaded slides. After repeat
development-server captures hit transient async-module failures and network-idle
timeouts, the final pipeline switched to a static build and Vite preview. This
also makes the exported deck independently hostable; dist/ stays untracked.

## Improvement pass (Opus)

Nick judged Sol's demo weak. This pass rebuilt the story and the deck within the
same toolchain (Slidev 53 + Shiki Magic Move, Playwright recording, FFmpeg).

| | Before (Sol) | After (Opus) |
|---|---|---|
| Duration | 28.000 s | 38.467 s |
| Size | 1,212,927 bytes | 2,104,574 bytes |
| Slides / clicks | 6 slides, 1 click | 5 slides, 3 clicks |
| Magic Move | v0 → v1, at 16 s of 28 | v0 → lesson-02 → v1, 11.5–27.5 s |
| Frames | 3 | 7, extracted from the new MP4 |

Both videos: 1280×720, H.264, yuv420p, 30 fps, no audio stream.

**Kept.** The toolchain and its proven mechanics: the git-pinned extractor with tag
drift checks, the template → `slides.md` generation, the static build + Vite
preview recorder, the warm-up pass, the tail trim, the clipping checks and the
independent provenance check. Also kept: the subject (litefleet's node client
deadline), the v0 and v1 `New` excerpts, the `cmd/gateway/main.go` wiring excerpt,
the real C4 render and the dark theme palette.

**Thrown away, and why.**

- *The code-first opening.* Sol's slide 1 showed the flawed code with the title
  "Put a deadline on waiting". It named a fix, not the lesson. The new opener states
  the payoff, "A timeout turns a hang into an error", with no code.
- *The standalone hardened slide (old 3).* It showed the v1 constructor before the
  morph had earned it, which spoiled the centerpiece. Its content is now the morph's
  final state.
- *The transport slide (old 5) and the `httpx.NewClient` excerpt.* It added a dense
  eight-line block for four seconds without changing the argument.
- *The acceptance-check slide (old 6) and the `02-timeouts.sh` excerpt.* It showed
  thresholds, not results, and had to apologise for that on screen. The same
  repository records actual before/after numbers for this lesson in
  `lessons/02-timeouts.md`; those quoted results now carry the evidence beat.
- *The full-width static diagram crop.* Its labels were unreadable at 720p. The
  render now opens wide, then zooms to the handler → node client → node agent path
  with rings on those three boxes.
- *Small green captions that sat in the content area.* They are now an opaque
  bottom caption band in 23 px bold white, on every slide.

**Added.**

- *A three-state Magic Move.* `lesson-02` (`8e71627`) is the commit where the
  constructor gained its deadlines, and v1 later added bounded read retries. Going
  v0 → lesson-02 → v1 separates the timeout lesson from the retry policy. The
  recorded outage figures also compare exactly that first step. Each state has its
  own callout (the flaw; what changed and why it matters; then bounded retries),
  caption, step chip and citation.
- *Pacing from the recorded timings.* Sol's render showed a 0.23 s worst click delay
  and 1.0 s nominal morphs that settled later. The new schedule has a 4 s beat on the
  flaw, a 1.2 s morph plus about 3.7 s on the deadlines, and a morph plus about 4.5 s
  on the hardened code. In this run the worst click delay was 0.21 s. The C4 zoom
  gets 4 s after it lands, the evidence slide 7 s, and the end card 4 s. Dead air was
  cut by dropping the redundant hardened slide and the two filler slides.
- *Consistent title treatment.* Every content slide uses a `n / 3` eyebrow and a 40 px
  heading. The opener and end card share a larger centred style.
- *An end card* with the project name, the takeaway, the three source commits and
  the silent-video note.
- *Stronger recorder checks.* The recorder screenshots all eight slide/click states.
  It asserts token bounds and callout clearance in every code state, checks each of
  the three code texts in the live recording, and requires active animations in both
  morphs (70 and 136 observed).

**Fidelity.** `npm run sources` regenerated all six excerpts from git;
`evidence/provenance-check.txt` passes for every range, hash and deck occurrence,
and for the byte-identical C4 PNG. The outage figures are quoted lines, not
reformatted, and the slide says what they measure: `lesson-01` vs `lesson-02`, the
whole timeout patch, not re-run here. `lesson-01`'s `New` is byte-identical to
v0's. The 2.5 s figure is described as per attempt. Speaker notes were rewritten to
match the new order and timings. The scene times in three notes were corrected
after the recording to the recorder's schedule. Notes are not rendered in the
video, so the MP4 is unaffected.

**Run.** Static build 14.4 s; complete build, warm-up, recording, encode and frame
extraction 107.6 s on the shared VM (one run). Worst click delay 0.21 s. Full
`ffmpeg -f null` decode of `demo.mp4`: 1154 frames, no errors. All seven frames in
`frames/` and all eight state screenshots in `evidence/` were inspected visually.
The `evidence/review*.md` and `evidence/final-review*` files are Sol's reviews of
the original deck. No independent review of this pass was run.
