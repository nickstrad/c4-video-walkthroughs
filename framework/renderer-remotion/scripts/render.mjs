// node scripts/render.mjs [projectDir] → <projectDir>/renders/remotion.mp4
// prepare (Node highlight → out/props.json), bundle once, render the MP4,
// then fail unless it passes core's output proof against the timeline.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { proveOutput } from "../../core/src/verify/output.ts";
import { prepare } from "./prepare.mjs";
import { COMPOSITION, RENDER_FLAGS, SERVE, bundleFor, projectDirFrom, readBundle, remotionCli } from "./lib.mjs";

const projectDir = projectDirFrom(process.argv[2]);
const out = resolve(projectDir, "renders/remotion.mp4");
const t0 = Date.now();
await prepare(projectDir);
bundleFor(projectDir);
mkdirSync(resolve(projectDir, "renders"), { recursive: true });
remotionCli(["render", SERVE, COMPOSITION, out, ...RENDER_FLAGS]);
console.log(`render: ${out} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const proof = proveOutput(out, readBundle(projectDir).timeline);
if (proof.errors.length) {
  console.error(`render: FAILED proof: ${proof.errors.join("; ")}`);
  process.exit(1);
}
console.log(`render: proof pass (${proof.video.frames} frames, audio ${proof.audio.duration} s, ${proof.bytes} B)`);
