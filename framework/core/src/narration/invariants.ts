// Timeline invariants, checked before any render (from the option-3 POC's
// verify.mjs, audit-34 item 3.5). Pure: returns problems, empty when the
// timeline is sound. It catches retime regressions that would otherwise only
// show up as a cut word or a drifting cue in a finished video.
import { takesOf, type Storyboard } from "../storyboard/schema.ts";
import type { TakeRecord, Timeline } from "./types.ts";

/** A line must end at least this long before its scene cuts, s. */
export const CUT_MARGIN = 0.3;
const EPS = 1e-6;

export function validateTimeline(tl: Timeline, sb: Storyboard, takes: Record<string, TakeRecord>): string[] {
  const errs: string[] = [];
  const err = (m: string) => errs.push(m);
  if (tl.storyboard !== sb.id) err(`timeline is for ${tl.storyboard}, storyboard is ${sb.id}`);
  if (tl.fps !== sb.format.fps || tl.width !== sb.format.width || tl.height !== sb.format.height) err("timeline format differs from the storyboard's");
  const ids = sb.scenes.map((s) => s.id).join(" ");
  if (tl.scenes.map((s) => s.id).join(" ") !== ids) err("timeline scenes are not the storyboard's scenes in order");

  let frame = 0;
  for (const s of tl.scenes) {
    if (s.startFrame !== frame) err(`${s.id}: starts at frame ${s.startFrame}, previous scene ends at ${frame}`);
    if (!(s.frames > 0) || !Number.isInteger(s.frames)) err(`${s.id}: ${s.frames} frames`);
    if (Math.abs(s.start - s.startFrame / tl.fps) > 1e-3 || Math.abs(s.duration - s.frames / tl.fps) > 1e-3) err(`${s.id}: seconds disagree with frames`);
    frame += s.frames;
    const [a, z] = s.speech;
    if (!(a >= 0 && z > a)) err(`${s.id}: speech span ${a}-${z}`);
    if (!s.takes.length || s.takes[0].at !== a || s.takes.at(-1)!.speech[1] !== z) err(`${s.id}: speech span disagrees with its takes`);
    // Every line ends CUT_MARGIN before the next line starts, or before the scene cuts.
    s.takes.forEach((t, k) => {
      const cut = s.takes[k + 1]?.at ?? s.duration;
      if (t.speech[1] + CUT_MARGIN > cut + EPS) err(`${t.take}: speech ends at ${t.speech[1]} s, less than ${CUT_MARGIN} s before the cut at ${cut} s`);
    });
    for (const [name, at] of Object.entries(s.cues)) if (!(at >= 0 && at < s.duration)) err(`${s.id}: cue ${name} at ${at} s is outside the scene`);
    let prev = 0;
    for (const st of s.steps ?? []) {
      if (st.start + EPS < prev || st.end < st.start || st.end > s.duration + EPS) err(`${s.id}: step ${st.id} ${st.start}-${st.end} out of order`);
      prev = st.end;
    }
  }
  const outro = Math.round((sb.format.outro ?? 0) * tl.fps);
  if (tl.totalFrames !== frame + outro) err(`totalFrames ${tl.totalFrames}, scenes + outro make ${frame + outro}`);
  if (Math.abs(tl.total - tl.totalFrames / tl.fps) > 1e-3) err(`total ${tl.total} s disagrees with ${tl.totalFrames} frames`);

  const scenes = new Map(tl.scenes.map((s) => [s.id, s]));
  tl.captions.forEach((c, i) => {
    const s = scenes.get(c.sceneId);
    if (!s) return err(`caption "${c.text}" names no scene ${c.sceneId}`);
    // Caption times are rounded once, scene start and duration separately: allow 1 ms each.
    if (c.start + 2e-3 < s.start || c.end > s.start + s.duration + 2e-3 || c.end <= c.start) err(`${c.sceneId}: caption ${c.start}-${c.end} outside its scene`);
    const next = tl.captions[i + 1];
    if (next && next.start + EPS < c.end) err(`${c.sceneId}: caption overlaps the next one (${c.end} > ${next.start})`);
  });

  for (const s of sb.scenes) for (const t of takesOf(s)) {
    const take = takes[t.id];
    if (!take) { err(`${s.id}: no take ${t.id}`); continue; }
    if (take.text !== t.text) err(`${t.id}: take text differs from the storyboard's spoken text`);
    if (take.alignment.characters.join("") !== take.text) err(`${t.id}: alignment does not cover the take text 1:1`);
    if (take.model !== sb.narration.model) err(`${t.id}: take voiced with ${take.model}, storyboard says ${sb.narration.model}`);
    if (take.outputFormat !== sb.narration.outputFormat) err(`${t.id}: take format ${take.outputFormat}, storyboard says ${sb.narration.outputFormat}`);
  }
  return errs;
}
