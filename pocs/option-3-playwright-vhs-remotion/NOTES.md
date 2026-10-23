# Option 3 — Playwright + VHS + Remotion

[Watch the 31-second demo](demo.mp4) · [Storyboard](storyboard.json) · Frames: [title](frames/title.png) · [architecture](frames/architecture.png) · [code](frames/code.png) · [terminal](frames/terminal.png) · [end](frames/end.png)

This demo makes one claim about Litefleet's gateway control circuit breaker and proves it in three acts. **Where:** find the breaker in the real C4 site and inspect it. **How:** read the pinned code that routes control-plane calls through the breaker, then the guard that rejects them. **Proof:** read the test that asserts the claim, then watch the project's real tests pass. It proves the capture and composition pipeline and one real unit-level behavior. It does not show a running Litefleet deployment or an injected control-plane outage.

## Source and honesty

Book-notes `release-it/v1-hardened` is pinned to `936786399d7bab3ebbfa845b9a07df02b41ed363`. `storyboard.json` names real element IDs, and real files, symbols and inclusive line ranges for all three excerpts. `public/code.json` is cut from that git object by those ranges, not retyped. `verify.mjs` checks that each excerpt is byte-identical and that each range begins with its declaration. Tabs are kept in the excerpt data and drawn with CSS `tab-size`. The highlight, dimming and strike-through on line 89 are styling only; the characters on screen are the bytes in git.

The terminal runs an unmodified `git archive` export of the pinned project. Four real tests pass, including `TestOpensAfterConsecutiveFailures`. Its assertion checks both `ErrOpen` and that the dependency was not called. The tests shorten the recovery cooldown; the production default remains five seconds. The independent `evidence/breaker-tests.txt` run exited 0.

The browser subject is the existing book-notes production site bundle (`pages/dist`), served locally from a copy. It now lists Litefleet in its own catalog, and its `litefleet.json` is byte-identical to `pages/public`, so the copy is no longer modified (`catalogAdapted: false` in `evidence/provenance.json`). That bundle was not rebuilt by this work, so its exact build-source commit is not independently established. Playwright drives the real UI and the real layout worker. No requests, diagrams or terminal results are mocked. `evidence/browser.json` records the final route, the inspector heading, that the inspector's Sources list shows the pinned revision, and an empty page-error list. The book-notes checkout was only read: `evidence/book-notes-after.txt` is empty. Another session committed to it during this work; those commits were not ours.

**What the composition adds on top of real footage**, and nothing more:
- **Cuts.** The browser clip is cut to its action windows. Kept footage plays at 1x; nothing is sped up.
- **Click and zoom markers.** These are drawn at the coordinates and times in `public/browser-actions.json`, which logs each click and zoom from the capture. Playwright renders no cursor.
- **One 1.18× push-in.** This is a Remotion camera move on the real pixels after the live canvas zoom.
- **Line highlights, a test-line box and captions.**

The VHS take plays unretimed and unpadded. Before recording, a `Hide` block warmed the Go build cache and turned off readline's `(ins)` marker. `-count=1` still forces the tests to execute on camera.

## Improvement pass (Opus)

Nick judged Sol's demo weak. The brief gave full licence to redo it within this toolchain, keeping fidelity. This pass rebuilt the film around a single stated claim.

| | Sol (before) | Opus (after) |
|---|---:|---:|
| Duration | 32.00 s (960 frames) | **31.40 s (942 frames)** |
| `demo.mp4` size | 1,617,487 bytes | **2,292,596 bytes** |
| Render (`--concurrency=2`) | 468.42 s | **185.33 s** (max RSS 467,636 KB) |
| Structure | still → browser → code → terminal | title → 3 acts (5 scenes) → end card |

**Kept:** the subject (gateway control breaker at 9367863), the `breaker.go` 84–92 excerpt, the four real breaker tests, the toolchain and capture scripts' structure, the provenance and verification approach, and the captions-only narration stub.

**Thrown away, and why:**
- **The opening diagram still and its hand-drawn "Gateway ↓ breaker ↓ control plane" callout.** The full topology was unreadable at 720p, and the callout was a stand-in for the real diagram. The site's own inspector and a live canvas zoom now show the breaker legibly (`public/diagram.png` was removed).
- **The 12-second, 1.38×-sped browser clip.** It was a whole page scaled into a box, with load blanks and "Arranging diagram…" flashes, and no visible clicks. It is replaced by a new capture: Fit View at each level, *Inspect Control circuit breaker*, then a ctrl+wheel zoom. The capture is cut to 7.5 s of 1x footage and shown full-bleed, with click markers.
- **The retimed and padded terminal clip** (`public/terminal.mp4`). It held an empty prompt for about 5 s while Go compiled. The new take has a warm cache, a 26 px font and no `(ins)` marker, and plays at 1x (5.4 s).
- **Hand-mirrored scene timings in the composition.** The composition now renders every scene, caption, cut and highlight from `storyboard.json`. `normalize.mjs` writes the measured browser cuts and terminal length back into it, which closes Sol's review note about timing drift.

**Added:**
- **A title card.** It states the payoff by frame 10: "After 5 failures, Litefleet's gateway stops calling the control plane", plus the three acts.
- **Two more pinned excerpts.** `routes/client.go` 112–119 shows where the gateway wraps its control-plane call in `breaker.Call`. `breaker_test.go` 13–22 is the assertion that is then run. The guard excerpt is now stepped: `allow()` → `return ErrOpen` → `fn()` never runs.
- **A highlight on the claim's PASS line** in the terminal.
- **A persistent lower third.** It carries the act name, an act tracker and a 28 px caption on a 90% opaque band. It sits inside 64 px side and 36 px bottom safe margins and stays steady across scenes within an act.
- **Fade transitions** of 8 frames at scene edges.
- **An end card.** It lists the three demonstrated facts and the unit-level caveat.

The film runs 31.4 s rather than stretching toward 40 s. The cuts removed dead time, and every scene holds long enough to read its caption.

## Measurements

Final render **185.33 s** at `--concurrency=2`. Final video **31.40 s**, 1280×720, 30 fps, 942 frames, H.264, no audio track. The whole file decodes cleanly. Exact bytes and hashes are in `evidence/verification.json`.

| Artifact | Bytes | Duration |
|---|---:|---:|
| `demo.mp4` | 2,292,596 | 31.40 s |
| `public/browser.webm` (raw Playwright) | 3,647,448 | 14.36 s |
| `public/browser.mp4` (H.264, 30 fps CFR; 7.47 s kept in the film) | 1,146,971 | 14.37 s |
| `public/terminal-vhs.mp4` (raw VHS, played at 1x) | 83,961 | 5.44 s |

## What needed adjustment

- **Node and sandbox.** Playwright 1.64 needs Node ≥ 20; use nvm's Node 22 (`/root/.nvm/versions/node/v22.23.2/bin`), because `/usr/bin/node` is 18. Root Chromium in VHS needs `VHS_NO_SANDBOX=true`.
- **Clicks start navigation at once.** The book-notes page navigates on the click frame, so each cut ends 0.1 s before the logged click, and the marker shows the click. Playwright's video ran about one frame ahead of the wall-clock log.
- **Canvas pan and zoom.** A plain wheel pans the diagram canvas; ctrl+wheel zooms at the pointer.
- **VHS frame rate.** VHS wrote 25 fps despite `Set Framerate 30`, so scene length comes from the probed duration.
- **VHS regexes.** VHS regexes cannot escape `/`.
- **Silent audio track.** Remotion still emits a silent AAC track. `finalize.sh` stream-copies it away.
- **Frame extraction.** `frames.sh` needed `ffmpeg -nostdin` inside its read loop.

## Reproduce

Run from this directory with Node 22, Go 1.26, FFmpeg, ttyd and VHS 0.10.0 on PATH. The source checkout defaults to `/root/Software/book-notes`; override it with `BOOK_NOTES_REPO`. The existing `pages/dist` is copied, never built or altered. Generated scratch goes under ignored `.work/`.

```sh
export PATH=/root/.nvm/versions/node/v22.23.2/bin:$PATH
npm ci
mkdir -p .work/bin && GOBIN="$PWD/.work/bin" go install github.com/charmbracelet/vhs@v0.10.0
export PATH="$PWD/.work/bin:$PATH"
node scripts/prepare.mjs          # site copy, pinned export, excerpts from storyboard ranges
node scripts/site-manifest.mjs
node scripts/serve.mjs &          # 127.0.0.1:4333; stop it after capture
npm run capture                   # browser.webm + browser-actions.json + browser.json
GOMAXPROCS=2 go test -C .work/pinned/books/release-it/project -p 2 -count=1 -v ./internal/breaker > evidence/breaker-tests.txt
bash scripts/record-terminal.sh   # VHS → public/terminal.mp4
node scripts/normalize.mjs        # cuts + measured timings → storyboard.json
/usr/bin/time -f 'elapsed_seconds=%e\nmax_rss_kb=%M' -o evidence/render-time.txt npm run render -- --browser-executable=/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome > evidence/render.log 2>&1
bash scripts/finalize.sh && bash scripts/frames.sh && npm run verify
```

`normalize.mjs` expects a fresh VHS output at `public/terminal.mp4`, which it renames to `terminal-vhs.mp4`. The highlight box and timing for the PASS line (`proof-terminal.highlight` in the storyboard) were set by inspecting this take; re-check them after re-recording. No publication, push or merge is part of this POC.

## Review and limitations

Sol's build `0b85e6f` had a fresh Claude Opus 5.5 review: **NITS, no blockers** (`evidence/review.json`, `evidence/review-response.md`). That review predates this pass and does not cover it. This pass has not had an independent cross-family review.

- **Excerpt extraction** uses declared line ranges. Verification proves byte identity and the declaration line; it is not a syntax-aware extraction proof.
- **The browser capture's timing** is the action log's wall clock, accurate to about one frame.
- **Colour.** Output is H.264 full-range `yuvj420p`; general player colour handling is unvalidated.
- **The site bundle's** build-source commit is unestablished. Its catalog and dataset are observed, not pinned.

## Full-build needs

- Generate storyboards with AI and check them, using syntax-aware extraction.
- Pin the site build and the browser environment.
- Derive terminal highlight positions from the terminal grid rather than by inspection.
- Add ElevenLabs narration with audio/caption sync, then a licensed publishing pipeline.
- For live outage evidence, run an isolated Litefleet stack and record breaker metrics alongside injected failures.

References: [Remotion render CLI](https://www.remotion.dev/docs/cli/render), [Charm VHS](https://github.com/charmbracelet/vhs), [Playwright video capture](https://playwright.dev/docs/videos).
