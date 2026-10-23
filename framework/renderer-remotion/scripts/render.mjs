// node scripts/render.mjs [projectDir] → <projectDir>/renders/remotion.mp4
// prepare (Node highlight → out/props.json), bundle once, render the MP4.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { prepare } from "./prepare.mjs";
import { COMPOSITION, RENDER_FLAGS, SERVE, bundleFor, projectDirFrom, remotionCli } from "./lib.mjs";

const projectDir = projectDirFrom(process.argv[2]);
const out = resolve(projectDir, "renders/remotion.mp4");
const t0 = Date.now();
await prepare(projectDir);
bundleFor(projectDir);
mkdirSync(resolve(projectDir, "renders"), { recursive: true });
remotionCli(["render", SERVE, COMPOSITION, out, ...RENDER_FLAGS]);
console.log(`render: ${out} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
