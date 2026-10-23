// Pure-function tests over the committed litefleet project (no git, no API).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { lineBytes } from "../src/code-source/excerpts.ts";
import { hopPath, along } from "../src/diagram/route.ts";
import { projectView, type Dataset } from "../src/diagram/view.ts";
import type { RenderBundle } from "../src/bundle.ts";
import { validateTimeline } from "../src/narration/invariants.ts";
import { buildTimeline, lastSpoken } from "../src/narration/timeline.ts";
import type { TakeRecord } from "../src/narration/types.ts";
import { focusOf, hopsOf, packetLabelAt, stateAt } from "../src/play.ts";
import { spokenText, type Storyboard } from "../src/storyboard/schema.ts";
import { validateStoryboard } from "../src/storyboard/validate.ts";

const P = new URL("../../projects/litefleet/", import.meta.url).pathname;
const sb = JSON.parse(readFileSync(P + "storyboard.json", "utf8")) as Storyboard;
const ds = JSON.parse(readFileSync(P + sb.sources.dataset.snapshot, "utf8")) as Dataset;
const takes = Object.fromEntries(sb.scenes.map((s) => [s.id, JSON.parse(readFileSync(`${P}narration/${s.id}.alignment.json`, "utf8")) as TakeRecord]));
const bundle = JSON.parse(readFileSync(P + "build/bundle.json", "utf8")) as RenderBundle;

test("lastSpoken skips closing punctuation", () => {
  assert.equal(lastSpoken("Hello, world."), 11);
  assert.equal(lastSpoken("at once…?!"), 6);
});

test("storyboard validates against its views", () => {
  const views = { "query-flow": projectView(ds, "query-flow"), "node-components": projectView(ds, "node-components") };
  assert.deepEqual(validateStoryboard(sb, views), []);
  const bad = structuredClone(sb);
  (bad.scenes[0] as { hops: { to: string }[] }).hops[0].to = "nope";
  assert.match(validateStoryboard(bad, views)[0], /element nope not in view query-flow/);
});

test("timeline reproduces option 2's scene timings and option 1's step timings", () => {
  const tl = buildTimeline(sb, takes);
  const opt2 = JSON.parse(readFileSync(new URL("../../../pocs/option-2-motion-canvas/narration/timeline.json", import.meta.url), "utf8"));
  for (const s of opt2.scenes) {
    const t = tl.scenes.find((x) => x.id === s.id)!;
    assert.equal(t.frames, Math.round(s.duration * opt2.fps), s.id);
    assert.deepEqual(t.cues, s.cues, s.id);
  }
  const steps = tl.scenes.find((x) => x.id === "n-acquire")!.steps!.map((s) => +(s.end - s.start).toFixed(2));
  // Option 1 measured 4.88 / 8.27 / 7.38 / 7.73 / 5.43; the last step is shorter
  // now because the scene ends at the last spoken letter, not the final ".".
  assert.deepEqual(steps.slice(0, 4), [4.88, 8.27, 7.38, 7.73]);
  assert.ok(steps[4] < 5.43);
  assert.equal(tl.totalFrames, tl.scenes.reduce((n, s) => n + s.frames, 0) + 12);
});

test("a stale take is refused", () => {
  const edited = structuredClone(sb);
  edited.scenes[1].caption = "HAProxy picks any gateway.";
  delete edited.scenes[1].speech;
  assert.throws(() => buildTimeline(edited, takes), /text changed/);
  assert.equal(spokenText(sb.scenes[1]), takes["s2-balance"].text);
});

test("lineBytes keeps exact bytes", () => {
  const f = Buffer.from("a\n\tb\nc\n");
  assert.equal(lineBytes(f, [2, 3]).toString(), "\tb\nc");
  assert.throws(() => lineBytes(f, [3, 4]));
});

test("playback queries", () => {
  const s10 = bundle.timeline.scenes.find((s) => s.id === "s10-caps")!;
  const f = focusOf(bundle, "s10-caps");
  assert.deepEqual(f.map((x) => x.ranges.length), [1, 2]);
  assert.equal(f[1].at, s10.cues.bytes);
  assert.equal(stateAt(bundle, s10.start + s10.cues.truncated + 0.01).truncated.value, "true");
  assert.equal(stateAt(bundle, 0).rows.value, 0);
  const reply = hopsOf(bundle, "s11-reply");
  assert.ok(Math.abs(reply[2].start + reply[2].duration - bundle.timeline.scenes.at(-1)!.cues.tenant) < 1e-9);
  assert.equal(packetLabelAt(bundle, 0.1), "SELECT … + API key");
  const qf = bundle.views["query-flow"];
  const back = hopPath(qf.view, qf.layout, "node", "gateway");
  assert.deepEqual(back[0], qf.layout.routes.forward.points.at(-1));
  assert.deepEqual(along(back, 1), back.at(-1));
});

test("timeline invariants hold, and catch a retime regression", () => {
  const tl = buildTimeline(sb, takes);
  assert.deepEqual(validateTimeline(tl, sb, takes), []);
  const bad = structuredClone(tl);
  bad.scenes[3].startFrame += 1;
  bad.scenes[5].speech[1] = bad.scenes[5].duration - 0.1;
  bad.captions[2].end = bad.captions[3].start + 0.5;
  const errs = validateTimeline(bad, sb, takes).join("\n");
  assert.match(errs, /starts at frame/);
  assert.match(errs, /less than 0.3 s before the cut/);
  assert.match(errs, /caption overlaps/);
  const wrongModel = { ...takes, "s1-request": { ...takes["s1-request"], model: "eleven_flash_v2" } };
  assert.match(validateTimeline(tl, sb, wrongModel).join(), /voiced with eleven_flash_v2/);
});
