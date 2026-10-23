// View → absolute boxes and orthogonal edge routes, via elkjs (layered, in the
// dataset's layout direction). Salvaged from option 1's scripts/layout.mjs and
// generalised: scope membership comes from the dataset's parentId, not from
// "kind === component", so container and dynamic views lay out too (option 2
// had a hand-placed table for its seven nodes).
import elk from "elkjs/lib/elk.bundled.js";
import type { View } from "./view.ts";
import { BOX, wrap, type Box, type Layout, type Point, type Route } from "./geometry.ts";

export type { Box, Layout, Point, Route };

// elkjs is CommonJS; under NodeNext the default import is module.exports.
type Elk = new () => { layout: (graph: unknown) => Promise<any> };
const ELK = ((elk as { default?: unknown }).default ?? elk) as unknown as Elk;

const DIRECTION: Record<string, string> = { LR: "RIGHT", RL: "LEFT", TB: "DOWN", BT: "UP" };

export async function layoutView(view: View, direction = view.direction): Promise<Layout> {
  const LABEL_FONT = 10, LABEL_W = 150;
  const node = (n: { id: string }) => ({ id: n.id, width: BOX.w, height: BOX.h });
  const edges = view.edges.map((e) => {
    const lines = wrap(`${e.n}. ${e.label}`);
    return {
      id: e.id, sources: [e.from], targets: [e.to],
      labels: [{ text: lines.join("\n"), width: LABEL_W, height: lines.length * (LABEL_FONT + 3) }],
    };
  });
  const inside = view.nodes.filter((n) => n.inScope);
  const outside = view.nodes.filter((n) => !n.inScope);
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered", "elk.direction": DIRECTION[direction] ?? "RIGHT",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN", "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "40", "elk.layered.spacing.nodeNodeBetweenLayers": "70",
      "elk.spacing.edgeLabel": "4", "elk.edgeLabels.inline": "false",
      "elk.padding": "[top=20,left=20,bottom=20,right=20]",
      "elk.json.edgeCoords": "ROOT",
    },
    children: [
      ...(view.scope && inside.length
        ? [{ id: view.scope.id, layoutOptions: { "elk.padding": "[top=40,left=24,bottom=24,right=24]" }, children: inside.map(node) }]
        : inside.map(node)),
      ...outside.map(node),
    ],
    edges,
  };
  const res: any = await new ELK().layout(graph);

  // Flatten nodes to absolute coordinates. Edges already are: elk.json.edgeCoords
  // is ROOT (by default ELK reports them relative to the nodes' common parent).
  const boxes: Record<string, Box> = {};
  const visit = (g: any, ox: number, oy: number) => {
    for (const c of g.children ?? []) {
      boxes[c.id] = { x: ox + c.x, y: oy + c.y, w: c.width, h: c.height };
      visit(c, ox + c.x, oy + c.y);
    }
  };
  visit(res, 0, 0);
  const routes: Record<string, Route> = {};
  const collect = (g: any, ox: number, oy: number) => {
    for (const e of g.edges ?? []) {
      const off = (p: Point) => ({ x: ox + p.x, y: oy + p.y });
      const s = e.sections[0];
      const l = e.labels?.[0];
      routes[e.id] = {
        points: [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map(off),
        label: l && { ...off(l), w: l.width, h: l.height, lines: l.text.split("\n") },
      };
    }
    for (const c of g.children ?? []) collect(c, ox + c.x, oy + c.y);
  };
  collect(res, 0, 0);
  return { width: res.width, height: res.height, boxes, routes };
}
