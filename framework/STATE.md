# STATE — framework/

**Goal:** a small C4 video framework with one shared core and two renderers
(Remotion, Motion Canvas), salvaged from POC options 1 and 2, plus the ideas
worth lifting from options 3 and 4. Spec and layout: [README.md](README.md);
the lift list: [../docs/salvage-audit-34.md](../docs/salvage-audit-34.md).

**Status (2026-10-23):** audit-34 lifts 1–9 and the three proposed core
changes are on branch `framework/lift` (from `main` @ `bad472a`). The branch is
not pushed or merged.
- Lift status per item: README § "Lifted from options 3 and 4".
- Both litefleet MP4s were re-rendered from the framework with the committed
  takes (0 ElevenLabs calls), and both pass `c4v proof`: README § "Proof".

**In progress:** nothing.

**Next steps:**
1. Nick reviews `framework/lift` and merges it.
2. A story-arc planning run designs audit items 10 (act-tracker lower third)
   and 11 (code-evolution beat) against README § "Seams". The data for them
   now exists: `acts`/`actAt`, and per-excerpt pins.
3. Deferred from lift 6: media-floor holds (`holdFrames`). Build them with the
   first scene kind whose media has a natural length (footage, terminal).
4. Renderer follow-ups: a distinct "skipped" treatment for `focusOf(...).skipped`
   (audit 3.10), plus the remaining open items in README.

**Open decisions:** whether the Pages site should show the framework renders
(owner: Nick).

**Resume:**
- Node 22.23.2 (`~/.nvm/versions/node/v22.23.2/bin`). Run `npm ci` in `core/`
  and in both renderers.
- `node core/bin/c4v.ts build projects/litefleet` regenerates
  `build/track.wav`, which is gitignored.
- Each renderer's `scripts/render.mjs` re-renders its MP4 and fails unless the
  output passes the proof (README § "How to render").
- `node core/bin/c4v.ts proof projects/litefleet` re-proves the committed
  renders.
- No background runs are left alive.
