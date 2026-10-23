# Option 2 POC — Motion Canvas

**Result: works end to end, unattended.** A 26.6 s, 1280×720, 30 fps H.264 MP4
([demo.mp4](demo.mp4), 815 KB) rendered by Motion Canvas 3.17.2 through
`@motion-canvas/ffmpeg`, driven by a script. No one opened the editor by hand.

## What the video shows

One bounded read along litefleet's C4 dynamic view `query-flow` (dataset
`pages/public/architectures/litefleet.json` at book-notes `2047046`). It follows
the route-cache-hit path, then steps into the node hop (`sql-tenant`) and shows
the real `Engine.Query` code at `release-it/v1-hardened` (`9367863`).

| Time | Scene | Visual |
|---|---|---|
| 0–4.8 s | steps 1–2 | A request packet (`SELECT … + API key`) travels tenant → HAProxy → gateway; edges and boxes light up as it passes. |
| 4.8–7.4 s | step 3, cache hit | A `route cache: HIT` badge appears on the gateway. Control plane and registry dim: steps 3–5 are skipped. |
| 7.4–9.8 s | step 6 | The packet relabels to `SQL + X-Epoch` and moves to the node agent. |
| 9.8–11.2 s | into the code | The diagram shrinks to a top strip. The code panel opens on `exec.go` L130–149, with a state panel beside it. |
| 11.2–18.2 s | guards | The code highlights L134–136 (`isRead`), then L142–144 (`admit`, where the epoch state turns ✓), then L145–149 (`acquire`, where one of the two read lanes fills). |
| 18.2–20.8 s | rows | The code morphs to L194–217 and highlights the `rows.Next()` loop and `w.Write(row)`. The packet goes node ↔ SQLite file and the row counter climbs. |
| 20.8–23.6 s | caps | The code highlights L195–198 (`MaxRows`) and L206–209 (`MaxBytes`). Rows hit 1000 and `truncated` turns true. |
| 23.6–26.6 s | reply | The capped answer travels back through gateway and HAProxy to the tenant. |

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
- `scripts/render.mjs`: the unattended renderer. `scripts/frames.mjs`: pulls
  stills at storyboard-computed times.

Run it with `npm ci && node scripts/extract.mjs && npm run render && npm run frames`
(Node 22.23.2). Output goes to `output/project.mp4`, which is git-ignored; the
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
audio off) live in `src/project.meta`. I wrote that file by hand and the editor
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
4. **Narration.** Add ElevenLabs audio to the project (`audio` in
   `makeProject`), set `includeAudio: true`, and derive scene durations and
   intra-scene cue times from character/word timing. Captions can then follow
   the words instead of the scene.
5. **Render harness.** Harden `render.mjs`: use a free port, give
   `project.meta` per output size (720p/1080p), set the output name per video,
   add a timeout and retry, and surface browser errors as failures. Consider a
   container with Chromium and fonts pinned, because the output depends on
   installed fonts (DejaVu here).
6. **Overview-length videos** need multi-scene projects (one Motion Canvas scene
   per storyboard section) and transitions, which this POC did not exercise.
