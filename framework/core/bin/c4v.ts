#!/usr/bin/env node
// c4v: the framework's one build entry point. A project directory holds
// storyboard.json, sources/<dataset snapshot>, and narration/ (committed
// takes); `build` turns it into build/bundle.json + build/track.wav, which is
// all a renderer reads.
//
//   node core/bin/c4v.ts build   <project>   # offline: never calls ElevenLabs
//   node core/bin/c4v.ts verify  <project>   # pinned-git + take + bundle checks
//   node core/bin/c4v.ts narrate <project>   # voice missing takes (spends TTS credits)
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BUNDLE_SCHEMA, type RenderBundle } from "../src/bundle.ts";
import { pinExcerpts, verifyExcerpts } from "../src/code-source/excerpts.ts";
import { checkoutFor, git } from "../src/code-source/git.ts";
import { layoutView } from "../src/diagram/layout.ts";
import { projectView, type Dataset, type View } from "../src/diagram/view.ts";
import { loadTakes, missingTakes, synthesizeMissing } from "../src/narration/takes.ts";
import { buildTimeline } from "../src/narration/timeline.ts";
import { mixTrack } from "../src/narration/track.ts";
import { isCodeScene, type Storyboard } from "../src/storyboard/schema.ts";
import { validateStoryboard } from "../src/storyboard/validate.ts";

const [cmd, dirArg] = process.argv.slice(2);
if (!cmd || !dirArg || !["build", "verify", "narrate"].includes(cmd)) {
  console.error("usage: c4v build|verify|narrate <project-dir>");
  process.exit(2);
}
const dir = path.resolve(dirArg);
const sb = JSON.parse(readFileSync(path.join(dir, "storyboard.json"), "utf8")) as Storyboard;
const takesDir = path.join(dir, "narration");
const buildDir = path.join(dir, "build");
const datasetBytes = readFileSync(path.join(dir, sb.sources.dataset.snapshot));
const dataset = JSON.parse(datasetBytes.toString("utf8")) as Dataset;
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

const viewIds = () => {
  const ids = new Set<string>();
  for (const s of sb.scenes) {
    if (isCodeScene(s)) { if (s.context) ids.add(s.context.view); }
    else ids.add(s.view);
  }
  return [...ids];
};
const views = (): Record<string, View> => Object.fromEntries(viewIds().map((id) => [id, projectView(dataset, id)]));
const die = (title: string, errs: string[]) => {
  if (!errs.length) return;
  console.error(`${title}:\n  ${errs.join("\n  ")}`);
  process.exit(1);
};

/** The dataset snapshot must be byte-identical to the dataset at its commit. */
function datasetCheck(): string[] {
  const g = git(checkoutFor(sb.sources.dataset.repo));
  const pinned = g.blob(sb.sources.dataset.commit, sb.sources.dataset.path);
  return pinned.equals(datasetBytes) ? [] : [`${sb.sources.dataset.snapshot} differs from ${sb.sources.dataset.path} @ ${sb.sources.dataset.commit.slice(0, 7)}`];
}

async function build() {
  const v = views();
  die("storyboard", validateStoryboard(sb, v));
  die("dataset", datasetCheck());
  const code = git(checkoutFor(sb.sources.code.repo));
  const excerpts = pinExcerpts(sb, code, dataset);
  const takes = loadTakes(sb, takesDir);
  const timeline = buildTimeline(sb, takes);
  const laid: RenderBundle["views"] = {};
  for (const [id, view] of Object.entries(v)) laid[id] = { view, layout: await layoutView(view) };
  const bundle: RenderBundle = {
    schema: BUNDLE_SCHEMA,
    storyboard: sb,
    timeline,
    views: laid,
    excerpts: Object.fromEntries(excerpts.map((x) => [x.id, x])),
    provenance: {
      dataset: { ...sb.sources.dataset, revision: dataset.revision, sha256: sha256(datasetBytes) } as RenderBundle["provenance"]["dataset"],
      code: { repo: sb.sources.code.repo, tag: sb.sources.code.tag, commit: sb.sources.code.commit },
      builtWith: "framework/core c4v build",
    },
  };
  delete (bundle.provenance.dataset as { snapshot?: string }).snapshot;
  mkdirSync(buildDir, { recursive: true });
  writeFileSync(path.join(buildDir, "bundle.json"), JSON.stringify(bundle, null, 1) + "\n");
  writeFileSync(path.join(buildDir, timeline.audio.file), mixTrack(timeline, takesDir));
  console.log(`build: ${sb.scenes.length} scenes, ${Object.keys(laid).length} views, ${excerpts.length} excerpts; ${timeline.totalFrames} frames = ${timeline.total} s`);
  for (const s of timeline.scenes) {
    const steps = s.steps ? ` steps ${s.steps.map((x) => (x.end - x.start).toFixed(2)).join(" / ")}` : "";
    console.log(`  ${s.id.padEnd(14)} ${s.start.toFixed(2).padStart(6)} +${s.duration.toFixed(2)}  speech ${s.speech[1].toFixed(2)}  ${JSON.stringify(s.cues)}${steps}`);
  }
}

function verify() {
  const errs: string[] = [];
  errs.push(...validateStoryboard(sb, views()));
  errs.push(...datasetCheck());
  const bundle = JSON.parse(readFileSync(path.join(buildDir, "bundle.json"), "utf8")) as RenderBundle;
  const code = git(checkoutFor(sb.sources.code.repo));
  const excerpts = Object.values(bundle.excerpts);
  errs.push(...verifyExcerpts(excerpts, code));
  // The committed bundle must be what this storyboard + these takes produce.
  try {
    const fresh = pinExcerpts(sb, code, dataset);
    for (const x of fresh) if (JSON.stringify(x) !== JSON.stringify(bundle.excerpts[x.id])) errs.push(`bundle excerpt ${x.id} is stale; rebuild`);
    const tl = buildTimeline(sb, loadTakes(sb, takesDir));
    if (JSON.stringify(tl) !== JSON.stringify(bundle.timeline)) errs.push("bundle timeline is stale; rebuild");
    if (JSON.stringify(bundle.storyboard) !== JSON.stringify(sb)) errs.push("bundle storyboard is stale; rebuild");
  } catch (e) {
    errs.push((e as Error).message);
  }
  die("verify", errs);
  for (const x of excerpts) console.log(`  ok ${x.id.padEnd(13)} ${x.displayPath}:${x.lines.join("-")} @ ${x.commit.slice(0, 7)} blob ${x.blob.slice(0, 7)} sha256 ${x.sha256.slice(0, 12)} (${Buffer.byteLength(x.text)} B byte-identical)`);
  console.log(`  ok dataset snapshot byte-identical to ${sb.sources.dataset.path} @ ${sb.sources.dataset.commit.slice(0, 7)}`);
  console.log(`  ok ${sb.scenes.length} takes match their spoken text; bundle timeline reproduces`);
  console.log("verify: pass");
}

if (cmd === "build") await build();
else if (cmd === "verify") verify();
else {
  const missing = missingTakes(sb, takesDir);
  if (!missing.length) console.log("narrate: every scene has a take; nothing to voice (0 characters)");
  else console.log(`narrate: voiced ${await synthesizeMissing(sb, takesDir)} characters`);
}
