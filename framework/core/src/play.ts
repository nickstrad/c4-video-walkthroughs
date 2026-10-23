// Pure playback queries over a bundle: "what is true at time t". Both
// renderers ask these instead of re-deriving timing from the storyboard, so a
// highlight, a hop or a state change lands on the same word in either engine.
// Times are seconds; `rel` means relative to the scene start.
import type { RenderBundle } from "./bundle.ts";
import type { TimedAct, TimedScene } from "./narration/types.ts";
import { contextAt, isCodeScene, viewAt, type CodeContext, type Hop, type Range, type Scene, type StateChange } from "./storyboard/schema.ts";
import type { View } from "./diagram/view.ts";

export const sceneOf = (b: RenderBundle, id: string): Scene => {
  const s = b.storyboard.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`no scene ${id}`);
  return s;
};
export const timedOf = (b: RenderBundle, id: string): TimedScene => {
  const s = b.timeline.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`no timed scene ${id}`);
  return s;
};
/** Cue time relative to its scene; undefined cue → 0 (the scene start). */
export const cueAt = (t: TimedScene, cue?: string): number => {
  if (cue === undefined) return 0;
  const v = t.cues[cue];
  if (v === undefined) throw new Error(`no cue ${t.id}.${cue}`);
  return v;
};

/** The scene playing at absolute time t (the last one during the outro). */
export const sceneAt = (b: RenderBundle, t: number): TimedScene =>
  b.timeline.scenes.find((s) => t >= s.start && t < s.start + s.duration) ?? b.timeline.scenes.at(-1)!;

export const captionAt = (b: RenderBundle, t: number) => b.timeline.captions.find((c) => t >= c.start && t < c.end);

const indexOf = (b: RenderBundle, id: string) => {
  const i = b.storyboard.scenes.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`no scene ${id}`);
  return i;
};

/** The context diagram a code scene keeps on screen, inherited along a run of one excerpt. */
export const contextOf = (b: RenderBundle, sceneId: string): CodeContext | undefined =>
  contextAt(b.storyboard.scenes, indexOf(b, sceneId));

/** The view a scene draws (diagram scenes) or keeps as context (code scenes). */
export const viewOf = (b: RenderBundle, sceneId: string): string | undefined =>
  viewAt(b.storyboard.scenes, indexOf(b, sceneId));

/** When a code scene's pane appears if it is not on screen yet (rel): its `enter` cue, else 0. */
export const codeEnterOf = (b: RenderBundle, sceneId: string): number => {
  const sc = sceneOf(b, sceneId);
  return isCodeScene(sc) ? cueAt(timedOf(b, sceneId), sc.enter) : 0;
};

/** The edge a hop rides: the named one, else whichever edge joins its ends. */
export const hopEdge = (view: View, h: Pick<Hop, "from" | "to" | "edge">): string | undefined =>
  h.edge ?? view.edges.find((e) => (e.from === h.from && e.to === h.to) || (e.from === h.to && e.to === h.from))?.id;

export type TimedHop = Hop & { edge: string; view: string; start: number; duration: number; sceneId: string };
/**
 * A scene's hops with start/duration resolved (rel) and the edge each one
 * lights named, so every renderer lights the same edge. `arrive` hops end on
 * their cue.
 */
export function hopsOf(b: RenderBundle, sceneId: string): TimedHop[] {
  const sc = sceneOf(b, sceneId), t = timedOf(b, sceneId);
  if (!sc.hops?.length) return [];
  const viewId = viewOf(b, sceneId);
  const v = viewId && b.views[viewId]?.view;
  if (!v) throw new Error(`${sceneId}: hops need a view`);
  return sc.hops.map((h) => {
    const edge = hopEdge(v, h);
    if (!edge) throw new Error(`${sceneId}: no edge joins ${h.from} and ${h.to} in ${v.id}`);
    const duration = h.duration ?? 1.1;
    const at = cueAt(t, h.cue) + (h.after ?? 0);
    return { ...h, edge, view: v.id, duration, start: Math.max(0, h.arrive ? at - duration : at), sceneId };
  });
}

export type FocusEntry = { at: number; ranges: Range[]; stepId?: string; skipped?: boolean };
/**
 * Selection timeline of a code scene: ranges and when each takes over (rel).
 * `skipped` marks lines shown but not executed, for a renderer's own treatment.
 */
export function focusOf(b: RenderBundle, sceneId: string): FocusEntry[] {
  const sc = sceneOf(b, sceneId), t = timedOf(b, sceneId);
  if (!isCodeScene(sc)) return [];
  const flag = (skipped?: boolean) => (skipped ? { skipped } : {});
  if (sc.steps) return sc.steps.map((st, i) => ({ at: t.steps![i].start, ranges: [st.lines], stepId: st.id, ...flag(st.skipped) }));
  return (sc.focus ?? []).map((f) => ({ at: cueAt(t, f.cue), ranges: f.ranges, ...flag(f.skipped) }));
}

/** The act playing at absolute t, if the storyboard declares acts (the last one during the outro). */
export const actAt = (b: RenderBundle, t: number): TimedAct | undefined =>
  b.timeline.acts?.find((a) => t >= a.start && t < a.start + a.duration) ?? (t >= 0 ? b.timeline.acts?.at(-1) : undefined);

export type StateEvent = StateChange & { at: number; sceneId: string }; // at: absolute
/** Every state-panel change in the video, in time order (absolute). */
export function stateEvents(b: RenderBundle): StateEvent[] {
  const out: StateEvent[] = [];
  for (const sc of b.storyboard.scenes) {
    const t = timedOf(b, sc.id);
    for (const c of sc.state ?? []) out.push({ ...c, at: t.start + cueAt(t, c.cue), sceneId: sc.id });
  }
  return out.sort((x, y) => x.at - y.at);
}

/** State-panel values at absolute t; counters tween linearly over `duration`. */
export function stateAt(b: RenderBundle, t: number) {
  const vals: Record<string, { value: string | number; tone?: string }> = {};
  for (const f of b.storyboard.statePanel?.fields ?? []) vals[f.id] = { value: f.initial };
  for (const e of stateEvents(b)) {
    if (t < e.at) break;
    const prev = vals[e.field].value;
    const d = e.duration ?? 0;
    const k = d > 0 ? Math.min(1, (t - e.at) / d) : 1;
    const value = typeof e.value === "number" && typeof prev === "number" ? prev + (e.value - prev) * k : e.value;
    vals[e.field] = { value, tone: e.tone };
  }
  return vals;
}

/** Packet label at absolute t: the latest `packet` change at or before t. */
export function packetLabelAt(b: RenderBundle, t: number): string | undefined {
  let label: string | undefined;
  for (const sc of b.storyboard.scenes) {
    if (!sc.packet) continue;
    const ts = timedOf(b, sc.id);
    if (t >= ts.start + cueAt(ts, sc.packet.cue)) label = sc.packet.label;
  }
  return label;
}
