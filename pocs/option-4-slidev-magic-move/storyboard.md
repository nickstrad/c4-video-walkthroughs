# Storyboard: put a deadline on waiting

28 seconds, six slides, 1280×720, silent narration stub. Speaker notes in
`slides.md` are the narration script. Captions summarize each scene.

| Time | Slide | Story / visual | Exact real code |
|---|---|---|---|
| 0–4 s | 1. Problem | Silent node, unbounded default client | v0 `internal/nodeclient/client.go`, `New`, 24–26 |
| 4–8 s | 2. Architecture | Real C4 gateway component image → node client | v1 `cmd/gateway/main.go`, `main` excerpt, 27–31 |
| 8–12 s | 3. Component | Node client attempt budgets and bounded read retries | v1 `internal/nodeclient/client.go`, `New`, 36–42 |
| 12–19 s | 4. Evolution | Shiki Magic Move; timed click at 16 s, 1.4 s morph | v0 `New` 24–26 → v1 `New` 36–42 in `internal/nodeclient/client.go` |
| 19–23 s | 5. Implementation | Client and transport apply the deadlines | v1 `internal/httpx/client.go`, `NewClient` excerpt, 19–26 |
| 23–28 s | 6. Evidence | Blackhole-node acceptance assertions, explicitly not executed here | v1 `lab/verify/02-timeouts.sh`, top-level assertions, 75–78 |

All paths above are relative to `books/release-it/project/` in book-notes.

- v0: `release-it/v0-flawed` = `6076a82a59355b4ed7afbc5d29d3bbc12da6a944`.
- v1: `release-it/v1-hardened` = `936786399d7bab3ebbfa845b9a07df02b41ed363`.
- Machine-readable ranges, symbols, full text and SHA-256: `sources/manifest.json`.
- `npm run sources` extracts with `git show` and regenerates the deck from
  `slides.template.md`. No code is invented or reformatted. CSS visually wraps long lines.
- C4 image copied from the supplied real diagram-site dataset evidence:
  `docs/diagram-site/evidence/item-2/screenshots/litefleet-gateway-components-1600-canvas.png`.
  `public/c4-gateway.png` preserves its bytes; CSS crops surrounding canvas whitespace.
- `public/litefleet.json` is the companion architecture dataset from
  `pages/public/architectures/litefleet.json`; its revision names v1 `9367863`.
  Dataset mapping: gateway API handlers → node client + row stream → node agent;
  the corresponding source is the gateway constructor and nodeclient.New.

The 2.5 s total is per HTTP attempt. Bounded read retries can extend the complete
request; this deck does not claim an end-to-end 2.5 s upper bound. The final scene
shows existing fault-injection assertions, not new measured reliability results.
