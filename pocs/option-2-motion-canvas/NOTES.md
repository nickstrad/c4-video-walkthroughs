# Option 2 POC — Motion Canvas

**Result: works end to end, unattended.** A 55.3 s, 1280×720, 30 fps H.264 MP4
with ElevenLabs narration (AAC mono) ([demo.mp4](demo.mp4), 1.5 MB), rendered by
Motion Canvas 3.17.2 through `@motion-canvas/ffmpeg`, driven by a script. No one
opened the editor by hand. The silent first cut was 26.6 s and 815 KB; see
[Narration pass (Opus)](#narration-pass-opus).

## What the video shows

One bounded read along litefleet's C4 dynamic view `query-flow` (dataset
`pages/public/architectures/litefleet.json` at book-notes `2047046`). It follows
the route-cache-hit path, then steps into the node hop (`sql-tenant`) and shows
the real `Engine.Query` code at `release-it/v1-hardened` (`9367863`).

| Time | Scene | Visual |
|---|---|---|
| 0–7.5 s | steps 1–2 | A request packet (`SELECT … + API key`) travels tenant → HAProxy → gateway; edges and boxes light up as it passes. |
| 7.5–13.2 s | step 3, cache hit | A `route cache: HIT` badge appears on the gateway. Control plane and registry dim: steps 3–5 are skipped. |
| 13.2–18.1 s | step 6 | The packet relabels to `SQL + X-Epoch` and moves to the node agent. |
| 18.1–24.6 s | into the code | The diagram shrinks to a top strip. The code panel opens on `exec.go` L130–149, with a state panel beside it. |
| 24.6–39.0 s | guards | The code highlights L134–136 (`isRead`), then L142–144 (`admit`, where the epoch state turns ✓), then L145–149 (`acquire`, where one of the two read lanes fills). |
| 39.0–43.5 s | rows | The code morphs to L194–217 and highlights the `rows.Next()` loop and `w.Write(row)`. The packet goes node ↔ SQLite file and the row counter climbs. |
| 43.5–50.5 s | caps | The code highlights L195–198 (`MaxRows`) and L206–209 (`MaxBytes`). Rows hit 1000 and `truncated` turns true. |
| 50.5–55.3 s | reply | The capped answer travels back through gateway and HAProxy to the tenant. |

Stills: [frames/01-cache-hit.png](frames/01-cache-hit.png),
[frames/02-epoch-check.png](frames/02-epoch-check.png),
[frames/03-row-caps.png](frames/03-row-caps.png).

The state panel's values (row count, truncated) illustrate what the code path
does. They are not recorded from a live request, and the panel says so on screen.
The code, line numbers, file, function and commit are real.

## Files

- `storyboard/query-flow.storyboard.json`: the AI-step output, written by hand
  for this POC. It holds element ids, the dataset diagram, step and relationship
  ids, snippet file, blob SHA, function, line ranges, per-scene highlight ranges,
  captions and durations.
- `scripts/extract.mjs`: the asset stage. It checks that the tag resolves to the
  pinned commit and that each file's blob SHA matches, runs `git show` for the
  exact line range, and writes `src/snippets.json`. Its only change to the code
  is expanding tabs to 4 spaces. The scene never contains hand-typed code.
- `src/scenes/queryFlow.tsx`: the Motion Canvas scene. It reads durations,
  captions and highlight ranges only from the storyboard, and code only from
  `snippets.json`. Go highlighting comes from `LezerHighlighter` + `@lezer/go`.
- `scripts/narrate.mjs` and `narration/`: the narration stage (see below).
- `scripts/render.mjs`: the unattended renderer. `scripts/frames.mjs`: pulls
  stills at storyboard-computed times.

Run it with `npm ci && node scripts/extract.mjs && npm run narrate && npm run render && npm run frames`
(Node 22.23.2; Playwright refuses the system Node 18). With the committed
narration files, `npm run narrate` makes no API call. Output goes to `output/project.mp4`, which is git-ignored; the
copy in `demo.mp4` is committed.

## How the unattended render was driven (the overview's flagged risk)

**It proved automatable with about 50 lines of script and no patches.** The
Motion Canvas editor UI checks `window.location.search` on load. If `?render`
is present, it calls `renderer.render(meta.getFullRenderingSettings())`. This
is in `@motion-canvas/ui/dist/main.js`; I found it by reading the bundle, since
it is not prominently documented. So `scripts/render.mjs`:

1. Starts Vite programmatically (`createServer` + `listen`) with the
   Motion Canvas and FFmpeg plugins.
2. Launches the existing Playwright Chromium headless
   (`~/.cache/ms-playwright/chromium-1248`, via `playwright-core` 1.62.0) and
   opens `/?render`.
3. Waits for `#render[data-rendering]` to appear and then clear. Then it waits
   until `output/project.mp4` stops growing, because the exporter finalizes the
   file on the server after the last frame.
4. Closes the browser and the server.

Render settings (1280×720, 30 fps, sRGB, exporter `@motion-canvas/ffmpeg`,
audio on since the narration pass) live in `src/project.meta`. I wrote that file by hand and the editor
accepted it; on load it only reformatted the JSON. There is no settings UI step.

Caveats:

- Rendering still goes through the *editor* page in a real browser. There is no
  headless Node renderer. The pipeline therefore needs Vite + Chromium, and
  frames are streamed from the page to the Vite server, which pipes them to
  ffmpeg.
- The browser logs one harmless error every run:
  `Connection timeout when updating metadata for virtual:settings`. The editor
  tries to persist UI settings, and the render is unaffected.
- When I piped the script's stdout through `grep`, two runs showed only the
  first log line. Both still produced a correct, updated MP4. Every run
  redirected to a file logged completely and exited 0. Redirect to a file in
  automation.
- Output was byte-identical across repeat renders of the same source
  (810,602 bytes ×3, then 815,300 bytes ×2 after a label change), which is
  useful for caching and CI.

## Render time and footprint

- 798 frames (26.6 s). The render phase took 74–117 s, and wall time
  including Vite startup and editor load was 92–132 s. The first, cold run took
  156 s while Vite pre-bundled dependencies. That is roughly 3.5–5× the video's
  length on a 4-vCPU / 8 GB box shared with other agents.
- The Node process peaked at ~265 MB RSS, plus one headless Chromium.
- `node_modules` is 303 MB.

## ffmpeg

The system has no ffmpeg, and that turned out not to matter.
`@motion-canvas/ffmpeg` depends on `@ffmpeg-installer/ffmpeg`, which ships a
static Linux x64 build. The exporter used it directly, and `scripts/frames.mjs`
reuses the same binary for stills. No workaround was needed.

## What worked

- The code component is the selling point and delivered. `code().selection(lines(a, b), t)`
  gives animated dim/undim of exact lines. `code().code(newText, t)` morphs one
  real snippet into another with a token-level diff. Multiple disjoint ranges
  highlight at once.
- Generator-based timing maps cleanly onto a storyboard. Each scene is
  `all(caption, waitFor(duration), ...animations)`, so swapping durations for
  ElevenLabs phrase timings changes data, not scene code.
- Signals made the state panel trivial (the row counter is a tweened signal).
- `@lezer/go` dropped straight into `LezerHighlighter`, not just JS/TS.

## What didn't, or needed care

- The plugins are CommonJS; under `"type": "module"` the default import is the
  module object, so `vite.config.ts` unwraps `.default`. Vite also prints a "CJS
  Node API deprecated" warning; it is harmless.
- `Code` has no line-number gutter. I used a second `Code` node with the same
  font and line height, and morphed it in step with the code.
- `lines()` returns a range tuple, so building multi-range selections needs
  `map`, not `flatMap`. TypeScript caught this.
- Long real Go lines (140 chars with tabs as 4 spaces) force 13 px mono at 720p
  to avoid clipping. That is legible but small. The full build should render at
  1080p or choose ranges with shorter lines.
- The top-strip diagram at 0.5 scale has tiny labels (~9 px). Use a real
  camera/zoom onto the active hop instead of a uniform shrink.
- Layout is hand-placed coordinates for seven nodes. Nothing here lays out an
  arbitrary C4 view.

## What the full build needs

1. **Layout from the dataset.** Generate node positions from the C4 JSON (ELK or
   the c4-sdk's own layout) instead of a hand-written `POS` table. Reusable
   scene components: `DiagramView`, `RequestPacket`, `CodePanel` (gutter +
   header + selection), `StatePanel`.
2. **The AI step emits the storyboard**, the JSON here, not TSX. The scene
   stays a generic interpreter of storyboard scene kinds (`follow-request`,
   `state-change`, `code-explanation`). Generating TSX per video, as the
   overview suggests, is possible but harder to validate. Validate against a
   schema plus the extractor's blob/line checks.
3. **Tree-sitter range selection** so storyboards name functions or statements
   rather than raw line numbers, with the extractor resolving and re-verifying
   them.
4. **Narration.** Done in this POC (see below) for durations and cue times.
   Still open: captions that follow the words instead of the scene, and
   pronunciation control (a lexicon instead of spelling "H-A-Proxy" out).
5. **Render harness.** Harden `render.mjs`: use a free port, give
   `project.meta` per output size (720p/1080p), set the output name per video,
   add a timeout and retry, and surface browser errors as failures. Consider a
   container with Chromium and fonts pinned, because the output depends on
   installed fonts (DejaVu here).
6. **Overview-length videos** need multi-scene projects (one Motion Canvas scene
   per storyboard section) and transitions, which this POC did not exercise.

## Narration pass (Opus)

**The narrated demo replaced `demo.mp4` in place**, rendered unattended through
the same `render.mjs` → `@motion-canvas/ffmpeg` path, with the audio muxed by
the exporter itself.

- **Voice and model:** ElevenLabs voice "Roger" (`CwhRBWXzGAHq8TQ4Fs17`; the
  env file's `ELEVENLABS_VOICE_ID` was blank), model `eleven_multilingual_v2`,
  `POST /v1/text-to-speech/{voice}/with-timestamps`, `mp3_44100_128`. Each
  request also sent the neighbouring lines as `previous_text`/`next_text` so the
  separately voiced lines keep continuous prosody.
- **Lines and characters:** 11 lines, one per storyboard scene, each voiced once
  (no re-takes): **780 characters** billed. The takes and their alignment JSON
  are committed as `narration/<scene>.mp3` and `narration/<scene>.alignment.json`
  (1.0 MB together). The script reads the API key from
  `/root/Software/.secrets/c4-video.env` at runtime, and only for scenes that
  have no take yet.
- **Text:** each storyboard scene now has `narration.text`, the spoken form of its
  `caption`. The on-screen captions are unchanged and caption the speech. Edits
  for speakability only, with no new claims:
  - `HAProxy` is spelled `H-A-Proxy` (s2, s11) so it is said as letters.
  - s3: "steps 3-5 (control plane, registry)" becomes "Steps three to five, the
    control plane and the registry, are skipped".
  - s4: "(X-Epoch)" becomes ", X-Epoch,".
  - s5: "Engine.Query, exec.go at release-it/v1-hardened" becomes "Engine dot
    Query, in exec dot go, at release-it v1 hardened".
  - s7, s8: the sentence-initial `admit`/`acquire` are capitalised.
  - s8: "(2 readers at once)" becomes ", two readers at once".
  - s10: "MaxRows (1000) or MaxBytes (1 MiB)" becomes "Max Rows, one thousand,
    or Max Bytes, one mebibyte".
- **Sync:** `scripts/narrate.mjs` turns the alignment into
  `narration/timeline.json`, which the scene now reads instead of storyboard
  durations:
  - *Scene duration* = max(storyboard duration, 0.2 s lead-in + end of the last
    spoken character + 0.4 s tail), rounded up to a whole frame. The last
    *spoken* character, not the last character: ElevenLabs gives the closing
    "." a 0.3–1.0 s span of trailing silence. `silencedetect` on the takes agreed
    with the last letter's end to ~10 ms. Syncing on the "." made a 63.2 s cut
    with ~1.5 s of dead air between lines.
  - *Cue times*: the storyboard names an anchor phrase per animation cue (e.g.
    `s7-epoch.cues.check = "current epoch"`). The cue fires at the lead-in plus
    the start of that phrase's first character. The scene wraps animations in
    `on(scene, cue, anim)` = `delay(cue, anim)`. The reply hops use `arrive`, so
    the packet *reaches* gateway, HAProxy and tenant as each is named. Stagings
    that are new against the silent cut: in s10, MaxRows lights first and the
    MaxBytes range joins when it is named. `truncated` flips on the word.
  - *Track*: each take is cut at its scene's end with a 20 ms fade and placed at
    scene start + 0.2 s in one mono 44.1 kHz `narration/track.wav`. The track is
    git-ignored and rebuilt by the script. It is padded 1 s past the last frame
    because the exporter muxes with `-shortest`. A guard fails the build if any
    10 ms window past a cut exceeds -40 dBFS, so no line can be cut off. The only
    energy the guard sees past the speech is a decoder click in each MP3's last
    ~30 ms, which the cut removes.
  - Wiring: `makeProject({audio})` imports the track, `project.meta` sets
    `includeAudio: true`, `audioOffset` stays 0.
- **Before/after:** 26.6 s, 815 KB, no audio → **55.27 s, 1,503,435 bytes**,
  H.264 1280×720 30 fps (1658 frames) + AAC 44.1 kHz mono.
- **Verification:** `ffprobe` shows the audio stream. Video is 55.267 s, which
  equals the timeline total, so no animation overran its scene. Audio is 55.286 s
  (one AAC frame longer). `ffmpeg -f null` decodes the whole file without errors.
  `silencedetect` on the final MP4 puts every line's end ~0.4 s before its scene
  cut and every start ~0.25 s after it. Stills were checked at each cue
  (`frames/` now samples just before each scene's cut, after all of its cues).
- **Render:** 112 s render phase, 121 s wall, ~280 MB peak RSS. That is faster
  than the silent cut per second of video, on a quieter box. The one cue that
  first overran (s9's row counter, by 40 ms) was shortened to fit.
- **Determinism:** I re-ran `npm run narrate` offline (no API call) and rendered again. The MP4 came out byte-identical (sha256 `fb80e3ce…`, 1,503,435 bytes), and that second render took 85 s wall.
