// Read-only access to a repository checkout through git objects only: every
// read names a commit, so the working tree (and its uncommitted edits) is never
// consulted. Salvaged from both POCs' extractors (`git show <sha>:<path>`).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";

/**
 * Local checkout for a "owner/name" repo. C4V_CHECKOUT_<NAME> (name upper-cased,
 * non-alphanumerics as "_") overrides; the default is /root/Software/<name>.
 * On the platform this is the sandbox clone (see docs/platform-canvas.md).
 */
export function checkoutFor(repo: string): string {
  const name = repo.split("/").pop()!;
  const env = process.env[`C4V_CHECKOUT_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  const dir = env ?? `/root/Software/${name}`;
  if (!existsSync(dir)) throw new Error(`no checkout of ${repo} at ${dir}; set C4V_CHECKOUT_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`);
  return dir;
}

export type Git = {
  dir: string;
  revParse: (rev: string) => string;
  blob: (commit: string, path: string) => Buffer;
};

export function git(dir: string): Git {
  const run = (args: string[]) => execFileSync("git", ["-C", dir, ...args], { maxBuffer: 64 << 20 });
  return {
    dir,
    revParse: (rev) => run(["rev-parse", rev]).toString("utf8").trim(),
    blob: (commit, path) => run(["show", `${commit}:${path}`]),
  };
}

/**
 * Write the tree at `commit:subpath` into `dest` (created, must be empty),
 * from git objects only: `git archive <commit>:<subpath> | tar -x`. For a
 * scene that runs pinned code (tests, a CLI), so what runs is the commit,
 * never the working tree. Lifted from the option-3 POC's prepare.mjs.
 */
export function exportTree(g: Git, commit: string, subpath: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  if (readdirSync(dest).length) throw new Error(`exportTree: ${dest} is not empty`);
  const tree = subpath.replace(/^\/+|\/+$/g, "");
  const tar = execFileSync("git", ["-C", g.dir, "archive", "--format=tar", tree ? `${commit}:${tree}` : commit], { maxBuffer: 1 << 30 });
  execFileSync("tar", ["-x", "-C", dest], { input: tar });
}
