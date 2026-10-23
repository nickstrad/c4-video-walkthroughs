// Browser-safe layout types and constants (layout.ts runs elkjs in Node).

export type Box = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Route = { points: Point[]; label?: Box & { lines: string[] } };
export type Layout = { width: number; height: number; boxes: Record<string, Box>; routes: Record<string, Route> };

export const BOX = { w: 210, h: 118 };
const LABEL_FONT = 10, LABEL_W = 150; // edge labels; renderers draw them at this size

/** Greedy word wrap at an estimated glyph width (the renderers use the same font size). */
export function wrap(text: string, width = LABEL_W, font = LABEL_FONT): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(" ")) {
    if ((cur + " " + w).trim().length * font * 0.55 > width && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  return [...lines, cur];
}

