#!/usr/bin/env node
// c4v: the framework's one build entry point. A project directory holds
// storyboard.json, sources/<dataset snapshot>, and narration/ (committed
// takes); `build` turns it into build/bundle.json + build/track.wav, which is
// all a renderer reads.
//
//   node core/bin/c4v.ts build   <project>   # offline: never calls ElevenLabs
//   node core/bin/c4v.ts verify  <project>   # pinned-git + take + bundle checks
//   node core/bin/c4v.ts narrate <project>   # voice missing takes (spends TTS credits)
//   node core/bin/c4v.ts proof   <project> [mp4…]   # output proof (default: renders/*.mp4)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BUNDLE_SCHEMA, type RenderBundle } from "../src/bundle.ts";
import { pinExcerpts, verifyExcerpts } from "../src/code-source/excerpts.ts";
import { checkoutFor, git } from "../src/code-source/git.ts";
import { layoutView } from "../src/diagram/layout.ts";
import { projectView, type Dataset, type View } from "../src/diagram/view.ts";
import { loadTakes, missingTakes, synthesizeMissing } from "../src/narration/takes.ts";
import { validateTimeline } from "../src/narration/invariants.ts";
import { buildTimeline } from "../src/narration/timeline.ts";
import { mixTrack } from "../src/narration/track.ts";
import { isCodeScene, type Storyboard } from "../src/storyboard/schema.ts";
import { validateRefs, validateStoryboard } from "../src/storyboard/validate.ts";
import { proveOutput } from "../src/verify/output.ts";
import { needsOf } from "../src/beats/registry.ts";
import { ingestCredits } from "../src/ingest/blame.ts";
import { ingestRepo } from "../src/ingest/repo.ts";
import type { Credits, RepoFacts } from "../src/ingest/types.ts";

const [cmd, dirArg, ...rest] = process.argv.slice(2);
if (!cmd || !dirArg || !["build", "verify", "narrate", "proof"].includes(cmd)) {
  console.error("usage: c4v build|verify|narrate <project-dir> | c4v proof <project-dir> [mp4…]");
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
    else if (s.kind !== "credits" && s.view) ids.add(s.view);
  }
  return [...ids];
};
const views = (): Record<string, View> => Object.fromEntries(viewIds().map((id) => [id, projectView(dataset, id)]));
const die = (title: string, errs: string[]) => {
  if (!errs.length) return;
  console.error(`${title}:\n  ${errs.join("\n  ")}`);
  process.exit(1);
};

/** What the beats need ingested from git at the pin; absent keys keep arc-less bundles unchanged. */
function ingest(code: ReturnType<typeof git>): { repo?: RepoFacts; credits?: Credits } {
  const needs = needsOf(sb);
  return {
    ...(needs.has("git-log") ? { repo: ingestRepo(sb, code, dataset) } : {}),
    ...(needs.has("git-blame") ? { credits: ingestCredits(sb, code) } : {}),
  };
}

/** Names a credits scene speaks must be authors blame found. */
function creditNames(credits?: Credits): string[] {
  const authors = new Set(Object.values(credits?.commits ?? {}).map((c) => c.author));
  return sb.scenes.flatMap((s) => (s.kind === "credits" ? (s.names ?? []).filter((n) => !authors.has(n)).map((n) => `${s.id}: names ${n}, who is not an author in the blame of the shown excerpts`) : []));
}

/** The dataset snapshot must be byte-identical to the dataset at its commit. */
function datasetCheck(): string[] {
  const g = git(checkoutFor(sb.sources.dataset.repo));
  const pinned = g.blob(sb.sources.dataset.commit, sb.sources.dataset.path);
  return pinned.equals(datasetBytes) ? [] : [`${sb.sources.dataset.snapshot} differs from ${sb.sources.dataset.path} @ ${sb.sources.dataset.commit.slice(0, 7)}`];
}

async function build() {
  die("dataset refs", validateRefs(sb, dataset));
  const v = views();
  die("storyboard", validateStoryboard(sb, v));
  die("dataset", datasetCheck());
  const code = git(checkoutFor(sb.sources.code.repo));
  const excerpts = pinExcerpts(sb, code, dataset);
  const takes = loadTakes(sb, takesDir);
  const timeline = buildTimeline(sb, takes);
  die("timeline", validateTimeline(timeline, sb, takes));
  const laid: RenderBundle["views"] = {};
  for (const [id, view] of Object.entries(v)) laid[id] = { view, layout: await layoutView(view) };
  const bundle: RenderBundle = {
    schema: BUNDLE_SCHEMA,
    storyboard: sb,
    timeline,
    views: laid,
    excerpts: Object.fromEntries(excerpts.map((x) => [x.id, x])),
    ...ingest(code),
    provenance: {
      dataset: { ...sb.sources.dataset, revision: dataset.revision, sha256: sha256(datasetBytes) } as RenderBundle["provenance"]["dataset"],
      code: { repo: sb.sources.code.repo, tag: sb.sources.code.tag, commit: sb.sources.code.commit },
      builtWith: "framework/core c4v build",
    },
  };
  delete (bundle.provenance.dataset as { snapshot?: string }).snapshot;
  die("credits", creditNames(bundle.credits));
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
  const errs: string[] = validateRefs(sb, dataset);
  die("dataset refs", errs);
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
    const takes = loadTakes(sb, takesDir);
    errs.push(...validateTimeline(bundle.timeline, sb, takes));
    const tl = buildTimeline(sb, takes);
    if (JSON.stringify(tl) !== JSON.stringify(bundle.timeline)) errs.push("bundle timeline is stale; rebuild");
    if (JSON.stringify(bundle.storyboard) !== JSON.stringify(sb)) errs.push("bundle storyboard is stale; rebuild");
    // Ingested git facts must reproduce from the pinned repo.
    const fresh2 = ingest(code);
    if (JSON.stringify(fresh2.repo) !== JSON.stringify(bundle.repo)) errs.push("bundle repo facts do not reproduce from git; rebuild");
    if (JSON.stringify(fresh2.credits) !== JSON.stringify(bundle.credits)) errs.push("bundle credits do not reproduce from git blame; rebuild");
    errs.push(...creditNames(bundle.credits));
  } catch (e) {
    errs.push((e as Error).message);
  }
  die("verify", errs);
  for (const x of excerpts) console.log(`  ok ${x.id.padEnd(13)} ${x.displayPath}:${x.lines.join("-")} @ ${x.commit.slice(0, 7)} blob ${x.blob.slice(0, 7)} sha256 ${x.sha256.slice(0, 12)} (${Buffer.byteLength(x.text)} B byte-identical)`);
  console.log(`  ok every view, element, relationship and scenario step the storyboard names is in the dataset`);
  console.log(`  ok dataset snapshot byte-identical to ${sb.sources.dataset.path} @ ${sb.sources.dataset.commit.slice(0, 7)}`);
  if (bundle.repo) console.log(`  ok repo facts reproduce from git @ ${bundle.repo.commit.slice(0, 7)}: ${bundle.repo.commits} commits, ${bundle.repo.tags} tags, ${bundle.repo.firstDate} → ${bundle.repo.lastDate}, ${bundle.repo.authors.length} author(s) in ${bundle.repo.scope || "the repo"}`);
  if (bundle.credits) console.log(`  ok credits reproduce from git blame: ${Object.values(bundle.credits.excerpts).reduce((n, x) => n + x.lines.length, 0)} lines over ${Object.keys(bundle.credits.excerpts).length} shown excerpts, ${Object.keys(bundle.credits.commits).length} commits; spoken names are credited authors`);
  if (sb.arc) console.log(`  ok arc ${sb.arc.pattern}: ${sb.arc.beats.map((id) => sb.acts?.find((a) => a.id === id)?.role).join(" → ")}`);
  console.log(`  ok ${Object.keys(loadTakes(sb, takesDir)).length} takes match their spoken text and model; timeline invariants hold; bundle timeline reproduces`);
  console.log("verify: pass");
}

/** Prove each rendered MP4 against the committed bundle's timeline. */
function proof() {
  const { timeline } = JSON.parse(readFileSync(path.join(buildDir, "bundle.json"), "utf8")) as RenderBundle;
  const rendersDir = path.join(dir, "renders");
  const files = rest.length ? rest.map((f) => path.resolve(f))
    : existsSync(rendersDir) ? readdirSync(rendersDir).filter((f) => f.endsWith(".mp4")).map((f) => path.join(rendersDir, f)) : [];
  if (!files.length) die("proof", ["no MP4 to prove"]);
  const errs: string[] = [];
  for (const f of files) {
    const p = proveOutput(f, timeline);
    const v = p.video, a = p.audio;
    console.log(`  ${path.relative(dir, f)}: ${p.bytes} B · ${v?.codec} ${v?.width}x${v?.height} ${v?.fps} ${v?.frames} frames ${v?.duration} s · ${a?.codec} ${a?.sampleRate} Hz ${a?.channels} ch ${a?.duration} s · faststart ${p.faststart} · quietest line ${p.quietestLine?.id} ${p.quietestLine?.db} dB · loudest pause ${p.loudestPause?.db} dB`);
    errs.push(...p.errors.map((e) => `${path.relative(dir, f)}: ${e}`));
  }
  die("proof", errs);
  console.log(`proof: pass (${files.length} file${files.length > 1 ? "s" : ""})`);
}

if (cmd === "build") await build();
else if (cmd === "verify") verify();
else if (cmd === "proof") proof();
else {
  const missing = missingTakes(sb, takesDir);
  if (!missing.length) console.log("narrate: every take is on disk; nothing to voice (0 characters)");
  else console.log(`narrate: voiced ${await synthesizeMissing(sb, takesDir)} characters`);
}
