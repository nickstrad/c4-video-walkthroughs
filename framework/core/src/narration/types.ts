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
/** One take placed in its scene (rel): its audio starts at `at`; speech runs to the last spoken letter. */
export type TimedTake = { take: string; lineId?: string; at: number; speech: [number, number] };
export type TimedScene = {
  id: string;
  kind: string;
  /** The scene's takes in order: one, or one per line of a multi-line scene. */
  takes: TimedTake[];
  /** Scene placement, whole frames. */
  startFrame: number;
  frames: number;
  /** The same in seconds (frames / fps). */
  start: number;
  duration: number;
  leadIn: number;
  /** Speech span relative to the scene start: lead-in → the last take's last spoken letter. */
  speech: [number, number];
  /** Named cues, seconds relative to the scene start. */
  cues: Record<string, number>;
  steps?: TimedStep[];
};
/** An act's bounds: its first scene's start to its last scene's end. */
export type TimedAct = { id: string; title: string; role?: string; startFrame: number; frames: number; start: number; duration: number; scenes: string[] };
export type Caption = { start: number; end: number; text: string; sceneId: string; stepId?: string; lineId?: string };
export type Timeline = {
  schema: "c4v-timeline/1";
  storyboard: string;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  total: number;
  scenes: TimedScene[];
  /** Present only when the storyboard declares acts. */
  acts?: TimedAct[];
  captions: Caption[];
  audio: { file: string; sampleRate: number };
};
