// The one scene: an interpreter over the bundle's timeline. It plays the
// timeline's scenes in order, dispatching on `kind` to a runner (kinds.tsx);
// each scene lasts exactly timed.frames, then the outro pads the video to
// timeline.totalFrames. The narration track (project.ts) starts at frame 0.
import {makeScene2D} from '@motion-canvas/2d';
import {all, useThread, useTime, type ThreadGenerator} from '@motion-canvas/core';
import {sceneOf} from '../../../core/src/index.ts';
import {bundle} from '../bundle.ts';
import {RUNNERS} from '../kinds.tsx';
import {Stage} from '../stage.tsx';
import {C} from '../theme.ts';

export default makeScene2D(function* (view) {
  view.fill(C.bg);
  // The main thread's time is the video clock: captions, the state panel and
  // the packet label read it through play.ts queries.
  const clock = useThread().time;
  const stage = new Stage(bundle, () => clock(), view);
  const {fps, totalFrames, scenes} = bundle.timeline;

  let frame = 0;
  for (const timed of scenes) {
    if (timed.startFrame !== frame) throw fail(`${timed.id} starts at frame ${timed.startFrame}, expected ${frame}`);
    const scene = sceneOf(bundle, timed.id);
    const run = RUNNERS[scene.kind];
    if (!run) throw fail(`${scene.id}: no runner for scene kind "${scene.kind}"`);
    frame += timed.frames;
    yield* all(untilFrame(frame, fps), run(stage, scene, timed));
    if (useTime() > frame / fps + 1e-6) throw fail(`${scene.id} overran its ${timed.frames} frames (ended at ${useTime().toFixed(3)} s)`);
  }
  yield* untilFrame(totalFrames, fps); // outro
});

/**
 * Wait until an absolute frame, with waitFor's semantics (the thread's time
 * lands exactly on the target) but measured from frame 0 instead of summed
 * per scene, so float drift can never add or drop a frame.
 */
function* untilFrame(frame: number, fps: number): ThreadGenerator {
  const thread = useThread();
  const target = frame / fps, step = 1 / fps;
  while (target - step > thread.fixed + 1e-6) yield;
  thread.time(target);
}

function fail(message: string) {
  // Surface on the browser console too: scripts/render.mjs fails the run on it.
  console.error(`[c4v] ${message}`);
  return new Error(message);
}
