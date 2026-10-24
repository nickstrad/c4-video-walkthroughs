# STATE — framework/

**Goal:** a small C4 video framework with one shared core and two renderers
(Remotion, Motion Canvas), salvaged from POC options 1 and 2, plus the ideas
worth lifting from options 3 and 4, now growing story arcs per
[../docs/story-arc-plan.md](../docs/story-arc-plan.md). Spec and layout:
[README.md](README.md).

**Status (2026-10-24):** the first story-arc video, `projects/litefleet-arc`
("One query's guardrails", Remotion, 1:49), is built on branch
`feature/arc-video` (from `main` @ `08f1771`), not pushed or merged. It landed
plan items 1, 2 (Remotion), 3, 4, 6 and a thin slice of 5; details and proof
are in README § "Story arcs". Audit-34 lifts 1–9 are merged (`9340b69`).
- `c4v verify` and `c4v proof` pass on `litefleet-arc`; 28/28 core tests and
  both renderers' typecheck and dumb-views tests pass.
- Litefleet (arc-less) rebuilds byte-identically; its renders are untouched.
- The Pages site has a fifth card for the arc video; `pages.yml` publishes it
  next to the four POC videos (deploys on merge to `main`).

**In progress:** nothing. Nick watches the arc video and starts the feedback
loop.

**Next steps:**
1. Nick's feedback on `litefleet-arc` (pacing, the descend dive, the act
   tracker, the credits card's co-author line), then merge.
2. Motion Canvas port: `repo-card` and `credits` runners, descend/settle,
   responsibilities, and the lower third (plan item 2's Sol half, MC halves
   of 3, 5 and 6).
3. The rest of item 5 (`creditsOf` scopes, aliases, `.mailmap`, bylines),
   then items 7–12 in the plan's order.
4. Older follow-ups: media-floor holds (lift 6), a "skipped" treatment
   (audit 3.10), the open items in README.

**Open decisions:** plan § 9 (credits default, evolution pin, change-driven
proof repo, series timing, lower-third placement now mocked above the
captions, pointers without a dataset, neighbour discovery). Owner: Nick.

**Resume:**
- Node 22.23.2 (`~/.nvm/versions/node/v22.23.2/bin`). Run `npm ci` in `core/`
  and in both renderers. The book-notes checkout must be at
  `/root/Software/book-notes` (or `C4V_CHECKOUT_BOOK_NOTES`).
- `node core/bin/c4v.ts build projects/<p>` regenerates `build/track.wav`
  (gitignored); `verify`, then each renderer's `scripts/render.mjs` (fails
  unless the proof passes), then `c4v proof`.
- `c4v narrate` is the only TTS spend; every `litefleet-arc` take is
  committed, so it voices 0 characters.
- No background runs are left alive.
