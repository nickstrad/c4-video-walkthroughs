// "Dumb views" lint (audit-34 item 3.7): a renderer draws what the bundle
// says, so no on-screen string the storyboard authors may appear in renderer
// source. Each renderer runs this from its own test.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { Storyboard } from "../storyboard/schema.ts";

/** Strings shorter than this are too generic to flag ("rows", "epoch"). */
const MIN = 12;

/** Every on-screen or spoken string the storyboard authors. */
export function authoredText(sb: Storyboard): string[] {
  const out = [sb.title, sb.statePanel?.title, ...(sb.acts ?? []).map((a) => a.title)];
  for (const s of sb.scenes) {
    out.push(s.caption, s.speech);
    for (const l of s.lines ?? []) out.push(l.caption, l.speech);
    if (s.kind === "code-explanation") {
      out.push(s.railTitle, s.packet?.label);
      for (const st of s.steps ?? []) out.push(st.caption, st.speech, st.label);
    } else if (s.kind !== "repo-card" && s.kind !== "credits") {
      out.push(s.title, s.packet?.label, s.badge?.text, s.skip?.note);
      for (const r of s.responsibilities ?? []) out.push(r.label);
    }
  }
  return [...new Set(out.filter((x): x is string => !!x && x.length >= MIN))];
}

const walk = (p: string): string[] =>
  statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => (f === "node_modules" ? [] : walk(path.join(p, f)))) : [p];

/** `file: "text"` for every authored string found in the given source trees. */
export function hardCodedText(projectDir: string, roots: string[]): string[] {
  const sb = JSON.parse(readFileSync(path.join(projectDir, "storyboard.json"), "utf8")) as Storyboard;
  const texts = authoredText(sb);
  const hits: string[] = [];
  for (const f of roots.flatMap(walk).filter((f) => /\.(m?[jt]sx?|css|html|meta)$/.test(f))) {
    const src = readFileSync(f, "utf8");
    for (const t of texts) if (src.includes(t)) hits.push(`${f}: "${t}"`);
  }
  return hits;
}
