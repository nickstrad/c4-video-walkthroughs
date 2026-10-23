// Pure derivations over the bundle that every layer shares: which diagram a
// scene keeps on screen, which code scenes form one continuous excerpt "run",
// and the selection on that run at time t. All times come from the timeline
// via core's play.ts; nothing here knows about a particular project.
import {
  focusOf, isCodeScene,
  type CodeScene, type Range, type RenderBundle, type Scene, type TimedScene, type View, type Layout,
} from "../../core/src/index.ts";
import { lerp, ramp } from "./anim.ts";

export type Ctx = { view: string; elementId?: string };

export type Story = {
  bundle: RenderBundle;
  scenes: Scene[]; // timeline order
  timed: TimedScene[];
  /** Diagram a scene shows or keeps as context (code scenes inherit it within a run). */
  viewOf: (i: number) => string | undefined;
  contextOf: (i: number) => Ctx | undefined;
  /** Index of the first scene of the code run scene i belongs to (-1 for diagram scenes). */
  runOf: (i: number) => number;
  view: (id: string) => { view: View; layout: Layout };
};

export function buildStory(bundle: RenderBundle): Story {
  const timed = bundle.timeline.scenes;
  const scenes = timed.map((t) => {
    const s = bundle.storyboard.scenes.find((x) => x.id === t.id);
    if (!s) throw new Error(`timeline scene ${t.id} is not in the storyboard`);
    return s;
  });
  // A code run: consecutive code scenes on the same excerpt. The run's context
  // diagram carries forward until a scene in it names another one.
  const run: number[] = [], ctx: (Ctx | undefined)[] = [];
  scenes.forEach((s, i) => {
    if (!isCodeScene(s)) { run.push(-1); ctx.push(undefined); return; }
    const prev = scenes[i - 1];
    const cont = !!prev && isCodeScene(prev) && prev.excerpt === s.excerpt;
    run.push(cont ? run[i - 1] : i);
    ctx.push(s.context ?? (cont ? ctx[i - 1] : undefined));
  });
  const view = (id: string) => {
    const v = bundle.views[id];
    if (!v) throw new Error(`bundle has no view ${id}`);
    return v;
  };
  return {
    bundle, scenes, timed, view,
    contextOf: (i) => ctx[i],
    runOf: (i) => run[i],
    viewOf: (i) => {
      const s = scenes[i];
      return isCodeScene(s) ? ctx[i]?.view : s.view;
    },
  };
}

/** The scene index playing at absolute t (the last one during the outro). */
export function sceneIndexAt(story: Story, t: number) {
  const i = story.timed.findIndex((s) => t >= s.start && t < s.start + s.duration);
  return i === -1 ? (t < 0 ? 0 : story.timed.length - 1) : i;
}

export type Selection = {
  /** Weight of an exact range (0..1), blending the previous selection into the current. */
  weight: (r: Range) => number;
  /** How strongly anything is selected (drives dimming of the rest). */
  any: number;
  cur: Range[];
  prev: Range[];
  /** Time since the current selection took over, s. */
  since: number;
  /** How long the current selection holds: until the next one, else the end of the scene, s. */
  span: number;
};

const key = (r: Range) => `${r[0]}-${r[1]}`;

/** Selection on the code run that scene i belongs to, at absolute t. */
export function selectionAt(story: Story, i: number, t: number, fade = 0.35): Selection {
  const first = story.runOf(i);
  const events: { at: number; ranges: Range[] }[] = [];
  for (let j = first; j <= i && j >= 0; j++) {
    const ts = story.timed[j];
    for (const f of focusOf(story.bundle, ts.id)) events.push({ at: ts.start + f.at, ranges: f.ranges });
  }
  events.sort((a, b) => a.at - b.at);
  let cur: Range[] = [], prev: Range[] = [], at = -Infinity;
  const end = story.timed[i].start + story.timed[i].duration;
  let until = end;
  for (const e of events) {
    if (e.at > t) { until = Math.min(end, e.at); break; }
    prev = cur; cur = e.ranges; at = e.at;
  }
  const k = Number.isFinite(at) ? ramp(t - at, fade) : 1;
  const inP = new Set(prev.map(key)), inC = new Set(cur.map(key));
  return {
    weight: (r) => lerp(inP.has(key(r)) ? 1 : 0, inC.has(key(r)) ? 1 : 0, k),
    any: lerp(prev.length ? 1 : 0, cur.length ? 1 : 0, k),
    cur, prev, since: t - at, span: Math.max(0.1, until - at),
  };
}

/** The current step of a stepped code scene at scene-relative time rel. */
export function stepIndexAt(ts: TimedScene, rel: number) {
  let cur = -1;
  (ts.steps ?? []).forEach((s, i) => { if (rel >= s.start) cur = i; });
  return cur;
}

/** Every range any scene selects on an excerpt (for Code Hike block annotations). */
export function rangesOn(bundle: RenderBundle, excerptId: string): Range[] {
  const out = new Map<string, Range>();
  for (const s of bundle.storyboard.scenes) {
    if (!isCodeScene(s) || (s as CodeScene).excerpt !== excerptId) continue;
    for (const f of focusOf(bundle, s.id)) for (const r of f.ranges) out.set(key(r), r);
  }
  return [...out.values()];
}

export const rangeKey = key;
