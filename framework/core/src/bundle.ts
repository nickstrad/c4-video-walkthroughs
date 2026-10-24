// The render bundle: the whole contract between core and a renderer. A
// renderer reads build/bundle.json and plays build/track.wav; it never reads
// the dataset, git, the takes or ElevenLabs. Everything here is browser-safe.
import type { Excerpt } from "./code-source/types.ts";
import type { Layout } from "./diagram/geometry.ts";
import type { View } from "./diagram/view.ts";
import type { Timeline } from "./narration/types.ts";
import type { Credits, RepoFacts } from "./ingest/types.ts";
import type { Storyboard } from "./storyboard/schema.ts";

export const BUNDLE_SCHEMA = "c4v-bundle/1";

export type RenderBundle = {
  schema: typeof BUNDLE_SCHEMA;
  storyboard: Storyboard;
  timeline: Timeline;
  views: Record<string, { view: View; layout: Layout }>;
  excerpts: Record<string, Excerpt>;
  /** Repo facts at the pin; present when a beat needs git-log (a repo-card). */
  repo?: RepoFacts;
  /** Blame over the shown excerpts; present when a beat needs git-blame (a credits scene). */
  credits?: Credits;
  provenance: {
    dataset: { repo: string; commit: string; path: string; revision: string; sha256: string };
    code: { repo: string; tag: string; commit: string };
    builtWith: string;
  };
};
