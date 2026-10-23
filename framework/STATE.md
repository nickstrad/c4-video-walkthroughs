# STATE — framework/

**Goal:** a small C4 video framework with one shared core and two renderers
(Remotion, Motion Canvas), salvaged from POC options 1 and 2. The spec and
layout are in [README.md](README.md).

**Status (2026-10-23):** salvage complete on branch `framework/salvage`, not
merged.
- Core, the litefleet project and both renderers are built.
- Both proof MP4s are rendered and verified: `projects/litefleet/renders/`.
- `c4v verify` passes, the typechecks pass in all three packages, and the core
  tests pass (6/6).

**In progress:** nothing.

**Next steps:**
1. Nick reviews the branch and merges it.
2. A planning run designs story-arc components against the seams in
   README.md § "Seams".
3. Resolve the open core proposals: `contextOf` in `play.ts`, an explicit
   code-pane entry cue, and a resolved edge id from `hopsOf`.

**Open decisions:** whether the Pages site should show the framework renders
(owner: Nick).

**Resume:**
- Node 22.23.2.
- `node core/bin/c4v.ts build projects/litefleet` regenerates
  `build/track.wav`, which is gitignored.
- Each renderer's `scripts/render.mjs` re-renders its MP4 (README § "How to
  render").
- No background runs are left alive.
