// Node-side prep for a render: read <project>/build/bundle.json, highlight
// every excerpt with Code Hike (grammar and theme load from node_modules here;
// the browser build would fetch the theme from lighter.codehike.org), add a
// Code Hike "focus" block annotation for every range a scene selects, and
// write out/props.json = { bundle, code } for `remotion render --props`.
import { mkdirSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { highlight } from "codehike/code";
import { OUT, PROPS, projectDirFrom, readBundle } from "./lib.mjs";
import { rangesOn } from "../src/story.ts";

const THEME = "github-dark";
const LANG = { ".go": "go", ".ts": "ts", ".tsx": "tsx", ".js": "js", ".py": "python", ".rs": "rust", ".sql": "sql" };

export async function prepare(projectDir) {
  const bundle = readBundle(projectDir);
  const code = {};
  for (const [id, ex] of Object.entries(bundle.excerpts)) {
    const lang = LANG[extname(ex.path)] ?? extname(ex.path).slice(1);
    const h = await highlight({ value: ex.text, lang, meta: "" }, THEME);
    // Block annotations must not partially overlap; overlapping ranges are
    // left to the per-line handler (CodePanel paints them line by line).
    const kept = [];
    for (const r of rangesOn(bundle, id).sort((a, b) => a[0] - b[0] || b[1] - a[1])) {
      if (r[0] < ex.lines[0] || r[1] > ex.lines[1]) throw new Error(`${id}: range ${r} outside L${ex.lines.join("-")}`);
      if (kept.some((k) => r[0] <= k[1] && k[0] <= r[1])) { console.warn(`prepare: ${id} ${r} overlaps another range; painted per line`); continue; }
      kept.push(r);
      h.annotations.push({
        name: "focus", query: `${r[0]}-${r[1]}`,
        fromLineNumber: r[0] - ex.lines[0] + 1, toLineNumber: r[1] - ex.lines[0] + 1,
      });
    }
    code[id] = h;
    console.log(`prepare: ${id} (${lang}) ${h.tokens.length} tokens, ${kept.length} focus blocks`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(PROPS, JSON.stringify({ bundle, code }));
  console.log(`prepare: wrote ${PROPS} (${bundle.timeline.totalFrames} frames @ ${bundle.timeline.fps} fps)`);
  return bundle;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await prepare(projectDirFrom(process.argv[2]));
