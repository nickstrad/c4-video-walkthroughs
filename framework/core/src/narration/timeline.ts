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
//   moves that need it (the focus zoom); refusal to reuse a stale take;
// - from option 3 (audit-34 item 3.3, the idea, not its code): a scene may
//   say several separately voiced lines, chained `lineGap` apart. Each is
//   measured to its last spoken letter, and a cue phrase must occur exactly
//   once across the scene's lines.
import { isCodeScene, spokenParts, takesOf, type Storyboard } from "../storyboard/schema.ts";
import type { Caption, TakeRecord, TimedAct, TimedScene, TimedTake, Timeline } from "./types.ts";

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

export const DEFAULT_LINE_GAP = 0.4;

/**
 * Where a cue's phrase is spoken: the one take that contains it, and the
 * character offset there. The phrase must occur exactly once in the scene,
 * so a cue can never silently bind to the wrong line or word.
 */
function anchor(sceneId: string, name: string, phrase: string, texts: string[]): [number, number] {
  const hits: [number, number][] = [];
  texts.forEach((t, k) => {
    for (let i = t.indexOf(phrase); i >= 0; i = t.indexOf(phrase, i + 1)) hits.push([k, i]);
  });
  if (!hits.length) throw new Error(`${sceneId}: cue "${name}" anchor "${phrase}" is not in the spoken text`);
  if (hits.length > 1) throw new Error(`${sceneId}: cue "${name}" anchor "${phrase}" occurs ${hits.length} times; use a longer phrase`);
  return hits[0];
}

export function buildTimeline(sb: Storyboard, takes: Record<string, TakeRecord>, audioFile = "track.wav", sampleRate = 44100): Timeline {
  const { fps, width, height, outro = 0 } = sb.format;
  const n = sb.narration;
  const toFrames = (s: number) => Math.ceil(s * fps - 1e-6);
  const scenes: TimedScene[] = [];
  const captions: Caption[] = [];
  let frame = 0;
  for (const sc of sb.scenes) {
    const specs = takesOf(sc);
    const leadIn = sc.narration?.leadIn ?? n.leadIn;
    // Chain the takes: each starts its gap after the previous last spoken
    // letter. Unrounded times drive the frame count; the timeline gets ms.
    const placed: TimedTake[] = [], ats: number[] = [];
    let at = leadIn, speechEnd = leadIn;
    const recs = specs.map((t, k) => {
      const take = takes[t.id];
      if (!take) throw new Error(`${sc.id}: no take ${t.id}`);
      checkTake(t.lineId ? `${sc.id}.${t.lineId}` : sc.id, t.text, take);
      if (k > 0) at = speechEnd + (t.gap ?? n.lineGap ?? DEFAULT_LINE_GAP);
      ats.push(at);
      speechEnd = at + take.alignment.character_end_times_seconds[lastSpoken(t.text)];
      placed.push({ take: t.id, ...(t.lineId ? { lineId: t.lineId } : {}), at: r3(at), speech: [r3(at), r3(speechEnd)] });
      return take;
    });
    const frames = toFrames(Math.max(sc.minDuration ?? 0, speechEnd + n.tail));
    const start = frame / fps, duration = frames / fps;

    const cues: Record<string, number> = {};
    for (const [name, phrase] of Object.entries(sc.narration?.cues ?? {})) {
      const [k, i] = anchor(sc.id, name, phrase, specs.map((t) => t.text));
      cues[name] = r3(ats[k] + recs[k].alignment.character_start_times_seconds[i]);
    }

    const timed: TimedScene = {
      id: sc.id, kind: sc.kind, takes: placed, startFrame: frame, frames,
      start: r3(start), duration: r3(duration), leadIn,
      speech: [leadIn, r3(speechEnd)], cues,
    };
    if (isCodeScene(sc) && sc.steps) {
      // Step i lights stepLead before its first character; step 0 at the lead-in.
      const a = recs[0].alignment;
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
      // Each line's caption holds from its take's start (the first from the scene start) to the next one.
      specs.forEach((t, k) => captions.push({
        start: r3(start + (k === 0 ? 0 : placed[k].at)),
        end: r3(start + (k + 1 < placed.length ? placed[k + 1].at : duration)),
        text: t.caption, sceneId: sc.id, ...(t.lineId ? { lineId: t.lineId } : {}),
      }));
    }
    scenes.push(timed);
    frame += frames;
  }
  const totalFrames = frame + Math.round(outro * fps);
  const tl: Timeline = {
    schema: "c4v-timeline/1", storyboard: sb.id, fps, width, height,
    totalFrames, total: r3(totalFrames / fps), scenes, captions,
    audio: { file: audioFile, sampleRate },
  };
  if (sb.acts) {
    tl.acts = sb.acts.map((a): TimedAct => {
      const own = sb.scenes.flatMap((s, i) => (s.act === a.id ? [scenes[i]] : []));
      if (!own.length) throw new Error(`act ${a.id} has no scenes`);
      const startFrame = own[0].startFrame, frames = own.at(-1)!.startFrame + own.at(-1)!.frames - startFrame;
      return { id: a.id, title: a.title, startFrame, frames, start: r3(startFrame / fps), duration: r3(frames / fps), scenes: own.map((s) => s.id) };
    });
  }
  return tl;
}

export type SpeechWindow = { id: string; start: number; end: number };
/**
 * Where the voice should be heard, absolute seconds, in time order: each
 * take's speech span, split at step bounds for stepped scenes.
 */
export function speechWindows(tl: Timeline): SpeechWindow[] {
  const out: SpeechWindow[] = [];
  for (const s of tl.scenes) {
    const [a, z] = s.speech;
    if (!s.steps) {
      for (const t of s.takes) out.push({ id: t.lineId ? `${s.id}.${t.lineId}` : s.id, start: r3(s.start + t.speech[0]), end: r3(s.start + t.speech[1]) });
      continue;
    }
    for (const st of s.steps) {
      const lo = Math.max(a, st.start), hi = Math.min(z, st.end);
      if (hi > lo) out.push({ id: `${s.id}.${st.id}`, start: r3(s.start + lo), end: r3(s.start + hi) });
    }
  }
  return out;
}
