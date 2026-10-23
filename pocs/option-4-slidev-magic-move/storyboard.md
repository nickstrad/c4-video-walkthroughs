# Storyboard: a timeout turns a hang into an error

38.5 seconds, five slides, 1280×720, silent. Speaker notes in `slides.md` are the
narration script; the burned-in caption band carries a condensed line of it on
every scene. Scene times are the recorder's `schedule` in `scripts/record.mjs`.

| Time | Slide | Story / visual | Exact real source |
|---|---|---|---|
| 0–4.5 s | 1. Payoff | The lesson stated first: a timeout turns a hang into an error | — |
| 4.5–11.5 s | 2. Architecture | Real C4 gateway render; click at 7.5 s zooms to API handlers → node client → node agent, with rings | v1 `project/cmd/gateway/main.go`, `main`, 27–31 |
| 11.5–27.5 s | 3. Magic Move | v0 beat (4 s) → click 15.5 s morph to lesson-02 deadlines → click 21 s morph to v1 bounded retries; a callout names each change | v0 `New` 24–26 → lesson-02 `New` 26–28 → v1 `New` 36–42 in `project/internal/nodeclient/client.go` |
| 27.5–34.5 s | 4. Evidence | Recorded before/after outage figures, quoted with an explicit not-re-run caveat | v1 `lessons/02-timeouts.md` 101–104 (before) and 113–117 (after) |
| 34.5–38.5 s | 5. End card | Project name and takeaway, source commits, silent-video note | — |

Paths are relative to `books/release-it/` in book-notes.

- v0: `release-it/v0-flawed` = `6076a82a59355b4ed7afbc5d29d3bbc12da6a944`.
- lesson-02: `release-it/lesson-02` = `8e716278b152a31e0f0d4a81b3d20a8ff6091467`.
- v1: `release-it/v1-hardened` = `936786399d7bab3ebbfa845b9a07df02b41ed363`.
- Machine-readable ranges, symbols, full text and SHA-256: `sources/manifest.json`.
- `npm run sources` extracts with `git show`, rejects tag drift and regenerates the
  deck from `slides.template.md`. No code is invented or reformatted. CSS visually
  wraps long lines.
- C4 image: `docs/diagram-site/evidence/item-2/screenshots/litefleet-gateway-components-1600-canvas.png`.
  `public/c4-gateway.png` preserves its bytes. CSS crops, zooms and draws the three
  rings over it; the image itself is unmodified.
- `public/litefleet.json` is the companion architecture dataset.

Honesty constraints the deck keeps:

- 2.5 s is per HTTP attempt. Bounded read retries can extend a request up to the
  gateway's 2.9 s request deadline; the deck claims no end-to-end 2.5 s bound.
- The outage numbers are quoted from the repository's lesson file. They compare
  `lesson-01` with `lesson-02` (the whole timeout patch, not the node client alone)
  and were not re-run for this video. `lesson-01`'s `New` is identical to v0's.
