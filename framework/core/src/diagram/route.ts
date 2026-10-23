// Pure geometry over a laid-out view, shared by both renderers so a request
// packet follows the same path whichever engine draws it.
import type { Box, Layout, Point } from "./geometry.ts";
import type { View } from "./view.ts";

export const centre = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/**
 * The path a packet rides from one element to another: the routed edge
 * between them (reversed for replies), else a straight centre-to-centre line.
 */
export function hopPath(view: View, layout: Layout, from: string, to: string): Point[] {
  const fwd = view.edges.find((e) => e.from === from && e.to === to);
  const rev = view.edges.find((e) => e.from === to && e.to === from);
  const r = fwd ? layout.routes[fwd.id] : rev ? layout.routes[rev.id] : undefined;
  if (r) return fwd ? r.points : [...r.points].reverse();
  return [centre(layout.boxes[from]), centre(layout.boxes[to])];
}

/** Point at fraction u ∈ [0, 1] of a polyline's length. */
export function along(points: Point[], u: number): Point {
  const seg = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, u)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return { x: points[i].x + (points[i + 1].x - points[i].x) * k, y: points[i].y + (points[i + 1].y - points[i].y) * k };
    }
    d -= seg[i];
  }
  return points[0];
}

/** Camera fit: scale and offset that place `region` inside a viewport box. */
export function fit(region: Box, viewport: Box, margin = 30) {
  const scale = Math.min((viewport.w - 2 * margin) / region.w, (viewport.h - 2 * margin) / region.h);
  return { scale, cx: region.x + region.w / 2, cy: region.y + region.h / 2 };
}
