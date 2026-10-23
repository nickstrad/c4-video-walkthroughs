// Committed takes: narration/<take>.mp3 + <take>.alignment.json, one per
// scene, or one per line of a multi-line scene. loadTakes never calls the
// API. synthesizeMissing is the only path that does, and only for takes with
// nothing on disk.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { takesOf, type Storyboard, type TakeSpec } from "../storyboard/schema.ts";
import { credentials, synthesize } from "./elevenlabs.ts";
import { checkTake } from "./timeline.ts";
import type { TakeRecord } from "./types.ts";

const files = (dir: string, id: string) => ({ mp3: path.join(dir, `${id}.mp3`), json: path.join(dir, `${id}.alignment.json`) });

/** Every take the storyboard needs, in speaking order. */
export const allTakes = (sb: Storyboard): (TakeSpec & { sceneId: string })[] =>
  sb.scenes.flatMap((s) => takesOf(s).map((t) => ({ ...t, sceneId: s.id })));

export function missingTakes(sb: Storyboard, dir: string) {
  return allTakes(sb).filter((t) => {
    const f = files(dir, t.id);
    return !existsSync(f.mp3) || !existsSync(f.json);
  });
}

export function loadTakes(sb: Storyboard, dir: string): Record<string, TakeRecord> {
  const missing = missingTakes(sb, dir);
  if (missing.length) throw new Error(`no take ${missing.map((t) => t.id).join(", ")}; run \`c4v narrate\` to voice them`);
  const out: Record<string, TakeRecord> = {};
  for (const t of allTakes(sb)) {
    const rec = JSON.parse(readFileSync(files(dir, t.id).json, "utf8")) as TakeRecord;
    checkTake(t.id, t.text, rec);
    out[t.id] = rec;
  }
  return out;
}

/** Voice every take that is not on disk yet. Returns characters billed. */
export async function synthesizeMissing(sb: Storyboard, dir: string, log = console.log): Promise<number> {
  const missing = new Set(missingTakes(sb, dir).map((t) => t.id));
  if (!missing.size) return 0;
  const cred = credentials();
  const order = allTakes(sb);
  let chars = 0;
  for (const [i, t] of order.entries()) {
    if (!missing.has(t.id)) continue;
    const voiceId = cred.voiceId ?? sb.narration.voice.id;
    const res = await synthesize({
      text: t.text, voiceId, model: sb.narration.model, outputFormat: sb.narration.outputFormat,
      previousText: order[i - 1]?.text,
      nextText: order[i + 1]?.text,
    }, cred.key);
    const f = files(dir, t.id);
    writeFileSync(f.mp3, res.audio);
    const rec: TakeRecord = {
      sceneId: t.sceneId, text: t.text, voiceId, model: sb.narration.model, outputFormat: sb.narration.outputFormat,
      characters: t.text.length, alignment: res.alignment, normalized_alignment: res.normalized_alignment,
    };
    writeFileSync(f.json, JSON.stringify(rec, null, 2) + "\n");
    chars += t.text.length;
    log(`voiced ${t.id} (${t.text.length} chars)`);
  }
  return chars;
}
