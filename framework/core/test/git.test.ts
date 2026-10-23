// Git-backed code-source checks; skipped when the book-notes checkout is absent.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkoutFor, exportTree, git } from "../src/code-source/git.ts";
import type { Storyboard } from "../src/storyboard/schema.ts";

const P = new URL("../../projects/litefleet/", import.meta.url).pathname;
const sb = JSON.parse(readFileSync(P + "storyboard.json", "utf8")) as Storyboard;
let dir: string | undefined;
try { dir = checkoutFor(sb.sources.code.repo); } catch { /* no checkout */ }

test("exportTree writes the pinned tree byte-for-byte", { skip: !dir }, () => {
  const g = git(dir!);
  const { commit, stripPrefix = "" } = sb.sources.code;
  const dest = mkdtempSync(path.join(tmpdir(), "c4v-export-"));
  try {
    exportTree(g, commit, stripPrefix, dest);
    for (const x of sb.excerpts) {
      const rel = x.path.slice(stripPrefix.length);
      assert.ok(existsSync(path.join(dest, rel)), rel);
      assert.ok(readFileSync(path.join(dest, rel)).equals(g.blob(commit, x.path)), rel);
    }
    assert.throws(() => exportTree(g, commit, stripPrefix, dest), /not empty/);
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
});
