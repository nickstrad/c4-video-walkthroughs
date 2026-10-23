// Committed takes: narration/<take>.mp3 + <take>.alignment.json per scene.
// loadTakes never calls the API. synthesizeMissing is the only path that does,
// and only for scenes with no take on disk.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spokenText, takeId, type Storyboard } from "../storyboard/schema.ts";
import { credentials, synthesize } from "./elevenlabs.ts";
import { checkTake } from "./timeline.ts";
import type { TakeRecord } from "./types.ts";

const files = (dir: string, id: string) => ({ mp3: path.join(dir, `${id}.mp3`), json: path.join(dir, `${id}.alignment.json`) });

export function missingTakes(sb: Storyboard, dir: string) {
  return sb.scenes.filter((s) => {
    const f = files(dir, takeId(s));
    return !existsSync(f.mp3) || !existsSync(f.json);
  });
}

export function loadTakes(sb: Storyboard, dir: string): Record<string, TakeRecord> {
  const missing = missingTakes(sb, dir);
  if (missing.length) throw new Error(`no take for ${missing.map((s) => s.id).join(", ")}; run \`c4v narrate\` to voice them`);
  const out: Record<string, TakeRecord> = {};
  for (const s of sb.scenes) {
    const id = takeId(s);
    const rec = JSON.parse(readFileSync(files(dir, id).json, "utf8")) as TakeRecord;
    checkTake(s.id, spokenText(s), rec);
    out[id] = rec;
  }
  return out;
}

/** Voice every scene that has no take yet. Returns characters billed. */
export async function synthesizeMissing(sb: Storyboard, dir: string, log = console.log): Promise<number> {
  const missing = new Set(missingTakes(sb, dir).map((s) => s.id));
  if (!missing.size) return 0;
  const cred = credentials();
  let chars = 0;
  for (const [i, s] of sb.scenes.entries()) {
    if (!missing.has(s.id)) continue;
    const text = spokenText(s);
    const voiceId = cred.voiceId ?? sb.narration.voice.id;
    const res = await synthesize({
      text, voiceId, model: sb.narration.model, outputFormat: sb.narration.outputFormat,
      previousText: sb.scenes[i - 1] && spokenText(sb.scenes[i - 1]),
      nextText: sb.scenes[i + 1] && spokenText(sb.scenes[i + 1]),
    }, cred.key);
    const f = files(dir, takeId(s));
    writeFileSync(f.mp3, res.audio);
    const rec: TakeRecord = {
      sceneId: s.id, text, voiceId, model: sb.narration.model, outputFormat: sb.narration.outputFormat,
      characters: text.length, alignment: res.alignment, normalized_alignment: res.normalized_alignment,
    };
    writeFileSync(f.json, JSON.stringify(rec, null, 2) + "\n");
    chars += text.length;
    log(`voiced ${s.id} (${text.length} chars)`);
  }
  return chars;
}
