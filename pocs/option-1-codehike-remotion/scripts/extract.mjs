// Stage 3 (assets): pull the C4 view and the code range named in
// storyboard.json straight from pinned git objects in the book-notes repo,
// and refuse to write anything if the storyboard's anchors don't match.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const REPO = process.env.BOOK_NOTES ?? "/root/Software/book-notes";
const here = new URL("..", import.meta.url).pathname;
const story = JSON.parse(readFileSync(here + "storyboard.json", "utf8"));
const git = (...args) => execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8" });
const fail = (msg) => { console.error("extract: " + msg); process.exit(1); };

// --- diagram view -------------------------------------------------------
const { repoCommit, path: dsPath, viewId } = story.dataset;
const dataset = JSON.parse(git("show", `${repoCommit}:${dsPath}`));
const view = dataset.diagrams.find((d) => d.id === viewId) ?? fail(`no view ${viewId}`);
const els = new Map(dataset.model.elements.map((e) => [e.id, e]));
const rels = new Map(dataset.model.relationships.map((r) => [r.id, r]));
const pick = (e) => ({
  id: e.id, kind: e.kind, name: e.name, description: e.description,
  technology: e.technology ?? null, tags: e.tags ?? [], status: e.status,
});
const scope = els.get(view.scopeId);
const out = {
  provenance: { repo: "nickstrad/book-notes", commit: repoCommit, path: dsPath, datasetRevision: dataset.revision },
  view: { id: view.id, kind: view.kind, title: view.title },
  scope: scope ? pick(scope) : null,
  nodes: view.nodes.map((n) => pick(els.get(n.elementId))),
  edges: view.edges.map((e) => {
    const r = rels.get(e.relationshipId);
    return { id: r.id, n: e.displayNumber, from: r.sourceId, to: r.targetId, label: r.label, technology: r.technology ?? null };
  }),
};
const focus = story.focus;
const el = els.get(focus.elementId) ?? fail(`no element ${focus.elementId}`);
if (!view.nodes.some((n) => n.elementId === focus.elementId)) fail(`${focus.elementId} not in view ${viewId}`);
const src = dataset.sources.find((s) => el.sourceIds.includes(s.id) && s.path === focus.path)
  ?? fail(`element ${focus.elementId} has no source selector for ${focus.path}`);
if (src.revision !== focus.commit) fail(`selector revision ${src.revision} != storyboard ${focus.commit}`);
const selLine = Number(/line (\d+)/.exec(src.notes)?.[1]);
if (selLine !== focus.lines[0]) fail(`selector line ${selLine} != storyboard start ${focus.lines[0]}`);
writeFileSync(here + "data/view.json", JSON.stringify(out, null, 2) + "\n");

// --- code range ---------------------------------------------------------
const tagSha = git("rev-parse", `${focus.tag}^{commit}`).trim();
if (tagSha !== focus.commit) fail(`tag ${focus.tag} -> ${tagSha}, storyboard says ${focus.commit}`);
const file = git("show", `${focus.commit}:${focus.path}`).split("\n");
const [a, b] = focus.lines;
const body = file.slice(a - 1, b);
if (!body[0].startsWith(focus.signature)) fail(`line ${a} is not ${focus.signature}: ${body[0]}`);
if (body.at(-1) !== "}") fail(`line ${b} does not close the function: ${body.at(-1)}`);
for (const s of story.scenes.flatMap((sc) => sc.steps ?? []))
  if (s.lines[0] < a || s.lines[1] > b) fail(`step ${s.id} range ${s.lines} outside ${a}-${b}`);
writeFileSync(here + "data/code.json", JSON.stringify({
  provenance: { repo: "nickstrad/book-notes", commit: focus.commit, tag: focus.tag, path: focus.path, lines: focus.lines, selector: src.notes, url: src.url },
  firstLine: a,
  code: body.join("\n"),
}, null, 2) + "\n");
console.log(`extract: view ${viewId} (${out.nodes.length} nodes, ${out.edges.length} edges) @ ${repoCommit.slice(0, 7)}; ${focus.path}:${a}-${b} @ ${focus.commit.slice(0, 7)}`);
