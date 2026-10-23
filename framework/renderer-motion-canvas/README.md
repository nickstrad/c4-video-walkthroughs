# renderer-motion-canvas

Plays a c4v render bundle (`<project>/build/bundle.json` + `<project>/build/track.wav`)
into an MP4 with Motion Canvas 3.17.2. Salvaged from `pocs/option-2-motion-canvas`.

```sh
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"   # Node >= 22.18
npm ci
npm run typecheck                                        # tsc --noEmit
flock /tmp/c4v-render.lock node scripts/render.mjs [projectDir] [out.mp4]
node scripts/stills.mjs [projectDir] [video]             # 4 stills -> <project>/renders/frames/
node scripts/stills.mjs [projectDir] [video] --review /tmp/dir   # 2 stills per scene
```

Defaults: project `../projects/litefleet`, output `<project>/renders/motion-canvas.mp4`.
If `build/` is missing, run `node framework/core/bin/c4v.ts build <projectDir>` (no network).
`npm run dev` opens the editor on the default project (`C4V_PROJECT=<dir>` for another).

## Layout

- `src/project.ts` imports the track; `src/bundle.ts` the bundle (through the
  `@c4v-project` alias that `vite.config.ts` points at `C4V_PROJECT`).
- `src/scenes/video.tsx`: the interpreter. It plays timeline scenes in order, each for exactly
  `timed.frames` (it waits on absolute frame targets and fails on overrun), then the outro.
- `src/kinds.tsx`: scene kind to runner registry (follow-request, state-change,
  architecture-overview, focus-element, code-explanation).
- `src/stage.tsx`: every component, built once from the bundle, plus `transition(shot)`.
- `src/diagram.tsx` (any View + Layout, camera, packet, badges, skip, focus),
  `src/code.tsx` (code panel, step rail), `src/panels.tsx` (state panel, captions, titles).

All times come from `core/src/play.ts`, all geometry from the bundle's ELK layouts, and all
code from the bundle's excerpts.

## Seams

- New scene kind: add a `SceneRunner` to `RUNNERS` in `src/kinds.tsx`.
- New transition or camera move: `Stage.transition` (how shots change) and
  `DiagramView.shoot` / `CameraTarget` (what a camera can frame).
- New overlay: add it to `Stage`'s constructor. If it is time-driven, read `clock()` through
  a `play.ts` query, the same way captions and the state panel do.
- Another language: `Code.defaultHighlighter` in `src/code.tsx`.
