// Repo ingestion (docs/story-arc-plan.md § 3.1): facts about the repo at the
// pinned commit, read from git objects only (log, for-each-ref, ls-tree), so
// they reproduce from the checkout whenever `c4v verify` runs. Node-only.
import path from "node:path";
import type { Git } from "../code-source/git.ts";
import type { Dataset } from "../diagram/view.ts";
import type { Storyboard } from "../storyboard/schema.ts";
import type { RepoFacts } from "./types.ts";

const lines = (s: string) => s.split("\n").filter(Boolean);

export function ingestRepo(sb: Storyboard, g: Git, ds: Dataset): RepoFacts {
  const { repo, tag, commit, stripPrefix = "" } = sb.sources.code;
  const scope = stripPrefix.replace(/\/+$/, "");
  const pathspec = scope ? ["--", scope] : [];
  const [subject, date] = g.out(["show", "-s", "--format=%s%x00%as", commit]).trim().split("\0");
  // One line per commit touching the scope: sha, author, author date.
  const log = lines(g.out(["log", "--format=%H%x00%aN%x00%as", commit, ...pathspec])).map((l) => l.split("\0"));
  const inScope = new Set(log.map((l) => l[0]));
  const byAuthor = new Map<string, number>();
  for (const [, name] of log) byAuthor.set(name, (byAuthor.get(name) ?? 0) + 1);
  const dates = log.map((l) => l[2]).sort();
  // Tags merged into the pin whose commit (peeled) touches the scope.
  const tags = lines(g.out(["for-each-ref", "--merged", commit, "--format=%(objectname) %(*objectname)", "refs/tags"]))
    .filter((l) => { const [obj, peeled] = l.split(" "); return inScope.has(peeled || obj); }).length;
  const byExt = new Map<string, number>();
  for (const f of lines(g.out(["ls-tree", "-r", "--name-only", commit, ...(scope ? [scope + "/"] : [])]))) {
    const ext = path.extname(f) || path.basename(f);
    byExt.set(ext, (byExt.get(ext) ?? 0) + 1);
  }
  const kinds = (k: string) => ds.model.elements.filter((e) => e.kind === k).length;
  return {
    repo, tag, commit, subject, date, scope,
    commits: log.length, firstDate: dates[0], lastDate: dates.at(-1)!, tags,
    authors: [...byAuthor].map(([name, commits]) => ({ name, commits })).sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name)),
    languages: [...byExt].map(([ext, files]) => ({ ext, files })).sort((a, b) => b.files - a.files || a.ext.localeCompare(b.ext)),
    model: { containers: kinds("container"), components: kinds("component"), views: ds.diagrams.length },
  };
}
