import story from "../storyboard.json";

export type Step = { id: string; label: string; lines: [number, number]; duration: number; narration: string };
export type Scene = {
  id: string; type: string; start: number; duration: number;
  audio?: { file: string; at: number; end: number };
  title?: string; narration?: string; elementId?: string; intro?: number; steps?: Step[];
};
export type Storyboard = Omit<typeof story, "scenes"> & { scenes: Scene[] };

export const storyboard = story as unknown as Storyboard;
export const sceneById = (id: string) => storyboard.scenes.find((s) => s.id === id)!;
export const sec = (s: number) => Math.round(s * storyboard.fps);

// Caption cues in absolute seconds, flattened from scenes and code steps. The
// scene and step durations are set from the TTS alignment by narrate.mjs.
export type Cue = { start: number; end: number; text: string };
export const cues: Cue[] = storyboard.scenes.flatMap((sc) => {
  if (!sc.steps) return [{ start: sc.start, end: sc.start + sc.duration, text: sc.narration ?? "" }];
  let t = sc.start + (sc.intro ?? 0);
  return sc.steps.map((st) => {
    const cue = { start: t, end: t + st.duration, text: st.narration };
    t += st.duration;
    return cue;
  });
});
