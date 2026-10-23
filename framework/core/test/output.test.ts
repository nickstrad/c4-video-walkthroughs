// Output proof over the committed renders (ffmpeg/ffprobe, no git, no API).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import type { RenderBundle } from "../src/bundle.ts";
import { speechWindows } from "../src/narration/timeline.ts";
import { proveOutput } from "../src/verify/output.ts";

const P = new URL("../../projects/litefleet/", import.meta.url).pathname;
const bundle = JSON.parse(readFileSync(P + "build/bundle.json", "utf8")) as RenderBundle;
const mp4 = P + "renders/remotion.mp4";

test("speech windows split stepped scenes and stay in time order", () => {
  const w = speechWindows(bundle.timeline);
  assert.equal(w.filter((x) => x.id.startsWith("n-acquire.")).length, 5);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].start >= w[i - 1].end - 1e-9, w[i].id);
});

test("output proof passes the committed render and catches a timeline it does not match", { skip: !existsSync(mp4) }, () => {
  assert.deepEqual(proveOutput(mp4, bundle.timeline).errors, []);
  const tl = structuredClone(bundle.timeline);
  tl.totalFrames += 1;
  tl.scenes[0].takes[0].speech = [0, 0.15]; // claims speech where the video is silent
  const errs = proveOutput(mp4, tl).errors.join("\n");
  assert.match(errs, /3050 frames, timeline 3051/);
  assert.match(errs, /s1-request: -\d/);
});
