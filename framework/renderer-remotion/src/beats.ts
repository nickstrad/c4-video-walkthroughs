// What the storyboard's diagram beats have done to one view by time t: the
// request packet (hops along routed edges), lit boxes and edges, badges, and
// skipped (dimmed) elements with their note. Beats accumulate across every
// scene that shows the view, so a badge set in one scene is still there when
// the story comes back to that diagram. Pure; all timing from play.ts.
import {
  along, hopPath, hopsOf, isDiagramScene, packetLabelAt,
  type Point, type Tone, type View, type Layout,
} from "../../core/src/index.ts";
import { clamp01, easeInOut, ramp } from "./anim.ts";
import type { Story } from "./story.ts";

export type Beats = {
  lit: Record<string, number>; // element visited by the request
  arrive: Record<string, number>; // short pulse as the packet lands
  hot: Record<string, number>; // edge the packet is riding now
  visited: Record<string, number>; // edge the packet has ridden
  dim: Record<string, number>; // skipped element or edge
  badges: { elementId: string; text: string; tone: Tone; k: number }[];
  notes: { text: string; ids: string[]; k: number }[];
  packet?: { at: Point; label: string; k: number };
};

/** Where a resting packet sits: on the box's top edge, so it never covers the label. */
export const dock = (layout: Layout, id: string): Point => {
  const b = layout.boxes[id];
  return { x: b.x + b.w / 2, y: b.y };
};

/** Where a path leaving/entering box `id` at `p` meets the box's top edge. */
const corner = (layout: Layout, id: string, p: Point): Point => {
  const b = layout.boxes[id];
  return { x: Math.max(b.x, Math.min(b.x + b.w, p.x)), y: b.y };
};

/**
 * The packet's full path: from its dock along the source box's top edge,
 * down the routed edge (core's hopPath), and up onto the target's dock.
 */
export function packetPath(view: View, layout: Layout, from: string, to: string): Point[] {
  const route = hopPath(view, layout, from, to);
  const a = route[0], z = route[route.length - 1];
  return [dock(layout, from), corner(layout, from, a), ...route, corner(layout, to, z), dock(layout, to)];
}

export function beatsAt(story: Story, viewId: string, t: number): Beats {
  const { view, layout } = story.view(viewId);
  const out: Beats = { lit: {}, arrive: {}, hot: {}, visited: {}, dim: {}, badges: [], notes: [] };
  const max = (m: Record<string, number>, id: string | undefined, v: number) => {
    if (id) m[id] = Math.max(m[id] ?? 0, v);
  };

  type H = { from: string; to: string; edge?: string; s: number; d: number; scene: number };
  const hops: H[] = [];
  story.scenes.forEach((sc, i) => {
    if (story.viewOf(i) !== viewId) return;
    const ts = story.timed[i];
    for (const h of hopsOf(story.bundle, sc.id))
      hops.push({ from: h.from, to: h.to, edge: h.edge, s: ts.start + h.start, d: h.duration, scene: i });
    if (t < ts.start || !isDiagramScene(sc)) return;
    const cue = (c?: string) => ts.start + (c === undefined ? 0 : ts.cues[c] ?? 0);
    if (sc.badge) {
      const k = ramp(t - cue(sc.badge.cue), 0.4);
      if (k > 0) out.badges.push({ elementId: sc.badge.elementId, text: sc.badge.text, tone: sc.badge.tone, k });
    }
    if (sc.skip) {
      const k = ramp(t - cue(sc.skip.cue), 0.5);
      for (const id of [...sc.skip.elements, ...sc.skip.edges]) max(out.dim, id, k);
      if (sc.skip.note && k > 0) out.notes.push({ text: sc.skip.note, ids: sc.skip.elements, k });
    }
  });
  hops.sort((a, b) => a.s - b.s);

  let last: H | undefined;
  for (const h of hops) {
    if (t < h.s) break;
    last = h;
    const u = (t - h.s) / h.d;
    max(out.lit, h.from, ramp(t - h.s, 0.3));
    max(out.lit, h.to, ramp(u - 0.6, 0.3));
    max(out.arrive, h.to, u >= 0.9 ? Math.max(0, 1 - Math.abs(u - 1.2) / 0.3) : 0);
    max(out.visited, h.edge, ramp(u - 0.1, 0.3));
    max(out.hot, h.edge, u < 1 ? ramp(u, 0.15) : 1 - ramp(t - h.s - h.d, 0.4));
  }

  const label = packetLabelAt(story.bundle, t);
  if (label !== undefined) {
    let at: Point | undefined;
    if (last && t < last.s + last.d) at = along(packetPath(view, layout, last.from, last.to), easeInOut(clamp01((t - last.s) / last.d)));
    else if (last) at = dock(layout, last.to);
    else {
      // Not moved yet: wait on the first hop's source, if that hop is in the playing scene.
      const next = hops[0];
      const ts = next && story.timed[next.scene];
      if (next && t >= ts.start) at = dock(layout, next.from);
    }
    if (at) out.packet = { at, label, k: 1 };
  }
  return out;
}
