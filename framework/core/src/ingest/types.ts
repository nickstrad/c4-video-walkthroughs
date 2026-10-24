// Browser-safe types for what ingestion reads from git at the pin. The bundle
// carries these; renderers read them through play.ts (repoFactsOf,
// videoCreditsOf), never git.

/** The repo as a whole at the pinned commit (ingest/repo.ts). */
export type RepoFacts = {
  repo: string;
  tag: string;
  commit: string;
  subject: string;
  /** Author date of the pinned commit, YYYY-MM-DD. */
  date: string;
  /** Path the facts are scoped to (sources.code.stripPrefix), "" for the whole repo. */
  scope: string;
  /** Commits reachable from the pin that touch the scope. */
  commits: number;
  firstDate: string;
  lastDate: string;
  /** Tags merged into the pin whose commit touches the scope. */
  tags: number;
  authors: { name: string; commits: number }[];
  /** Files in the scope at the pin, by extension, most first. */
  languages: { ext: string; files: number }[];
  /** C4 model counts from the pinned dataset snapshot. */
  model: { containers: number; components: number; views: number };
};

/** git blame over exactly the excerpts the video shows, each at its own pin (ingest/blame.ts). */
export type Credits = {
  /** The video's commit: sources.code. */
  base: { tag: string; commit: string; subject: string; date: string };
  excerpts: Record<string, { commit: string; path: string; lines: { line: number; commit: string }[] }>;
  /** Every commit blame named: author, subject, date and Co-authored-by trailers. */
  commits: Record<string, { author: string; subject: string; date: string; coAuthors: string[] }>;
};
