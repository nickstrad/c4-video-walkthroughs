// Code-source pinning over a fake git (no checkout needed).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { pinExcerpts } from "../src/code-source/excerpts.ts";
import type { Git } from "../src/code-source/git.ts";
import { citation } from "../src/code-source/types.ts";
import type { Dataset } from "../src/diagram/view.ts";
import type { Storyboard } from "../src/storyboard/schema.ts";

const V0 = "a".repeat(40), V1 = "b".repeat(40);
const files: Record<string, string> = {
  [`${V0}:src/q.go`]: "package q\n\nfunc Query() {\n\treturn\n}\n",
  [`${V1}:src/q.go`]: "package q\n\nfunc Query() {\n\tguard()\n\treturn\n}\n",
  [`${V1}:lessons/02.md`]: "# Timeouts\n\nBefore: p99 30 s\nAfter: p99 1.2 s\n",
};
const blobSha = (c: string) => createHash("sha1").update(files[c]).digest("hex");
const fakeGit = (tags: Record<string, string>): Git => ({
  dir: "/fake",
  revParse: (rev) => rev.endsWith("^{commit}") ? tags[rev.slice(0, -9)] ?? "missing" : blobSha(rev),
  blob: (commit, path) => Buffer.from(files[`${commit}:${path}`]),
});
const ds = { revision: "r", model: { elements: [], relationships: [] }, diagrams: [], sources: [] } as Dataset;
const sb = {
  sources: { code: { repo: "o/r", tag: "v1", commit: V1 } },
  excerpts: [
    { id: "then", at: { tag: "v0", commit: V0 }, path: "src/q.go", blob: blobSha(`${V0}:src/q.go`), symbol: "func Query", lines: [3, 5], wholeFunction: true },
    { id: "now", path: "src/q.go", blob: blobSha(`${V1}:src/q.go`), symbol: "func Query", lines: [3, 6], wholeFunction: true },
  ],
} as unknown as Storyboard;

test("one path pinned at two commits, each with its own tag and sha256", () => {
  const [then, now] = pinExcerpts(sb, fakeGit({ v0: V0, v1: V1 }), ds);
  assert.equal(then.commit, V0);
  assert.equal(now.commit, V1);
  assert.equal(then.text, "func Query() {\n\treturn\n}");
  assert.notEqual(then.sha256, now.sha256);
  assert.equal(citation(now), "v1 · bbbbbbb · src/q.go:3–6 · func Query");
  assert.equal(citation(then, { symbol: false }), "v0 · aaaaaaa · src/q.go:3–5");
});

test("a tag that drifted from the pinned commit is refused", () => {
  assert.throws(() => pinExcerpts(sb, fakeGit({ v0: V1, v1: V1 }), ds), /excerpt then: tag v0 -> b+, storyboard pins a+/);
});

test("evidence excerpts are byte-pinned without a declaration check", () => {
  const ev = structuredClone(sb);
  ev.excerpts = [{ id: "after", kind: "evidence", path: "lessons/02.md", blob: blobSha(`${V1}:lessons/02.md`), symbol: "measured p99 before and after", lines: [3, 4] }];
  const [x] = pinExcerpts(ev, fakeGit({ v1: V1 }), ds);
  assert.equal(x.kind, "evidence");
  assert.equal(x.declaredAt, null);
  assert.equal(x.text, "Before: p99 30 s\nAfter: p99 1.2 s");
  ev.excerpts[0].kind = "code";
  assert.throws(() => pinExcerpts(ev, fakeGit({ v1: V1 }), ds), /not declared/);
});
