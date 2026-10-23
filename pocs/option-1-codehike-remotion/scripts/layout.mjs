// Lays out data/view.json with ELK (layered, left to right, as the dataset's
// layout hint asks) and writes absolute boxes and edge routes for the renderer.
import ELK from "elkjs/lib/elk.bundled.js";
import { readFileSync, writeFileSync } from "node:fs";

const here = new URL("..", import.meta.url).pathname;
const view = JSON.parse(readFileSync(here + "data/view.json", "utf8"));
const W = 210, H = 118, LABEL_FONT = 10, LABEL_W = 150;

// Edge labels wrap at LABEL_W; estimate their box so ELK leaves room.
const wrap = (text) => {
  const words = text.split(" "), lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length * LABEL_FONT * 0.55 > LABEL_W && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  return [...lines, cur];
};
const inside = (n) => n.kind === "component";
const node = (n) => ({ id: n.id, width: W, height: H });
const edges = view.edges.map((e) => {
  const lines = wrap(`${e.n}. ${e.label}`);
  return {
    id: e.id, sources: [e.from], targets: [e.to],
    labels: [{ text: lines.join("\n"), width: LABEL_W, height: lines.length * (LABEL_FONT + 3) }],
  };
});
const graph = {
  id: "root",
  layoutOptions: {
    "elk.algorithm": "layered", "elk.direction": "RIGHT",
    "elk.hierarchyHandling": "INCLUDE_CHILDREN", "elk.edgeRouting": "ORTHOGONAL",
    "elk.spacing.nodeNode": "40", "elk.layered.spacing.nodeNodeBetweenLayers": "70",
    "elk.spacing.edgeLabel": "4", "elk.edgeLabels.inline": "false",
    "elk.padding": "[top=20,left=20,bottom=20,right=20]",
    "elk.json.edgeCoords": "ROOT",
  },
  children: [
    {
      id: view.scope.id,
      layoutOptions: { "elk.padding": "[top=40,left=24,bottom=24,right=24]" },
      children: view.nodes.filter(inside).map(node),
    },
    ...view.nodes.filter((n) => !inside(n)).map(node),
  ],
  edges,
};
const res = await new ELK().layout(graph);

// Flatten nodes to absolute coordinates. Edges already are: elk.json.edgeCoords
// is ROOT (by default ELK reports them relative to the nodes' common parent).
const boxes = {};
const visit = (g, ox, oy) => {
  for (const c of g.children ?? []) {
    boxes[c.id] = { x: ox + c.x, y: oy + c.y, w: c.width, h: c.height };
    visit(c, ox + c.x, oy + c.y);
  }
};
visit(res, 0, 0);
const routes = {};
const collect = (g, ox, oy) => {
  for (const e of g.edges ?? []) {
    const off = (p) => ({ x: ox + p.x, y: oy + p.y });
    const s = e.sections[0];
    routes[e.id] = {
      points: [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map(off),
      label: e.labels?.[0] && { ...off(e.labels[0]), w: e.labels[0].width, h: e.labels[0].height, lines: e.labels[0].text.split("\n") },
    };
  }
  for (const c of g.children ?? []) collect(c, ox + c.x, oy + c.y);
};
collect(res, 0, 0);
writeFileSync(here + "data/layout.json", JSON.stringify({ width: res.width, height: res.height, boxes, routes }, null, 2) + "\n");
console.log(`layout: ${res.width.toFixed(0)}x${res.height.toFixed(0)}, ${Object.keys(boxes).length} boxes, ${Object.keys(routes).length} routes`);
