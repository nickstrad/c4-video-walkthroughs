// Git-backed ingestion (items 4 and thin 5): the committed litefleet-arc
// bundle's repo facts and credits reproduce from the pinned checkout.
// Skipped when the book-notes checkout is absent.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { RenderBundle } from "../src/bundle.ts";
import { checkoutFor, git } from "../src/code-source/git.ts";
import type { Dataset } from "../src/diagram/view.ts";
import { ingestCredits } from "../src/ingest/blame.ts";
import { ingestRepo } from "../src/ingest/repo.ts";
import type { Storyboard } from "../src/storyboard/schema.ts";

const P = new URL("../../projects/litefleet-arc/", import.meta.url).pathname;
const sb = JSON.parse(readFileSync(P + "storyboard.json", "utf8")) as Storyboard;
const ds = JSON.parse(readFileSync(P + sb.sources.dataset.snapshot, "utf8")) as Dataset;
const bundle = JSON.parse(readFileSync(P + "build/bundle.json", "utf8")) as RenderBundle;
let dir: string | undefined;
try { dir = checkoutFor(sb.sources.code.repo); } catch { /* no checkout */ }

test("repo facts reproduce from git at the pin", { skip: !dir }, () => {
  const r = ingestRepo(sb, git(dir!), ds);
  assert.deepEqual(r, bundle.repo);
  assert.equal(r.commit, sb.sources.code.commit);
  assert.equal(r.scope, "books/release-it/project");
  assert.ok(r.commits > 0 && r.tags > 0 && r.firstDate <= r.lastDate);
  assert.equal(r.authors.reduce((n, a) => n + a.commits, 0), r.commits);
});

test("credits reproduce from git blame over the shown excerpts", { skip: !dir }, () => {
  const c = ingestCredits(sb, git(dir!));
  assert.deepEqual(c, bundle.credits);
  for (const [id, x] of Object.entries(c.excerpts)) {
    const spec = sb.excerpts.find((e) => e.id === id)!;
    assert.deepEqual(x.lines.map((l) => l.line), Array.from({ length: spec.lines[1] - spec.lines[0] + 1 }, (_, i) => spec.lines[0] + i));
    for (const l of x.lines) assert.ok(c.commits[l.commit], `${id}:${l.line} names a recorded commit`);
  }
});
