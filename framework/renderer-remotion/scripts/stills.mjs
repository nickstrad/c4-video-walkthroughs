// node scripts/stills.mjs [projectDir] → <projectDir>/renders/frames/remotion-0N-<scene>.png
// Key moments are picked from the bundle by rule (no hard-coded times):
// a state change after its last beat, the end of a focus zoom, the second step
// of a stepped code scene, and the last state change made during code.
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { prepare } from "./prepare.mjs";
import { COMPOSITION, PROPS, SERVE, bundleFor, projectDirFrom, remotionCli } from "./lib.mjs";

const projectDir = projectDirFrom(process.argv[2]);
const bundle = await prepare(projectDir);
if (!existsSync(resolve(SERVE, "index.html")) || process.argv.includes("--rebundle")) bundleFor(projectDir);

const tl = bundle.timeline;
const scene = (id) => bundle.storyboard.scenes.find((s) => s.id === id);
const timed = tl.scenes;
const cues = (ts) => Object.values(ts.cues);
const moments = [];
const sc = timed.find((t) => t.kind === "state-change");
if (sc) moments.push([sc.id, sc.start + Math.max(0, ...cues(sc)) + 0.9]);
const fe = timed.find((t) => t.kind === "focus-element");
if (fe) moments.push([fe.id, fe.start + fe.duration - 0.2]);
const st = timed.find((t) => t.steps?.length);
if (st) { const s = st.steps[Math.min(1, st.steps.length - 1)]; moments.push([`${st.id}-${s.id}`, st.start + s.start + 1.5]); }
const cs = [...timed].reverse().find((t) => t.kind === "code-explanation" && scene(t.id).state?.length);
if (cs) {
  const last = Math.max(...scene(cs.id).state.map((c) => (c.cue ? cs.cues[c.cue] : 0) + (c.duration ?? 0)));
  moments.push([cs.id, cs.start + Math.min(cs.duration - 0.1, last + 0.6)]);
}

const dir = resolve(projectDir, "renders/frames");
mkdirSync(dir, { recursive: true });
moments.forEach(([what, t], i) => {
  const frame = Math.min(tl.totalFrames - 1, Math.round(t * tl.fps));
  remotionCli(["still", SERVE, COMPOSITION, resolve(dir, `remotion-0${i + 1}-${what}.png`), `--frame=${frame}`, `--props=${PROPS}`, "--image-format=png", "--log=warn"]);
});
