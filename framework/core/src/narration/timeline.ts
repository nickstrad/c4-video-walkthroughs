// Alignment → timeline. Pure: storyboard + takes in, every timing a renderer
// needs out. Unifies the two POC retimers:
//
// - from option 2: scene duration measured to the *last spoken letter* (the
//   closing punctuation's span is up to ~1 s of trailing silence), frame-
//   rounded; cues anchored on phrases of the spoken text; take text checked
//   1:1 against the alignment;
// - from option 1: stepped scenes voiced as one take, each step lighting
//   `stepLead` before its first character (found by its offset in the
//   stitched text); per-scene lead-in overrides; a minimum scene length for
//   moves that need it (the focus zoom); refusal to reuse a stale take.
import { isCodeScene, spokenParts, spokenText, takeId, type Storyboard } from "../storyboard/schema.ts";
import type { Caption, TakeRecord, TimedScene, Timeline } from "./types.ts";

const SPOKEN = /[\p{L}\p{N}]/u;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Index of the last letter or digit: where speech really ends. */
export function lastSpoken(text: string): number {
  let i = text.length - 1;
  while (i > 0 && !SPOKEN.test(text[i])) i--;
  return i;
}

/** Throws unless the take was voiced from exactly this text. */
export function checkTake(sceneId: string, text: string, take: TakeRecord) {
  if (take.text !== text) throw new Error(`${sceneId}: storyboard text changed since the take was voiced; delete its take to re-record`);
  if (take.alignment.characters.join("") !== text) throw new Error(`${sceneId}: alignment does not cover the text 1:1`);
}

export function buildTimeline(sb: Storyboard, takes: Record<string, TakeRecord>, audioFile = "track.wav", sampleRate = 44100): Timeline {
  const { fps, width, height, outro = 0 } = sb.format;
  const n = sb.narration;
  const toFrames = (s: number) => Math.ceil(s * fps - 1e-6);
  const scenes: TimedScene[] = [];
  const captions: Caption[] = [];
  let frame = 0;
  for (const sc of sb.scenes) {
    const id = takeId(sc);
    const take = takes[id];
    if (!take) throw new Error(`${sc.id}: no take ${id}`);
    const text = spokenText(sc);
    checkTake(sc.id, text, take);
    const a = take.alignment;
    const leadIn = sc.narration?.leadIn ?? n.leadIn;
    const speechEnd = a.character_end_times_seconds[lastSpoken(text)];
    const frames = toFrames(Math.max(sc.minDuration ?? 0, leadIn + speechEnd + n.tail));
    const start = frame / fps, duration = frames / fps;

    const cues: Record<string, number> = {};
    for (const [name, phrase] of Object.entries(sc.narration?.cues ?? {})) {
      const at = text.indexOf(phrase);
      if (at < 0) throw new Error(`${sc.id}: cue "${name}" anchor "${phrase}" is not in the spoken text`);
      cues[name] = r3(leadIn + a.character_start_times_seconds[at]);
    }

    const timed: TimedScene = {
      id: sc.id, kind: sc.kind, take: id, startFrame: frame, frames,
      start: r3(start), duration: r3(duration), leadIn,
      speech: [leadIn, r3(leadIn + speechEnd)], cues,
    };
    if (isCodeScene(sc) && sc.steps) {
      // Step i lights stepLead before its first character; step 0 at the lead-in.
      const parts = spokenParts(sc);
      let offset = 0;
      const bounds = parts.map((p, i) => {
        const t0 = a.character_start_times_seconds[offset];
        offset += p.length + 1;
        return i === 0 ? leadIn : leadIn + Math.max(0, t0 - n.stepLead);
      });
      bounds.push(duration);
      timed.steps = sc.steps.map((st, i) => ({ id: st.id, start: r3(bounds[i]), end: r3(bounds[i + 1]) }));
      sc.steps.forEach((st, i) => captions.push({ start: r3(start + bounds[i]), end: r3(start + bounds[i + 1]), text: st.caption, sceneId: sc.id, stepId: st.id }));
    } else {
      captions.push({ start: r3(start), end: r3(start + duration), text: sc.caption, sceneId: sc.id });
    }
    scenes.push(timed);
    frame += frames;
  }
  const totalFrames = frame + Math.round(outro * fps);
  return {
    schema: "c4v-timeline/1", storyboard: sb.id, fps, width, height,
    totalFrames, total: r3(totalFrames / fps), scenes, captions,
    audio: { file: audioFile, sampleRate },
  };
}
