// Story-arc tests (docs/story-arc-plan.md items 1, 2, 4, 6, thin 5): the beat
// registry and patterns, the arc rules, descend/settle and responsibilities
// validation, and the arc's play.ts queries over the committed litefleet-arc
// bundle. Pure: no git, no API.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BEATS, focusElementOf, needsOf } from "../src/beats/registry.ts";
import { PATTERNS } from "../src/beats/patterns.ts";
import type { RenderBundle } from "../src/bundle.ts";
import { projectView, type Dataset, type View } from "../src/diagram/view.ts";
import { parsePorcelain, shownExcerpts } from "../src/ingest/blame.ts";
import { approachOf, arcProgressAt, creditLine, repoFactsOf, responsibilitiesOf, videoCreditsOf } from "../src/play.ts";
import type { BeatRole, Storyboard } from "../src/storyboard/schema.ts";
import { validateArc, validateRefs, validateStoryboard } from "../src/storyboard/validate.ts";

const P = new URL("../../projects/litefleet-arc/", import.meta.url).pathname;
const L = new URL("../../projects/litefleet/", import.meta.url).pathname;
const sb = JSON.parse(readFileSync(P + "storyboard.json", "utf8")) as Storyboard;
const ds = JSON.parse(readFileSync(P + sb.sources.dataset.snapshot, "utf8")) as Dataset;
const bundle = JSON.parse(readFileSync(P + "build/bundle.json", "utf8")) as RenderBundle;
const views: Record<string, View> = Object.fromEntries(["context", "containers", "node-components"].map((id) => [id, projectView(ds, id)]));
const edit = (f: (x: Storyboard) => void) => { const x = structuredClone(sb); f(x); return x; };
const act = (x: Storyboard, id: string) => x.acts!.find((a) => a.id === id)!;
const scene = (x: Storyboard, id: string) => x.scenes.find((s) => s.id === id)! as Record<string, unknown>;

test("registry: every role has a definition; reserved roles hold no kinds and no pattern slot", () => {
  const roles: BeatRole[] = ["repo-intro", "architecture", "focus", "deep-dive", "shoutout", "gains", "cold-open", "investigation", "change", "verification"];
  assert.deepEqual(Object.keys(BEATS).sort(), [...roles].sort());
  for (const r of roles) assert.equal(BEATS[r].role, r);
  const slots = Object.values(PATTERNS).flatMap((p) => p.slots.map((s) => s.role));
  for (const r of roles.filter((x) => BEATS[x].reserved)) {
    assert.deepEqual(BEATS[r].kinds, [], r);
    assert.ok(!slots.includes(r), `${r} is reserved but in a pattern`);
  }
  assert.match(BEATS.gains.reserved!, /deferred/);
  assert.deepEqual(PATTERNS.walkthrough.slots.filter((s) => s.required).map((s) => s.role), ["repo-intro", "architecture", "focus", "deep-dive"]);
});

test("the litefleet-arc storyboard holds together; arc-less litefleet is untouched", () => {
  assert.deepEqual(validateRefs(sb, ds), []);
  assert.deepEqual(validateStoryboard(sb, views), []);
  const lf = JSON.parse(readFileSync(L + "storyboard.json", "utf8")) as Storyboard;
  assert.deepEqual(validateArc(lf), []);
  assert.deepEqual([...needsOf(lf)].sort(), ["code", "dataset"]);
  assert.deepEqual([...needsOf(sb)].sort(), ["code", "dataset", "git-blame", "git-log"]);
  assert.equal(focusElementOf(sb), "nd-engine");
  const lfBundle = JSON.parse(readFileSync(L + "build/bundle.json", "utf8")) as RenderBundle;
  assert.equal(lfBundle.repo, undefined);
  assert.equal(lfBundle.credits, undefined);
  assert.equal(arcProgressAt(lfBundle, 10), undefined);
});

test("arc rules: each experiment that breaks the story is named", () => {
  const errs = (x: Storyboard) => validateStoryboard(x, views).join("\n");
  // Dropping the optional shoutout is fine.
  assert.equal(errs(edit((x) => { x.arc!.beats.pop(); })), "");
  // Dropping the arc keeps a valid, arc-less storyboard.
  assert.equal(errs(edit((x) => { delete x.arc; })), "");
  assert.match(errs(edit((x) => { act(x, "credits").role = "gains"; })), /role gains is deferred/);
  assert.match(errs(edit((x) => { act(x, "credits").role = "change"; })), /reserved for the change pattern/);
  assert.match(errs(edit((x) => { x.arc!.pattern = "heist"; })), /unknown pattern heist/);
  assert.match(errs(edit((x) => { x.arc!.beats = x.arc!.beats.filter((b) => b !== "focus"); })), /act focus is outside the arc/);
  assert.match(errs(edit((x) => { x.arc!.beats = x.arc!.beats.filter((b) => b !== "focus"); act(x, "focus").optional = true; })), /requires a focus beat/);
  assert.match(errs(edit((x) => { const b = x.arc!.beats; [b[1], b[2]] = [b[2], b[1]]; })), /out of the storyboard's act order/);
  assert.match(errs(edit((x) => { act(x, "architecture").role = "focus"; })), /architecture-overview is not allowed in a focus beat/);
  assert.match(errs(edit((x) => { delete act(x, "intro").role; })), /beat intro has no role/);
  assert.match(errs(edit((x) => { act(x, "intro").variant = "teaser"; })), /has no variant teaser/);
  assert.match(errs(edit((x) => { delete x.acts; })), /an arc needs acts/);
  // A deep-dive excerpt must be tied to the focus element.
  assert.match(errs(edit((x) => {
    x.excerpts.find((e) => e.id === "deadline")!.elementId = "nd-handles";
    (scene(x, "d-deadline").context as { elementId: string }).elementId = "nd-handles";
  })), /d-deadline: deep-dive excerpt deadline is not tied to the focus element nd-engine/);
});

test("descend, settle and responsibilities are checked against the dataset and cues", () => {
  assert.match(validateRefs(edit((x) => { (scene(x, "a-context").descend as { elementId: string }).elementId = "tenant"; }), ds).join(), /descend element tenant has no detail view in context/);
  assert.match(validateRefs(edit((x) => { (scene(x, "a-containers").descend as { elementId: string }).elementId = "gateway"; }), ds).join(), /must be followed by its detail view gateway-components, not node-components/);
  const errs = (x: Storyboard) => validateStoryboard(x, views).join("\n");
  assert.match(errs(edit((x) => { scene(x, "a-node").descend = { elementId: "nd-engine" }; })), /descend or settle, not both/);
  assert.match(errs(edit((x) => { (scene(x, "a-node").settle as { elementId: string }).elementId = "nope"; })), /element nope not in view node-components/);
  assert.match(errs(edit((x) => { (scene(x, "f-engine").responsibilities as { cue: string }[])[0].cue = "nope"; })), /cue nope is not declared/);
  assert.match(errs(edit((x) => { scene(x, "c-credits").names = ["somebody"]; })), /name somebody is not in any caption/);
});

test("arcProgressAt walks the beats in order", () => {
  const acts = bundle.timeline.acts!;
  const p0 = arcProgressAt(bundle, 0)!;
  assert.equal(p0.index, 0);
  assert.deepEqual(p0.beats.map((b) => b.state), ["current", "todo", "todo", "todo", "todo"]);
  const dd = acts.find((a) => a.id === "deep-dive")!;
  const p = arcProgressAt(bundle, dd.start + dd.duration / 2)!;
  assert.equal(p.index, 3);
  assert.ok(Math.abs(p.within - 0.5) < 1e-6);
  assert.deepEqual(p.beats.map((b) => b.state), ["done", "done", "done", "current", "todo"]);
  assert.equal(p.beats[3].label, "Engine.Query's guards");
  // During the outro the last beat stays current.
  assert.equal(arcProgressAt(bundle, bundle.timeline.total - 0.01)!.index, 4);
  const roles = structuredClone(bundle);
  roles.storyboard.arc!.chrome = { labels: "role" };
  assert.equal(arcProgressAt(roles, 0)!.beats[0].label, "repo-intro");
  roles.storyboard.arc!.chrome = { lowerThird: false };
  assert.equal(arcProgressAt(roles, 0), undefined);
});

test("descend/settle, responsibilities, repo facts and credits come from the bundle", () => {
  const ctx = bundle.timeline.scenes.find((s) => s.id === "a-context")!;
  assert.deepEqual(approachOf(bundle, "a-context"), { elementId: "litefleet", at: ctx.cues.open, mode: "descend" });
  assert.equal(approachOf(bundle, "a-node")!.mode, "settle");
  assert.equal(approachOf(bundle, "f-engine"), undefined);
  const resp = responsibilitiesOf(bundle, "f-engine");
  assert.deepEqual(resp.map((r) => r.label), ["Epoch check", "Per-database lanes", "Tenant and node limits", "2 s statement deadline"]);
  assert.ok(resp.every((r, i) => i === 0 || r.at > resp[i - 1].at));
  const facts = Object.fromEntries(repoFactsOf(bundle, "r-card").map((r) => [r.fact, r.value]));
  assert.equal(facts.commit, `release-it/v1-hardened · ${bundle.repo!.commit.slice(0, 7)}`);
  assert.equal(facts.commits, String(bundle.repo!.commits));
  assert.equal(facts.tags, String(bundle.repo!.tags));
  const cr = videoCreditsOf(bundle);
  const shown = shownExcerpts(sb);
  assert.deepEqual(Object.keys(bundle.credits!.excerpts).sort(), [...shown].sort());
  assert.equal(cr.total, shown.reduce((n, id) => { const x = sb.excerpts.find((e) => e.id === id)!; return n + x.lines[1] - x.lines[0] + 1; }, 0));
  assert.equal(cr.authors.reduce((n, a) => n + a.lines, 0), cr.total);
  assert.equal(cr.commits.reduce((n, c) => n + c.lines, 0), cr.total);
  assert.equal(cr.line, creditLine(bundle.credits!.base));
  assert.match(cr.line, /^release-it\/v1-hardened · 9367863 · /);
});

test("parsePorcelain maps each final line to its commit", () => {
  const a = "a".repeat(40), b = "b".repeat(40);
  const out = [`${a} 10 32 2`, "author x", "summary s", "filename f", "\tline 32", `${a} 11 33`, "\tline 33", `${b} 5 34 1`, "author y", "\tline 34"].join("\n");
  assert.deepEqual(parsePorcelain(out), [{ line: 32, commit: a }, { line: 33, commit: a }, { line: 34, commit: b }]);
});
