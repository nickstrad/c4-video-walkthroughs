// node scripts/stills.mjs [projectDir] [--at=<s>,<s>…] → <projectDir>/renders/frames/remotion-0N-<scene>.png
// Key moments are picked from the bundle by rule (no hard-coded times). With
// an arc: one still per beat, in its last scene, a beat after its last cue
// (else three quarters in). Without: a state change after its last beat, the
// end of a focus zoom, the second step of a stepped code scene, and the last
// state change made during code.
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { prepare } from "./prepare.mjs";
import { COMPOSITION, PROPS, SERVE, bundleFor, projectDirFrom, remotionCli } from "./lib.mjs";

const projectDir = projectDirFrom(process.argv.slice(2).find((a) => !a.startsWith("--")));
const bundle = await prepare(projectDir);
if (!existsSync(resolve(SERVE, "index.html")) || process.argv.includes("--rebundle")) bundleFor(projectDir);

const tl = bundle.timeline;
const scene = (id) => bundle.storyboard.scenes.find((s) => s.id === id);
const timed = tl.scenes;
const cues = (ts) => Object.values(ts.cues);
const moments = [];
const arc = bundle.storyboard.arc;
if (arc) for (const id of arc.beats) {
  const act = tl.acts.find((a) => a.id === id);
  const ts = timed.find((t) => t.id === act.scenes.at(-1));
  const last = Math.max(-1, ...cues(ts));
  moments.push([`${id}-${ts.id}`, ts.start + (last < 0 ? 0.75 * ts.duration : Math.min(ts.duration - 0.3, last + 1.2))]);
}
const sc = arc ? undefined : timed.find((t) => t.kind === "state-change");
if (sc) moments.push([sc.id, sc.start + Math.max(0, ...cues(sc)) + 0.9]);
const fe = arc ? undefined : timed.find((t) => t.kind === "focus-element");
if (fe) moments.push([fe.id, fe.start + fe.duration - 0.2]);
const st = arc ? undefined : timed.find((t) => t.steps?.length);
if (st) { const s = st.steps[Math.min(1, st.steps.length - 1)]; moments.push([`${st.id}-${s.id}`, st.start + s.start + 1.5]); }
const cs = arc ? undefined : [...timed].reverse().find((t) => t.kind === "code-explanation" && scene(t.id).state?.length);
if (cs) {
  const last = Math.max(...scene(cs.id).state.map((c) => (c.cue ? cs.cues[c.cue] : 0) + (c.duration ?? 0)));
  moments.push([cs.id, cs.start + Math.min(cs.duration - 0.1, last + 0.6)]);
}

// Ad-hoc review frames: --at=12.5,40 writes review-<t>.png instead.
const at = process.argv.find((a) => a.startsWith("--at="));
if (at) { moments.length = 0; for (const x of at.slice(5).split(",")) moments.push([`review-${x}`, Number(x)]); }
const dir = resolve(projectDir, at ? "../../renderer-remotion/out/review" : "renders/frames");
mkdirSync(dir, { recursive: true });
moments.forEach(([what, t], i) => {
  const frame = Math.min(tl.totalFrames - 1, Math.round(t * tl.fps));
  remotionCli(["still", SERVE, COMPOSITION, resolve(dir, at ? `${what}.png` : `remotion-0${i + 1}-${what}.png`), `--frame=${frame}`, `--props=${PROPS}`, "--image-format=png", "--log=warn"]);
});
