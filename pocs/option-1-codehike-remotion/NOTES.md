# POC — Option 1: Code Hike + Remotion

**Result: working end to end.** A 47-second, 1280×720 MP4 shows Option 1's
signature visual. It opens on the real Litefleet C4 view, lights up one
component, moves the camera into it, then cuts to the real implementing
function with animated line focus and a caption track. It is narrated by
ElevenLabs TTS; see [Narration pass (Opus)](#narration-pass-opus). The
sections before that one describe the original silent 25-second build.

- Demo video: [`demo/walkthrough.mp4`](demo/walkthrough.mp4), 2.94 MB
  (2,941,777 bytes), H.264 + AAC, 47.33 s, 30 fps.
- Stills (PNG, 1280×720):
  [overview](frames/01-overview.png) ·
  [focus + zoom](frames/02-focus-zoom.png) ·
  [code, wait step](frames/03-code-wait.png) ·
  [code, node-slot step](frames/04-code-node.png)
- Storyboard: [`storyboard.json`](storyboard.json)

## What the video shows

| Time | Scene | Content |
|---|---|---|
| 0–5 s | architecture overview | The `node-components` view: 10 elements and 11 numbered relationships, the title and the snapshot `release-it/v1-hardened · 9367863`. |
| 5–9 s | focus element | **Admission + SQL engine** (`nd-engine`) fills with the accent colour and pulses. Its two relationships (1, 5) turn orange and everything else dims. The camera then zooms in on the component. |
| 9–25 s | code explanation | `func (e *Engine) acquire`, `internal/engine/admission.go` L67–113 at `936786399d7b…`, with real file line numbers. Five storyboard steps light their line ranges in turn, dim the rest and scroll the pane. A step rail lists the beats: lane pick → wait queue ≤ 8 / 429 → tenant slot (4) → node slot (16) / 503 → release func. |

Captions run under every scene. Each caption is a narration line from the
storyboard, and every claim was checked against the code and the dataset:
`waitingPerDB = 8`, `statementsTenant = 4`, `NodeStatements = 16`, and
`nodeWait = 250ms`, which bounds both slot waits. One caption first said
"ten responsibilities" because I counted the view's elements. The dataset's
explanation says six (the components inside the node), so I corrected it and
re-rendered. That slip is the kind of error the full build's fact check has
to catch (see below).

## Provenance (the non-negotiable requirement)

| Item | Value |
|---|---|
| Dataset | `nickstrad/book-notes` `pages/public/architectures/litefleet.json` @ `20470465f6a4f9541d1bf59d62727806c55bb4f6`, view `node-components` |
| Element | `nd-engine` "Admission + SQL engine"; source selector `src-37` ("func (e *Engine) acquire; line 67") |
| Code | `books/release-it/project/internal/engine/admission.go` lines 67–113, `func (e *Engine) acquire` |
| Commit | `936786399d7bab3ebbfa845b9a07df02b41ed363` = tag `release-it/v1-hardened` |

`scripts/extract.mjs` reads both files with `git show <sha>:<path>` from the
book-notes repo; it never reads the working tree. It fails unless all of these
hold:

- the element is in the view;
- the element's source selector names the same path and revision;
- the selector's line matches the storyboard's start line;
- the tag resolves to the storyboard's SHA;
- line 67 starts with the signature and line 113 closes the function;
- every step range falls inside the function.

The video therefore cannot show code that does not exist at that commit.

## How it is built

```
storyboard.json ──► scripts/extract.mjs ──► data/view.json, data/code.json   (git objects)
                    scripts/layout.mjs  ──► data/layout.json                  (elkjs)
                    scripts/highlight.mjs ► data/highlighted.json             (Code Hike)
                    src/ (Remotion)     ──► demo/walkthrough.mp4, frames/*.png
```

- **Diagram.** The view is drawn in React from the dataset JSON and laid out
  with elkjs (layered, left to right, orthogonal edges; the dataset's own
  layout hint is `auto`/`LR`). It is not a screenshot, so any element can be
  highlighted and the camera can target its exact box. The result matches the
  live diagram site's ELK-style layout closely; I compared it with
  `book-notes/docs/diagram-site/evidence/item-2/screenshots/litefleet-node-components-1600-overview.png`.
  The camera is a CSS transform: scale is interpolated in log space and the
  centre moves to the focus box, with cubic easing.
- **Code.** This uses **Code Hike 1.1.0** (`codehike/code`), not a Code
  Hike-style imitation:
  - `highlight()` produces the tokens with the `github-dark` theme and Go
    grammar.
  - Each storyboard step is added as a Code Hike block annotation (`focus`,
    query = step id).
  - `<Pre>` renders with two custom `AnnotationHandler`s. A `Block` handler
    paints the active step. A `Line` handler draws real file line numbers and
    dims lines outside the step.
  - Frame-driven weights come from `useCurrentFrame()` through React context.
- **Captions.** Cues come from the storyboard timings (`src/storyboard.ts`
  `cues`). They are the single place a TTS alignment would plug in.

Run it:

```
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
npm ci
npm run assets        # extract (needs /root/Software/book-notes or BOOK_NOTES=…), layout, highlight
npm run render        # → demo/walkthrough.mp4, --concurrency=2
npm run stills        # → frames/*.png
npm run studio        # interactive preview
```

## Render cost (this droplet: 4 vCPU, 8 GB RAM, shared with other agents)

| Step | Time |
|---|---|
| `npm install` (Remotion 4.0.538, Code Hike, React 19, elkjs) | 75 s |
| First `remotion still`, including the one-off Chrome Headless Shell download | 3 min 23 s |
| Full render, 750 frames, `--concurrency=2`, including webpack bundling | 76 s, 95 s and 122 s on three runs (load from other agents varied) |
| Each later still | 30–45 s, mostly re-bundling |
| Four stills via `npm run stills` | about 66 s |

The largest single process peaked at about 650 MB RSS during the render
(`/usr/bin/time` max RSS).

`node_modules` is 866 MB, including the Chrome Headless Shell under
`node_modules/.remotion`. It is gitignored. No system ffmpeg is needed: Remotion
ships its own, and `npx remotion ffmpeg` / `npx remotion ffprobe` were used to
verify the MP4.

Committed artefact sizes:

| Artefact | Size |
|---|---|
| `demo/walkthrough.mp4` | 827,562 B |
| `frames/01-overview.png` | 146,999 B |
| `frames/02-focus-zoom.png` | 147,989 B |
| `frames/03-code-wait.png` | 145,118 B |
| `frames/04-code-node.png` | 145,132 B |
| `data/*.json` | 21 kB in total |

## What worked

- Code Hike's `highlight` + `Pre` + annotation handlers drop straight into
  Remotion. Driving annotation styling from `useCurrentFrame()` through
  context is clean, and the handlers become a reusable "code explanation"
  scene type that any storyboard can populate.
- Remotion rendered unattended from the CLI with no system dependencies
  beyond Node, and the output is tiny: 25 s at 720p is about 0.8 MB.
- Rendering the C4 view from the dataset JSON rather than a screenshot gives
  exact element coordinates for highlighting and camera moves. It also keeps
  the diagram re-renderable when the dataset changes.
- Making the storyboard the single source of truth worked well. Timings,
  captions, step ranges, rail labels and stills times all derive from
  `storyboard.json`, and the extractor validates it against git.

## What didn't, or needed a workaround

- **Code Hike fetches over the network in the browser bundle.** The first
  render logged `Code Hike warning: Fetching resource from network
  "themes/github-dark"`; the browser build of `@code-hike/lighter` fetches
  themes from `lighter.codehike.org`. Highlighting moved to a Node script
  (`scripts/highlight.mjs`), where the theme and grammar load from
  `node_modules`, so renders are now offline and deterministic. Calling
  `highlight()` in `calculateMetadata`, as in Code Hike's Remotion example,
  would depend on that site at render time.
- **Code Hike token transitions were not used.** The code does not change
  between steps; only the focus moves. Token transitions
  (`codehike/utils/token-transitions`) matter for "before/after" diffs, which
  this POC did not exercise.
- **Long functions need scrolling.** A 47-line function does not fit a 720p
  pane at a readable 15 px, so the pane scrolls to centre each step. The
  signature line (82 characters) set the minimum pane width.
- **Dense diagrams.** At full-view scale the edge labels are small: about
  7 px effective size at 720p. That is acceptable for an establishing shot
  that the camera immediately leaves, but a 1080p render or a simplified
  overview would read better.
- **Remotion CLI stills re-bundle every time,** at about 30 s each. For many
  stills, use `@remotion/renderer` `bundle()` once and then `renderStill()`.
- **Remotion licence.** Remotion is free for individuals and small companies;
  larger companies need a company licence. Check before productising.

## What the full build needs

1. **ElevenLabs API key**, plus a TTS step that synthesises each storyboard
   narration line with the timestamps endpoint, which returns per-character
   start and end times. Convert them to phrase cues and replace the `cues`
   array in `src/storyboard.ts`. Derive scene and step `duration` from the
   audio, not hand-set seconds, and add an `<Audio>` track per scene. Nothing
   else in the scene components changes: they already read every timing from
   the storyboard.
2. **Anchor words for highlight timing.** Highlights should land on a phrase
   such as "the ninth gets 429", not on the start of the step. Each step
   needs an optional anchor phrase, and its focus `from` time should be taken
   from the alignment.
3. **AI mapping step (Claude Agent SDK).** It should emit this
   `storyboard.json` shape, choosing the view, element and function and
   writing the narration. Tree-sitter should replace the hand-set
   `lines: [67, 113]` with a range resolved from the source selector's symbol.
4. **Automated fact check of the narration** against code constants and the
   dataset explanation. The "ten/six responsibilities" slip shows that a
   human-plausible claim can be wrong while all the code anchors are right.
5. **More scene types**: "follow a request" (animate a dynamic view such as
   `query-flow`), "test evidence", and a transition from a container view down
   to a component view.
6. **Rendering through `@remotion/renderer`** (`bundle` once, then
   `renderMedia`/`renderStill`) for unattended batch runs, plus the
   YouTube-upload step.

## Narration pass (Opus)

Real narration replaced the caption-only stub, which covers items 1 and 2 of
"What the full build needs".

- **Voice and model.** ElevenLabs voice "Roger" (`CwhRBWXzGAHq8TQ4Fs17`, the
  default because `ELEVENLABS_VOICE_ID` is blank) and `eleven_multilingual_v2`.
  Endpoint: `POST /v1/text-to-speech/{voice}/with-timestamps`, output
  `mp3_44100_128`.
- **Lines and calls.** The 7 storyboard narration lines were sent as 3 takes,
  one per scene: overview (1 line), focus (1 line) and code (the 5 step lines
  stitched with spaces into one take, so the delivery flows from step to step).
  **617 characters** in total (107 + 70 + 440). Each take was generated once.
- **Committed takes.** `narration/<scene>.mp3` plus `narration/<scene>.json`
  (text, voice, model, character count, and the raw `alignment` and
  `normalized_alignment`). Remotion's public dir is `narration/`
  (`remotion.config.ts`), so the render needs no API access.
  `scripts/narrate.mjs` synthesises only missing takes. It refuses to retime if
  the storyboard text no longer matches a take's text, which means a stale take
  can't be reused by accident.
- **Speakability edits.** Captions are unchanged. Three code lines gained a
  `speech` field, and only that field is sent to TTS:
  - `429 tenant_busy` is spoken as "four-twenty-nine, tenant busy";
  - `503 node_busy` is spoken as "five-oh-three, node busy";
  - `250 ms` is spoken as "250 millisecond".

  No claim changed. The constants are the same ones checked against the code
  (`waitingPerDB = 8`, `statementsTenant = 4`, `NodeStatements = 16`,
  `nodeWait = 250ms`, the `tenant_busy`/`node_busy` errors).
- **How sync works.** `node scripts/narrate.mjs` (`npm run narrate`) rewrites
  the timings in `storyboard.json` from the alignment. Every scene component,
  the caption cues and the stills script already read their timings from
  there.
  - Overview and focus: the audio starts 0.5 s and 0.3 s into the scene. The
    scene lasts lead + last character end + 0.4 s tail. The focus scene has a
    4 s minimum so the zoom completes.
  - Code: the take starts after the 1 s intro. Step *i* lights 0.25 s before
    its first character is spoken; the alignment index comes from the step's
    offset in the stitched text. The last step ends 0.4 s after the last
    character. The step boundaries landed inside the take's sentence pauses
    (checked with `silencedetect`), so each highlight and rail item changes
    just before its words begin.
  - One `<Audio>` per scene sits in a `<Sequence>` at
    `scene.start + audio.at`. The title card's fade-out now follows the overview
    duration instead of a fixed 4 s.
- **New timings.** The scenes now run 0–7.96 s (overview), 7.96–12.65 s
  (focus) and 12.65–47.34 s (code). The code steps last 4.88, 8.27, 7.38, 7.73
  and 5.43 s.
- **Before and after.** The video went from 25.0 s and 827,562 B (video only)
  to 47.33 s and 2,941,777 B. The new file has an H.264 1280×720 video stream
  of 47.333 s and an AAC 48 kHz audio stream of 47.317 s. Speech starts at
  0.53 s, and the last word ends at 46.67 s, 0.66 s before the end. `ffmpeg -f
  null` decodes the whole file with no errors. The audio is AAC at about
  317 kb/s, Remotion's default. `Config.setAudioBitrate` would roughly halve the
  file if size ever matters.
- **Render.** 1,420 frames with `--concurrency=2` took 2 min 16 s wall time, and
  the peak RSS was 1.29 GB.
- **Stills.** All four were re-rendered. `scripts/stills.mjs` now derives the
  focus still's time from the storyboard, because it was hard-set to 8.0 s.
  Only `frames/02-focus-zoom.png` changed: it is now taken at the end of the
  longer zoom. `01-overview`, `03-code-wait` and `04-code-node` came out
  byte-identical, because the step-relative still times land on the same
  visual state.

## Blockers

None for the POC. The AI step was played by hand (`storyboard.json`), as the
brief specified.
