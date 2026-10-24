// Blame ingestion, the thin slice of build item 5 (docs/story-arc-plan.md
// § 3.2, § 4): `git blame --porcelain` over exactly the excerpts the video
// shows (every code excerpt a scene names), each over its line range at its
// own pin, plus the commits blame names. No .mailmap folding, aliases or
// per-beat scopes yet. Node-only; reproduces from git, so `c4v verify`
// re-runs it and compares.
import type { Git } from "../code-source/git.ts";
import { isCodeScene, type Storyboard } from "../storyboard/schema.ts";
import type { Credits } from "./types.ts";

/** Excerpt ids the video shows, in first-shown order (evidence excerpts are not blamed). */
export function shownExcerpts(sb: Storyboard): string[] {
  const ids: string[] = [];
  for (const s of sb.scenes) if (isCodeScene(s) && !ids.includes(s.excerpt)) ids.push(s.excerpt);
  return ids.filter((id) => (sb.excerpts.find((x) => x.id === id)?.kind ?? "code") === "code");
}

/** Final line → commit, from `git blame --porcelain` output. */
export function parsePorcelain(out: string): { line: number; commit: string }[] {
  const res: { line: number; commit: string }[] = [];
  for (const l of out.split("\n")) {
    const m = /^([0-9a-f]{40}) \d+ (\d+)(?: \d+)?$/.exec(l);
    if (m) res.push({ line: Number(m[2]), commit: m[1] });
  }
  return res;
}

export function ingestCredits(sb: Storyboard, g: Git): Credits {
  const base = sb.sources.code;
  const show = (sha: string) => g.out(["show", "-s", "--format=%aN%x00%s%x00%as%x00%(trailers:key=Co-authored-by,valueonly,separator=%x01)", sha]).replace(/\n$/, "").split("\0");
  const [, subject, date] = show(base.commit);
  const credits: Credits = { base: { tag: base.tag, commit: base.commit, subject, date }, excerpts: {}, commits: {} };
  for (const id of shownExcerpts(sb)) {
    const x = sb.excerpts.find((e) => e.id === id)!;
    const commit = (x.at ?? base).commit;
    const lines = parsePorcelain(g.out(["blame", "--porcelain", "-L", `${x.lines[0]},${x.lines[1]}`, commit, "--", x.path]));
    if (lines.length !== x.lines[1] - x.lines[0] + 1) throw new Error(`blame ${id}: ${lines.length} lines for ${x.lines.join("-")}`);
    credits.excerpts[id] = { commit, path: x.path, lines };
    for (const l of lines) {
      if (credits.commits[l.commit]) continue;
      const [author, s, d, trailers = ""] = show(l.commit);
      // A trailer value is "Name <email>"; the name is what is credited.
      const coAuthors = trailers.split("\x01").map((t) => t.trim().replace(/\s*<[^>]*>$/, "")).filter(Boolean);
      credits.commits[l.commit] = { author, subject: s, date: d, coAuthors: [...new Set(coAuthors)] };
    }
  }
  // Commits keyed in sorted order so the bundle is stable.
  credits.commits = Object.fromEntries(Object.entries(credits.commits).sort(([a], [b]) => a.localeCompare(b)));
  return credits;
}
