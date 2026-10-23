// Browser-safe narration types.

/** ElevenLabs per-character alignment. */
export type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

/** A committed take's record: narration/<take>.alignment.json beside <take>.mp3. */
export type TakeRecord = {
  sceneId: string;
  text: string;
  voiceId: string;
  model: string;
  outputFormat: string;
  characters: number;
  origin?: string;
  alignment: Alignment;
  normalized_alignment: Alignment;
};

export type TimedStep = { id: string; start: number; end: number };
export type TimedScene = {
  id: string;
  kind: string;
  take: string;
  /** Scene placement, whole frames. */
  startFrame: number;
  frames: number;
  /** The same in seconds (frames / fps). */
  start: number;
  duration: number;
  leadIn: number;
  /** Speech span relative to the scene start: lead-in → last spoken letter. */
  speech: [number, number];
  /** Named cues, seconds relative to the scene start. */
  cues: Record<string, number>;
  steps?: TimedStep[];
};
export type Caption = { start: number; end: number; text: string; sceneId: string; stepId?: string };
export type Timeline = {
  schema: "c4v-timeline/1";
  storyboard: string;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  total: number;
  scenes: TimedScene[];
  captions: Caption[];
  audio: { file: string; sampleRate: number };
};
