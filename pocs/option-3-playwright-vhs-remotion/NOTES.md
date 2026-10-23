# Option 3 — Playwright + VHS + Remotion

[Watch the 32-second demo](demo.mp4) · [Storyboard](storyboard.json) · [Architecture frame](frames/architecture.png) · [Code frame](frames/code.png) · [Terminal frame](frames/terminal.png)

This proof follows Litefleet’s gateway control circuit breaker: find its C4 component in the real browser site, inspect the early-return guard, then run the project’s actual breaker tests. It proves the capture/composition pipeline and a real unit-level behavior; it does not demonstrate a running Litefleet deployment or an injected control-plane outage.

## Source and honesty

Book-notes `release-it/v1-hardened` is pinned to `936786399d7bab3ebbfa845b9a07df02b41ed363`. `storyboard.json` names real element IDs, files, functions and inclusive line ranges. `public/code.json` is extracted from that git object, rather than retyped. The terminal runs an unmodified `git archive` export of the pinned project. Four real tests pass, including `TestOpensAfterConsecutiveFailures`, whose assertion checks both `ErrOpen` and that the dependency was not called. Tests shorten the recovery cooldown; the production default remains five seconds.

The browser subject is the existing book-notes production site bundle with the real Litefleet JSON and layout worker. At capture time its catalog had only shell fixtures. `prepare.mjs` copies the bundle locally and appends Litefleet **only to that copy’s catalog**. Playwright selects it in the actual Architecture picker, drills into containers and gateway components, and captures the rendered canvas. No requests, diagrams, or terminal results are mocked. `evidence/provenance.json` records the observed site checkout revision and dataset hash (the pre-existing `dist` was not rebuilt; its exact build-source commit is not independently established); `evidence/browser.json` records route and page-error checks. The book-notes checkout is read only throughout this work.

## What worked

- Playwright 1.64.0 records the real application and its worker, producing `public/browser.webm`; normalized H.264 is `public/browser.mp4`.
- Charm VHS 0.10.0, system ttyd and FFmpeg produce `public/terminal-vhs.mp4` from `demo.tape`. `public/terminal.mp4` retimes that genuine recording to the nine-second terminal scene.
- Remotion 4.0.484 composes a diagram still → real browser clip → exact code excerpt with highlighted early return → VHS tests. Output is 1280×720, 30 fps, 960 frames, H.264. Rendering explicitly uses `--concurrency=2`.
- Titles/captions carry the explanation. Narration is intentionally stubbed; no ElevenLabs key, voice request or audio track is used.
- Final frames are extracted from the finished MP4, and the complete MP4 is decoded during verification. See `evidence/verification.json` for measured duration, byte sizes and hashes, and `evidence/render-time.txt` for elapsed render time and process RSS.

## Measurements

Final render: **468.42 s** (7 min 48 s), `--concurrency=2`. Final video: **32.00 s**, 1280×720, 30 fps. File sizes below use exact bytes.

| Artifact | Bytes | Duration |
|---|---:|---:|
| `demo.mp4` | 1,617,487 | 32.00 s |
| `public/browser.webm` | 4,706,222 | 16.52 s |
| `public/browser.mp4` | 1,050,581 | 16.52 s |
| `public/terminal-vhs.mp4` | 84,676 | 8.40 s |
| `public/terminal.mp4` | 141,404 | 9.00 s |

## What needed adjustment

FFmpeg/ttyd were initially absent; installing them and building VHS succeeded, so no terminal-capture substitution was necessary. Root Chromium needs `VHS_NO_SANDBOX=true`; a local `chromium` symlink reuses the installed Playwright browser. The first fixed-delay VHS trial finished before test output was visible on this shared VM. The delivered tape waits for `PASS` and holds the result; the successful recording was inspected. A render started against the first trial was stopped and superseded.

Remotion emitted a silent AAC track despite muted clips; `finalize.sh` removes it with a stream-copy remux, leaving the rendered video unchanged.

The full gateway diagram is dense at 720p. Fit provides topology, while the adjacent large callout supplies the three-component path. The actual browser UI scales to fit its video scene; full-resolution raw footage is retained. The browser clip is sped up to twelve seconds; measured timing is recorded in `evidence/normalization.json`. A full build should add a focused camera move onto the breaker rather than expect every overview label to be legible.

## Reproduce

Run from this directory with Node 22, Go 1.26, FFmpeg, ttyd and VHS 0.10.0 on PATH. Source checkout defaults to `/root/Software/book-notes`; override `BOOK_NOTES_REPO` if needed. Existing site `pages/dist` must be built from the intended site snapshot; prepare copies it without building in or altering that checkout. All generated scratch content is under ignored `.work/`.

```sh
npm ci
# If missing: apt-get install -y ffmpeg ttyd
mkdir -p .work/bin
GOBIN="$PWD/.work/bin" go install github.com/charmbracelet/vhs@v0.10.0
export PATH="$PWD/.work/bin:$PATH"
node scripts/prepare.mjs
node scripts/site-manifest.mjs
node scripts/serve.mjs # leave running locally on 127.0.0.1:4333
# In a second shell, same directory:
npm run capture
GOMAXPROCS=2 go test -C .work/pinned/books/release-it/project -p 2 -count=1 -v ./internal/breaker > evidence/breaker-tests.txt
bash scripts/record-terminal.sh
node scripts/normalize.mjs
/usr/bin/time -f 'elapsed_seconds=%e\nmax_rss_kb=%M' -o evidence/render-time.txt npm run render -- --browser-executable=/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome > evidence/render.log 2>&1
bash scripts/finalize.sh
bash scripts/frames.sh
npm run verify
```

`CHROME_PATH` selects VHS’s browser; use Remotion’s `--browser-executable` flag for another installation. `normalize.mjs` follows a fresh VHS recording, because it renames that input before retiming it. Close the local server when capture finishes. No publication, remote write, push or merge is part of this POC.

## Review and limitations

Fresh cross-family review by Claude Opus 5.5 of build `0b85e6f` returned **NITS, no blockers**; see `evidence/review.json` and the dispositions in `evidence/review-response.md`. Storyboard caption text now matches the rendered cards exactly. Scene timing is manually mirrored between JSON and composition; the caption check guards text drift, while a future build should generate scenes directly from the storyboard.

Extraction intentionally uses a pinned declaration plus a fixed nine-line range, and the highlight uses offsets within that excerpt. Verification compares the exact excerpt against the pinned source; it is not a syntax-aware extraction proof. Output is H.264 full-range `yuvj420p`; general player color handling has not been validated. The retained terminal prompt includes readline’s `(ins)` indicator, and the diagram still retains real site zoom controls. The explicit brief’s 15–40 s range takes precedence over the overview’s 10–30 s suggestion.

## Full-build needs

Replace manual scenario/source mapping with a checked AI storyboard plus syntax-aware extraction; connect real demonstrations to declared assertions; pin the site build and browser environment; introduce per-scene focus/zoom and audio timing. Add ElevenLabs narration and audio/caption synchronization, then a licensed publishing pipeline. For live outage evidence, run a separately isolated Litefleet stack and record observable breaker metrics alongside injected failures.

References: [Remotion render CLI](https://www.remotion.dev/docs/cli/render), [Charm VHS tape syntax and installation](https://github.com/charmbracelet/vhs), [Playwright video capture](https://playwright.dev/docs/videos).
