# Salvage audit: options 3 and 4 code (audit-34)

Nick judged the option 3 and option 4 demos weak. This audit asks a narrower question: is
any of their **code** worth keeping? Each piece is judged against the target structure in
`/root/c4v-salvage.md`: a shared core (storyboard schema, narration and alignment module,
pinned-commit code source, diagram loader) with two renderers over it (renderer-remotion
from option 1, renderer-motion-canvas from option 2). Story-arc components come later and
plug into that core.

Grades:
- **SALVAGE**: lift into the framework. Each entry says where it goes and what to change.
- **REFERENCE**: leave it in `pocs/` and point future builders at it.
- **DROP**: nothing worth keeping.

The baseline is what options 1 and 2 already provide. A piece of option 3 or 4 counts as
salvage only if it adds something they lack, or does the job better.

The `framework/` tree did not exist when this audit ran (branch `framework/salvage` was
still at `main`). Placements below therefore name the brief's boundaries, not concrete
file paths.

Paths are relative to `pocs/option-3-playwright-vhs-remotion/` (option 3) and
`pocs/option-4-slidev-magic-move/` (option 4).

## One trap shared by both

Both POCs measure speech end as `alignment.character_end_times_seconds.at(-1)`
(option 3 `scripts/retime.mjs:17`, `scripts/verify.mjs:32`; option 4
`scripts/record.mjs:26`). That is the closing punctuation's end time. Option 2 found the
problem and fixed it (`option-2-motion-canvas/scripts/narrate.mjs:90`): the
punctuation's span is trailing silence of up to about 1 s, so the scene gets padding the
voice doesn't need. Lift no timing code from options 3 or 4 without switching it to
option 2's last-letter-or-digit rule.

## Option 3: Playwright + VHS + Remotion

| # | Piece | Grade | Where / why |
|---|---|---|---|
| 3.1 | **Scene-kind registry composition** (`src/index.tsx:124–135`: `views` maps `scene.kind` to a component; `Film` emits one `<Sequence>` per scene and one `<Audio>` `<Sequence>` per narration line, all from storyboard fields) | **SALVAGE** | **renderer-remotion** composition root. It beats option 1, whose `src/Walkthrough.tsx` hard-codes scene ids (`sceneById("overview")`, `"focus"`, `"code"`). The kind→view map is the seam story-arc components register into. Adapt: read the core timeline (start/duration per scene, start per line) instead of fields `retime.mjs` wrote back into `storyboard.json`; type `Scene` properly instead of `[k:string]:any`. |
| 3.2 | **Storyboard schema ideas** (`storyboard.json`): `text` (on screen) kept apart from `spoken` (sent to TTS); `sources[]` each with its own `commit` and a C4 `element` binding; top-level `acts` plus `scene.act`; `step.cue` (anchor phrase); `step.skipped` (a line shown but never executed) | **SALVAGE** | **core schema**. Option 1 has `speech ?? narration`, but nothing else covers the excerpt-to-C4-element link, acts, or "skipped". Adapt: express these as typed optional fields in the one schema; `acts` is the first story-arc hook. |
| 3.3 | **Retime model** (`scripts/retime.mjs`): several narration lines per scene, chained with LEAD/GAP frames; a scene whose media has a natural length lasts `max(need, real)`, with `holdFrames = need − real` freezing the last real frame | **SALVAGE** (concept, not code) | **core narration/timeline**. Options 1 and 2 assume one take per scene. Several lines per scene, and a media floor with a disclosed hold, belong in the unified retimer. Don't copy the file. It uses `.at(-1)` (see above). Its cue loop (`:19–22`) runs every cued step against every line in the scene, so a scene with two lines and one cue throws unless both lines contain the cue phrase. `indexOf` takes the first match. It rewrites `storyboard.json` in place, and its footage branch repeats `normalize.mjs`'s `-0.1` s cut constant (`:29`). |
| 3.4 | **Output proof checks** (`scripts/verify.mjs:24–46`): ffprobe stream/codec/size/fps/frame count against the timeline; audio vs video duration within 0.1 s; full `ffmpeg -map 0 -f null` decode with empty stderr; per-line `volumedetect` loudness > −35 dB inside each line's window; silence < −45 dB in pauses ≥ 0.2 s; size < 10 MB | **SALVAGE** | **core verify** (renderer-agnostic, takes timeline + MP4). Options 1 and 2 ship nothing equivalent: no ffprobe, volumedetect or decode check in their scripts. This is the proof the salvage brief requires for both renderers. Adapt: parameterise on the core timeline, drop the footage asserts (`:28–30`). Caveat: the loudness rule assumes narration only, with no music bed. |
| 3.5 | **Timeline invariants** (`verify.mjs:25–34`): scenes contiguous; total equals `durationFrames`; no two lines overlap; each line ends ≥ 0.3 s before its scene cut; alignment `text`/`model` equal the storyboard's | **SALVAGE** | **core timeline validator**, run before any render. Small, pure, and it catches retime regressions. |
| 3.6 | **Fidelity extras** (`verify.mjs:8–19`): tag→commit check; declared range must *start with the declaration* (`decl()`); every storyboard element id exists in `dataset.model.elements` and `view` in `dataset.diagrams` | **SALVAGE** | Declaration check → **code-source**; element/view checks → **diagram loader** validation. Trap: `decl()` (`:11`) is Go-only, and it assumes the receiver variable is the type's lowercase first letter. Make it a per-language hook, or use an explicit `signature` string as option 1 does. |
| 3.7 | **"No caption text in the view" lint** (`verify.mjs:35`) | **SALVAGE** | One-line test in **both renderers**: fail if any storyboard caption string appears in renderer source. Enforces "dumb views" cheaply. |
| 3.8 | **Pinned tree export** (`scripts/prepare.mjs:22`: `git archive <sha> <subdir> \| tar -x`) | **SALVAGE** | **code-source** `exportTree(commit, subpath)`. Needed by any future scene that *runs* pinned code (tests, CLI). The rest of `prepare.mjs` (site copy, catalog adaptation, excerpt cut) is either covered by options 1 and 2 or site-specific. |
| 3.9 | **Lower third with act tracker** (`src/index.tsx:20–35`): act label, act progress chips, current caption, fades across the scenes of one act | **SALVAGE** | **future story-arc component** ("act chrome"). Pure function of frame + `acts` + scene timing. Adapt: theme tokens instead of literal colours; needs a Motion Canvas port before both renderers share it. |
| 3.10 | **Code view** (`src/index.tsx:86–105`): tabs kept in data and drawn with CSS `tab-size`; font auto-fit to widest line; stepped highlights with amber strike-through for `skipped` | **REFERENCE** | renderer-remotion already has Code Hike. Steal two ideas. Keep raw bytes and expand tabs in the view: option 2's `extract.mjs` rewrites tabs to four spaces, so the bytes it draws are not the bytes in git. And give "skipped" its own treatment. |
| 3.11 | **Browser view** (`src/index.tsx:61–84`): cut segments at 1x, `<Freeze>` hold, click/zoom markers mapped from the capture log via `toScene`, 1.18× push-in | **REFERENCE** | Blueprint for a future "live site tour" scene kind. Not needed by the two renderers now. |
| 3.12 | **Site capture** (`scripts/capture.mjs`): wall-clock action log; `mouse.move(...,{steps})`, then log the box centre, then click (Playwright draws no cursor); ctrl+wheel zoom; end-state asserts (URL, inspector heading, pinned SHA visible, zero page errors) | **REFERENCE** | Good pattern for recording real UI honestly. Trap: every selector is book-notes UI text (`'Open detail for Gateway'`, `[data-id="node:gw-breaker"]`), the port and base path are fixed, and the SHA prefix is a literal (`:30`). The log is accurate only to about one frame. |
| 3.13 | **Loopback static server** (`scripts/serve.mjs`): base-path strip, traversal guard | **REFERENCE** | Only needed if site capture returns. |
| 3.14 | **VHS terminal take** (`demo.tape`, `scripts/record-terminal.sh`) | **REFERENCE** | Hard-won fixes worth copying into any terminal scene. Warm the build cache in a `Hide` block. Turn off `show-mode-in-prompt`. Use `Wait+Screen` with `.` for `/`. Set `VHS_NO_SANDBOX=true` for root. Time the take from probed duration, because VHS wrote 25 fps despite `Framerate 30`. Trap: hard-coded `chromium-1248` path; `PS1` embeds the SHA. |
| 3.15 | **Terminal view** (`src/index.tsx:107–122`) | **REFERENCE** | Window chrome + highlight box is fine. Trap: the box is pixel coordinates set by eye (`storyboard.json` `highlight.box`). Derive it from the terminal grid. |
| 3.16 | **Faststart remux** (`scripts/finalize.sh`) | **REFERENCE** | Fold `-movflags +faststart` (stream copy) into the shared output step if a renderer lacks it. |
| 3.17 | **Title and end cards** (`src/index.tsx:37–59`) | **DROP** | Literal litefleet/Release It! strings in the view; options 1 and 2 have their own cards. |
| 3.18 | **Footage normaliser** (`scripts/normalize.mjs`) | **DROP** | Hard-codes action labels and scene ids (`'where'`, `'proof-terminal'`) and rewrites the storyboard. Its useful idea is in 3.3 and 3.11. |
| 3.19 | **TTS client** (`scripts/narrate.mjs`) | **DROP** | Weaker than option 2's: environment-only key, no `previous_text`/`next_text` prosody context. |
| 3.20 | **Still extraction** (`scripts/frames.sh`) | **DROP** | Duplicates option 1's `stills.mjs` and option 2's `frames.mjs` (gotcha kept in NOTES: `ffmpeg -nostdin` in read loops). |
| 3.21 | **Site manifest hasher** (`scripts/site-manifest.mjs`) | **DROP** | Ten-line tree hash for evidence only. |

## Option 4: Slidev + Shiki Magic Move

| # | Piece | Grade | Where / why |
|---|---|---|---|
| 4.1 | **Multi-commit source manifest** (`scripts/sources.mjs:5–28`): each excerpt names its own tag; tag resolved with `^{commit}` and rejected on drift from the expected SHA; SHA-256 per excerpt; the same path pulled from three different commits | **SALVAGE** | **code-source**. Option 1 pins one `focus` and option 2 pins one `board.code` commit for all snippets. Story arcs need excerpts across commits. Adapt: expected SHAs come from the storyboard, not a literal `pinned` map; drop the hard-coded `books/release-it/` base; keep option 2's blob pin alongside the SHA-256. |
| 4.2 | **Non-code evidence excerpts** (`sources/manifest.json` `before`/`after`: ranges of `lessons/02-timeouts.md` with a descriptive `symbol`) | **SALVAGE** | **core schema** + **code-source**: an excerpt kind for recorded results/prose, byte-checked like code but exempt from the declaration check (3.6). This is how a video quotes evidence without re-running it. |
| 4.3 | **Citation formatter** (`sources.mjs:31–35`: `ref · sha7 · path:start–end · symbol`) | **SALVAGE** | **code-source** pure function `citation(excerpt)`, used by both renderers so on-screen provenance is generated, never typed. Adapt: it slices a literal `release-it/` prefix off the ref and a book-specific base off the path. The `@@id@@` deck templating around it is Slidev plumbing (see 4.14). |
| 4.4 | **Code-evolution beat** (`slides.template.md` slide 3: one symbol, v0 → lesson-02 → v1, with a callout, step chip and citation per state) | **SALVAGE** (concept) | **future story-arc component**: schema `evolution: [excerptId…]` over 4.1's multi-commit excerpts, with per-state annotations. Each renderer animates it natively (Code Hike token transitions, Motion Canvas `Code` edits). Effort is in the renderers, not the data. |
| 4.5 | **Magic Move markup** (`` ````md magic-move `` block, `magicMoveDuration`) | **REFERENCE** | It is Slidev's built-in feature, so there's no mechanism to lift. Look at it for the feel a 4.4 implementation should match. |
| 4.6 | **Overlays keyed to the step index** (`$clicks`-bound `.swap` callouts, chips, cites, captions) | **REFERENCE** | Right idea: annotations follow the step index and own no timeline entries. Options 1 and 3 steps already work this way; the Slidev syntax isn't portable. |
| 4.7 | **Narration-driven live schedule** (`scripts/record.mjs:9–27, 123–167`): cue phrase → click at phrase start − `CLICK_LEAD`; each next slide scheduled from the *measured* start of the current one so drift doesn't accumulate; assert no take runs past its slide | **REFERENCE** | Only matters for a real-time capture renderer; the core timeline is deterministic. The math is a subset of core timing. Traps: `.at(-1)`, `takes.length!==5` (`:28`), literal cue labels and the `states` list (`:78`). |
| 4.8 | **FFmpeg narration mux** (`record.mjs:177–183`: `adelay` per take, `amix normalize=0`, `apad`, `-t` cut) | **REFERENCE** | Compact alternative to option 2's JS PCM mixer. It lacks option 2's "would this cut a word off" energy guard, so option 2's stays the core mixer. |
| 4.9 | **Playwright deck recorder** (`record.mjs:33–113`): static build + `vite preview` instead of the dev server; readiness polling; warm every slide/click state with bounded retries; `document.fonts.ready`; visible-only locators; wake-lock off | **REFERENCE** | Sound hardening for recording any web-rendered deck. Trap: `trimStart = rawDuration − schedule.stop` (`:176`) assumes the video ends exactly at `stop`, so any `context.close()` latency shifts the whole cut; and capture jitter is up to about 0.7 s. |
| 4.10 | **In-browser render assertions** (`record.mjs:93–103, 135, 147–158`): `getAnimations({subtree:true})` proves a morph actually ran; `getBoundingClientRect` checks token overflow and callout overlap per state | **REFERENCE** | Good idea for a layout lint in renderer-remotion (it renders in Chromium). Not portable to Motion Canvas's canvas, so it can't go in the core. |
| 4.11 | **TTS client** (`scripts/narrate.mjs`) | **REFERENCE** | Duplicates option 2's client. Two details worth folding into the core client: a process env var overrides the secrets file (`:15`), and a saved take whose text differs is refused at reuse time (`:23`), not just at retime. |
| 4.12 | **C4 zoom on a PNG** (`style.css:33–44`: CSS transform + rings at hand-measured pixel coordinates on a screenshot) | **DROP** | Trap: coordinates break whenever the image changes, and it bypasses the diagram data. The framework renders diagrams from JSON. |
| 4.13 | **Cue list** (`narration/script.json` `{label, phrase}`) | **DROP** | Same as option 2's `narration.cues` map. |
| 4.14 | **Deck sources** (`slides.template.md`, generated `slides.md`, `@@` substitution, `storyboard.md`) | **DROP** | Slidev-specific; `storyboard.md` is a prose table, and the real timing lives in `record.mjs`. |
| 4.15 | **Theme** (`style.css` minus 4.12) | **DROP** | Renderers carry their own theme; palette nearly matches option 3's anyway. |
| 4.16 | **Second-language provenance check** (`evidence/provenance-check.py`) | **DROP** | Re-implements 4.1 in Python; core fidelity checks cover it. |
| 4.17 | **Chromium path discovery** (`record.mjs:65–71`) | **DROP** | Host-specific; belongs in the kb's Playwright cache entry. |
| 4.18 | **Frame extraction at schedule times** (`record.mjs:184–187`) | **DROP** | Duplicates options 1 and 2. |

## Counts

| | SALVAGE | REFERENCE | DROP |
|---|---:|---:|---:|
| Option 3 | 9 | 7 | 5 |
| Option 4 | 4 | 7 | 7 |

## Lift list (priority order)

1. **Output proof verifier** (3.4) → core verify. **M.** The salvage brief requires
   ffprobe proof for both renderers, and neither option 1 nor option 2 has one.
2. **Scene-kind registry composition** (3.1) → renderer-remotion. **M.** This replaces
   option 1's hard-coded scene ids with the plug-in seam story-arc components need.
3. **Multi-commit manifest + drift guard + SHA-256 + citation formatter** (4.1, 4.3) →
   code-source. **S.**
4. **Timeline invariants validator** (3.5) → core timeline. **S.**
5. **Schema additions** (3.2, 4.2): `text`/`spoken`, `sources[].element`, `acts`,
   `step.cue`/`skipped`, evidence-kind excerpts → core schema. **S.**
6. **Multi-line scenes and media-floor holds in the unified retimer** (3.3), built on
   option 2's last-letter rule → core narration. **M.**
7. **Declaration check + C4 ref validation** (3.6) → code-source / diagram loader. **S.**
8. **No-hard-coded-caption lint** (3.7) → both renderers' tests. **S.**
9. **`exportTree` via `git archive`** (3.8) → code-source. **S.**
10. **Act-tracker lower third** (3.9) → story-arc component, both renderers. **M.**
11. **Code-evolution beat** (4.4) → story-arc component, both renderers. **L.**

Items 1–9 fit the current salvage run's core and renderer boundaries. Items 10 and 11
should wait for the story-arc planning run, which will design against the seams the
salvage README names.
