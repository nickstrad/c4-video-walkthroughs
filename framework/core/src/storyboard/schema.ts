// The storyboard: the one input a project hands the framework. It names what
// to show (C4 views, pinned code excerpts) and what is said over it; it holds
// no timings. Timings come from the narration alignment (narration/timeline.ts)
// and land in the Timeline, which renderers read alongside this file.
//
// Shape history: the union of the option-1 POC storyboard (scene types
// architecture-overview / focus-element / code-explanation with steps) and the
// option-2 POC storyboard (follow-request / state-change / code-explanation
// with highlights, cue phrases and a state panel).

export const SCHEMA = "c4v-storyboard/1";

export type Range = [number, number]; // file line numbers, inclusive

export type Storyboard = {
  schema: typeof SCHEMA;
  id: string;
  title: string;
  authoredBy?: string;
  format: { fps: number; width: number; height: number; outro?: number };
  sources: {
    dataset: { repo: string; commit: string; path: string; snapshot: string };
    code: { repo: string; tag: string; commit: string; stripPrefix?: string };
  };
  narration: NarrationConfig;
  excerpts: ExcerptSpec[];
  statePanel?: StatePanel;
  scenes: Scene[];
};

export type NarrationConfig = {
  provider: "elevenlabs";
  voice: { name: string; id: string };
  model: string;
  outputFormat: string;
  leadIn: number; // default silence before a scene's speech, s
  tail: number; // padding after the last spoken letter, s
  stepLead: number; // a step lights this long before its first word, s
};

/** A code range pinned at sources.code.commit. */
export type ExcerptSpec = {
  id: string;
  path: string;
  blob: string; // git blob SHA of `path` at the commit
  symbol: string; // must appear at or above lines[1]
  lines: Range;
  /** lines[0] starts with `symbol` and lines[1] is the closing "}". */
  wholeFunction?: boolean;
  elementId?: string; // the element this code implements
  relationshipId?: string; // or the relationship it implements
  /** Dataset source selector naming this code; cited by the relationship, else the element. */
  datasetSourceId?: string;
};

export type StatePanel = {
  title: string;
  fields: StateField[];
};
export type StateField =
  | { id: string; label: string; kind: "text"; initial: string }
  | { id: string; label: string; kind: "counter"; initial: number; suffix?: string }
  | { id: string; label: string; kind: "slots"; of: number; initial: number; note?: string };

/** A value change on the state panel, at a cue (or the scene start). */
export type StateChange = {
  field: string;
  value: string | number;
  tone?: Tone;
  cue?: string;
  duration?: number; // tween length for counters, s
};

export type Tone = "ok" | "warn" | "accent";

/** Spoken-line fields shared by scenes and steps. */
export type Line = {
  caption: string; // on screen
  speech?: string; // sent to TTS when the caption is not speakable as written
};

export type NarrationSpec = {
  take?: string; // take file stem under narration/; defaults to the scene id
  leadIn?: number; // overrides NarrationConfig.leadIn
  /** Named animation cues, each anchored on a phrase of the spoken text. */
  cues?: Record<string, string>;
};

type SceneBase = Line & {
  id: string;
  narration?: NarrationSpec;
  minDuration?: number;
  datasetStep?: string; // scenario step id in the dynamic view
  state?: StateChange[];
};

export type Hop = {
  from: string;
  to: string;
  edge?: string; // relationship to light while the packet rides it
  cue?: string;
  after?: number; // extra delay after the cue, s
  arrive?: boolean; // time the hop to *end* on the cue instead of starting there
  duration?: number; // s, default 1.1
};
export type Packet = { label: string; cue?: string };

export type DiagramScene = SceneBase & {
  kind: "architecture-overview" | "focus-element" | "follow-request" | "state-change";
  view: string;
  title?: string;
  elementId?: string; // focus-element
  packet?: Packet;
  hops?: Hop[];
  badge?: { elementId: string; text: string; tone: Tone; cue?: string };
  skip?: { elements: string[]; edges: string[]; note?: string; cue?: string };
};

export type Step = Line & { id: string; label: string; lines: Range };

export type CodeScene = SceneBase & {
  kind: "code-explanation";
  excerpt: string;
  /** Diagram kept on screen as context (renderer's choice how). */
  context?: { view: string; elementId?: string };
  /** Selections, each replacing the last at its cue (or the scene start). */
  focus?: { ranges: Range[]; cue?: string }[];
  /** Stepped walk through the excerpt; each step's text is one part of the take. */
  steps?: Step[];
  railTitle?: string;
  packet?: Packet;
  hops?: Hop[];
};

export type Scene = DiagramScene | CodeScene;
export type SceneKind = Scene["kind"];

export const DIAGRAM_KINDS = ["architecture-overview", "focus-element", "follow-request", "state-change"] as const;
export const isCodeScene = (s: Scene): s is CodeScene => s.kind === "code-explanation";

/** What TTS speaks for a scene: steps' parts joined by spaces, else the line. */
export const spokenParts = (s: Scene): string[] =>
  isCodeScene(s) && s.steps ? s.steps.map((st) => st.speech ?? st.caption) : [s.speech ?? s.caption];
export const spokenText = (s: Scene): string => spokenParts(s).join(" ");
export const takeId = (s: Scene): string => s.narration?.take ?? s.id;
