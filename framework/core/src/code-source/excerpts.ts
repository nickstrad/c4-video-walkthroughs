// Pin code excerpts at a commit and prove them byte-identical to git.
//
// Merges the two POC extractors: option 2's tag→commit and blob-SHA checks,
// option 1's dataset-selector and whole-function checks. Excerpts keep the
// file's exact bytes (tabs included); presentation such as tab expansion is a
// renderer concern (see presentText).
import { createHash } from "node:crypto";
import type { Dataset } from "../diagram/view.ts";
import { sourceSelector } from "../diagram/view.ts";
import type { ExcerptSpec, Storyboard } from "../storyboard/schema.ts";
import type { Git } from "./git.ts";
import type { Excerpt } from "./types.ts";

export type { Excerpt } from "./types.ts";

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** Bytes of lines [a, b] (1-based, inclusive) without the final newline. */
export function lineBytes(file: Buffer, [a, b]: [number, number]): Buffer {
  const starts = [0];
  for (let i = 0; i < file.length; i++) if (file[i] === 0x0a) starts.push(i + 1);
  if (a < 1 || b >= starts.length || a > b) throw new Error(`lines ${a}-${b} outside a ${starts.length - 1}-line file`);
  const end = starts[b] - 1; // the "\n" that ends line b
  return file.subarray(starts[a - 1], end);
}

/**
 * Pin every excerpt. Each one is read at its own pin (`at`, else
 * sources.code), so one storyboard can quote several commits; every tag must
 * still resolve to the commit the storyboard expects.
 */
export function pinExcerpts(sb: Storyboard, g: Git, ds: Dataset): Excerpt[] {
  const { repo, stripPrefix = "" } = sb.sources.code;
  const checked = new Set<string>();
  return sb.excerpts.map((x) => {
    const { tag, commit } = x.at ?? sb.sources.code;
    if (!checked.has(tag + commit)) {
      const tagSha = g.revParse(`${tag}^{commit}`);
      if (tagSha !== commit) throw new Error(`${x.at ? `excerpt ${x.id}: ` : ""}tag ${tag} -> ${tagSha}, storyboard pins ${commit}`);
      checked.add(tag + commit);
    }
    return pinOne(x, g, ds, { tag, commit, repo, stripPrefix });
  });
}

function pinOne(x: ExcerptSpec, g: Git, ds: Dataset, c: { tag: string; commit: string; repo: string; stripPrefix: string }): Excerpt {
  const fail = (m: string): never => { throw new Error(`excerpt ${x.id}: ${m}`); };
  const blob = g.revParse(`${c.commit}:${x.path}`);
  if (blob !== x.blob) fail(`blob ${blob}, storyboard pins ${x.blob}`);
  const file = g.blob(c.commit, x.path);
  const all = file.toString("utf8").split("\n");
  const bytes = lineBytes(file, x.lines);
  const body = all.slice(x.lines[0] - 1, x.lines[1]);
  // The symbol must be declared at or above the excerpt's last line.
  const decl = all.findIndex((l, i) => i < x.lines[1] && l.startsWith(x.symbol));
  if (decl < 0) fail(`${x.symbol} not declared in ${x.path} above line ${x.lines[1]}`);
  if (x.wholeFunction) {
    if (!body[0].startsWith(x.symbol)) fail(`line ${x.lines[0]} is not ${x.symbol}: ${body[0]}`);
    if (body.at(-1) !== "}") fail(`line ${x.lines[1]} does not close the function: ${body.at(-1)}`);
  }
  let selector: Excerpt["selector"] = null;
  if (x.datasetSourceId) {
    const citedBy = x.relationshipId ?? x.elementId ?? fail("datasetSourceId needs elementId or relationshipId");
    const s = sourceSelector(ds, citedBy, x.datasetSourceId);
    if (s.path !== x.path) fail(`selector ${s.id} names ${s.path}`);
    if (s.revision !== c.commit) fail(`selector revision ${s.revision} != ${c.commit}`);
    if (s.line !== null && s.line !== decl + 1) fail(`selector line ${s.line}, ${x.symbol} is declared at ${decl + 1}`);
    selector = { id: s.id, notes: s.notes, url: s.url, line: s.line };
  }
  return {
    id: x.id, repo: c.repo, commit: c.commit, tag: c.tag, path: x.path,
    displayPath: x.path.startsWith(c.stripPrefix) ? x.path.slice(c.stripPrefix.length) : x.path,
    blob, symbol: x.symbol, declaredAt: decl + 1, lines: x.lines, firstLine: x.lines[0],
    text: bytes.toString("utf8"), sha256: sha256(bytes), selector,
    url: `https://github.com/${c.repo}/blob/${c.commit}/${x.path}#L${x.lines[0]}-L${x.lines[1]}`,
  };
}

/**
 * Re-read every pinned excerpt from git and compare bytes. Returns problems;
 * empty means each excerpt is byte-identical to its lines at the commit.
 */
export function verifyExcerpts(excerpts: Excerpt[], g: Git): string[] {
  const errs: string[] = [];
  for (const x of excerpts) {
    try {
      const blob = g.revParse(`${x.commit}:${x.path}`);
      if (blob !== x.blob) errs.push(`${x.id}: blob now ${blob}, pinned ${x.blob}`);
      const bytes = lineBytes(g.blob(x.commit, x.path), x.lines);
      if (!bytes.equals(Buffer.from(x.text, "utf8"))) errs.push(`${x.id}: text differs from ${x.path}:${x.lines.join("-")} @ ${x.commit.slice(0, 7)}`);
      if (sha256(bytes) !== x.sha256) errs.push(`${x.id}: sha256 mismatch`);
    } catch (e) {
      errs.push(`${x.id}: ${(e as Error).message}`);
    }
  }
  return errs;
}
