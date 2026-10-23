// Diagram cameras. A camera says which layout point sits at the centre of the
// frame and at what scale; Diagram turns that into a CSS transform. Cameras
// are functions of scene-relative time so a scene can move within itself
// (the focus zoom); scene-to-scene moves are blends between cameras (Walkthrough.tsx).
import { fit, type Box, type Layout, type View } from "../../core/src/index.ts";
import { lerp, ramp } from "./anim.ts";

export type Cam = { scale: number; cx: number; cy: number };
export type Camera = (rel: number, frame: Box) => Cam;

/** Scale blends in log space so zooms feel even; the centre moves linearly. */
export const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  scale: Math.exp(lerp(Math.log(a.scale), Math.log(b.scale), k)),
  cx: lerp(a.cx, b.cx, k),
  cy: lerp(a.cy, b.cy, k),
});

export function bbox(layout: Layout, ids: string[]): Box {
  const bs = ids.map((id) => layout.boxes[id]).filter(Boolean);
  if (!bs.length) return { x: 0, y: 0, w: layout.width, h: layout.height };
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
  const x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Frame `region`, never closer than `maxScale`, and keep the visible window
 * inside the laid-out view so a clamped camera shows no empty board.
 */
export function frameRegion(layout: Layout, region: Box, frame: Box, maxScale: number, margin = 24): Cam {
  const f = fit(region, frame, margin);
  const scale = Math.min(f.scale, maxScale);
  const keep = (c: number, half: number, size: number) => (size <= 2 * half ? size / 2 : Math.max(half, Math.min(size - half, c)));
  return {
    scale,
    cx: keep(f.cx, frame.w / 2 / scale, layout.width),
    cy: keep(f.cy, frame.h / 2 / scale, layout.height),
  };
}

const whole = (layout: Layout): Box => ({ x: 0, y: 0, w: layout.width, h: layout.height });

/** The camera kinds the scene registry builds shots from. */
export const cameras = {
  /** Fit the whole view. */
  whole: (layout: Layout): Camera => (_rel, frame) => frameRegion(layout, whole(layout), frame, 4, 16),
  /** Follow a set of elements (a hop's ends, a badge, skipped boxes), no closer than maxScale. */
  follow: (layout: Layout, ids: string[], maxScale = 0.92): Camera => (_rel, frame) =>
    frameRegion(layout, bbox(layout, ids), frame, maxScale),
  /** An element and its neighbours in the view: the reduced context placement. */
  around: (view: View, layout: Layout, id: string | undefined, maxScale = 1): Camera => {
    if (!id) return cameras.whole(layout);
    const ids = [id, ...view.edges.flatMap((e) => (e.from === id ? [e.to] : e.to === id ? [e.from] : []))];
    return (_rel, frame) => frameRegion(layout, bbox(layout, ids), frame, maxScale, 12);
  },
  /** Whole view, then fly in until the element spans `fill` of the frame width. */
  zoom: (layout: Layout, id: string, t0: number, t1: number, fill = 0.45): Camera => (rel, frame) => {
    const from = frameRegion(layout, whole(layout), frame, 4, 16);
    const b = layout.boxes[id];
    const to: Cam = { scale: (frame.w * fill) / b.w, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
    return mixCam(from, to, ramp(rel - t0, t1 - t0));
  },
};
