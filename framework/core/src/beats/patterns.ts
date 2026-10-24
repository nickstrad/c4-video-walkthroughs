// Arc patterns as data: a template of roles, each slot required or optional,
// in order. An arc instance may omit optional slots; acts outside the arc are
// allowed only when marked optional. Design: docs/story-arc-plan.md § 1.1.
// `gains` is in no pattern while it is deferred (§ 10); `change` arrives with
// build item 8.
import type { BeatRole } from "../storyboard/schema.ts";

export type PatternSlot = { role: BeatRole; required: boolean };
export type Pattern = { id: string; slots: PatternSlot[] };

export const PATTERNS: Record<string, Pattern> = {
  walkthrough: {
    id: "walkthrough",
    slots: [
      { role: "repo-intro", required: true },
      { role: "architecture", required: true },
      { role: "focus", required: true },
      { role: "deep-dive", required: true },
      { role: "shoutout", required: false },
    ],
  },
};
