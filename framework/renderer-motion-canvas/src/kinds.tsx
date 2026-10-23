// Scene kinds → generators. The interpreter (scenes/video.tsx) looks a scene's
// `kind` up here; a new story-arc kind is one more entry. Every runner gets the
// stage, its storyboard scene and its timed scene, and must finish within
// timed.frames (the interpreter pads to exactly that and fails on overrun).
// All times come from play.ts queries over the bundle: cueAt, hopsOf, focusOf,
// codeEnterOf; the context diagram from contextOf.
import {all, delay, waitFor, type ThreadGenerator} from '@motion-canvas/core';
import {codeEnterOf, contextOf, cueAt, focusOf, hopsOf, type CodeScene, type DiagramScene, type Scene, type TimedScene} from '../../core/src/index.ts';
import {SHOT_MOVE, type Shot, type Stage} from './stage.tsx';

export type SceneRunner = (st: Stage, sc: Scene, t: TimedScene) => ThreadGenerator;

/** Start `anim` at `at` seconds into the scene. */
const at = (s: number, anim: ThreadGenerator) => (s > 0 ? delay(s, anim) : anim);

/** Hops of a scene on a diagram: the packet is placed at the first hop's origin, then rides each on time. */
function hops(st: Stage, viewId: string, sc: Scene): ThreadGenerator[] {
  const dv = st.diagram(viewId);
  const hs = hopsOf(st.b, sc.id);
  if (!hs.length) return [];
  return [dv.place(hs[0]), ...hs.map((h) => at(h.start, dv.hop(h)))];
}

/** follow-request and state-change: the whole view, packet hops, badges, skips. */
const diagramScene: SceneRunner = function* (st, scene, t) {
  const sc = scene as DiagramScene;
  const dv = st.diagram(sc.view);
  const withState = !!sc.state?.length;
  // With the state panel up, keep the full-screen framing if the fitted view
  // clears the panel; otherwise frame it underneath.
  const clears = dv.fitted(st.L.diagram).y >= st.L.statePanel.y + st.L.statePanel.h + 4;
  const vp = withState && !clears ? st.L.diagramUnderState : st.L.diagram;
  const shot: Shot = {diagram: {view: sc.view, vp, target: {region: dv.whole()}}, state: withState, header: {kind: 'line'}};
  yield* all(
    st.transition(shot),
    ...hops(st, sc.view, sc),
    ...(sc.badge ? [at(cueAt(t, sc.badge.cue), dv.badge(sc.badge.elementId, sc.badge.text, sc.badge.tone))] : []),
    ...(sc.skip ? [at(cueAt(t, sc.skip.cue), dv.skip(sc.skip.elements, sc.skip.edges, sc.skip.note))] : []),
  );
};

/** architecture-overview: the whole view under a title card. */
const overview: SceneRunner = function* (st, scene) {
  const sc = scene as DiagramScene;
  const dv = st.diagram(sc.view);
  const heading = sc.title ?? dv.view.title;
  yield* st.transition({
    diagram: {view: sc.view, vp: st.L.diagramUnderTitle, target: {region: dv.whole()}},
    header: {kind: 'card', heading},
  });
};

/** focus-element: the element lights, its relationships glow, the rest dims; the camera pushes in. */
const focusElement: SceneRunner = function* (st, scene) {
  const sc = scene as DiagramScene;
  if (!sc.elementId) throw new Error(`${sc.id}: focus-element needs elementId`);
  const dv = st.diagram(sc.view);
  const keep = st.current.diagram?.view === sc.view;
  const vp = keep ? st.current.diagram!.vp : st.L.diagram;
  yield* all(
    keep ? waitFor(0) : st.transition({diagram: {view: sc.view, vp, target: {region: dv.whole()}}}),
    dv.focus(sc.elementId),
    delay(0.35, all(st.dropHeader(0.6), dv.shoot({focus: sc.elementId, fill: 0.45}, st.L.full, 1.8))),
  );
  st.assume({diagram: {view: sc.view, vp: st.L.full, target: {focus: sc.elementId, fill: 0.45}}});
};

/** code-explanation: excerpt + selections (or steps + rail), context strip, state panel, hops in the strip. */
const codeScene: SceneRunner = function* (st, scene, t) {
  const sc = scene as CodeScene;
  const ctx = contextOf(st.b, sc.id);
  const ctxView = ctx && st.diagram(ctx.view);
  const shot: Shot = ctx
    ? {
        diagram: {
          view: ctx.view,
          vp: st.L.strip,
          target: {region: ctx.elementId ? ctxView!.around(ctx.elementId) : ctxView!.whole(), margin: 8},
          notes: false,
          context: ctx.elementId,
        },
        code: {excerpt: sc.excerpt, box: st.L.codeWide},
        state: true,
      }
    : {code: {excerpt: sc.excerpt, box: st.L.codeTall}, rail: !!sc.steps};

  // A panel that is not on screen yet opens on the scene's `enter` cue (if any).
  const entering = !st.current.code;
  const open = entering ? codeEnterOf(st.b, sc.id) : 0;
  const morphs = !entering && (st.current.code?.excerpt !== sc.excerpt || st.current.code?.box !== shot.code!.box);
  const settled = (entering ? open : 0) + (entering || morphs ? SHOT_MOVE : 0);

  const beats: ThreadGenerator[] = [];
  if (entering && open > 0) {
    beats.push(st.transition({...shot, code: undefined, state: false}));
    beats.push(at(open, st.transition(shot)));
  } else beats.push(st.transition(shot));

  if (sc.steps) st.rail.set(sc.railTitle ?? '', sc.steps);
  // Selections land on their time, but never before the panel has settled.
  focusOf(st.b, sc.id).forEach((f, i) => {
    beats.push(at(Math.max(f.at, settled), st.code.focus(f.ranges)));
    if (sc.steps) beats.push(at(Math.max(f.at, settled), st.rail.activate(i)));
  });
  if (!sc.focus && !sc.steps && !entering) beats.push(st.code.clearFocus());
  if (ctx) beats.push(...hops(st, ctx.view, sc));
  yield* all(...beats);
};

export const RUNNERS: Record<string, SceneRunner> = {
  'follow-request': diagramScene,
  'state-change': diagramScene,
  'architecture-overview': overview,
  'focus-element': focusElement,
  'code-explanation': codeScene,
};
