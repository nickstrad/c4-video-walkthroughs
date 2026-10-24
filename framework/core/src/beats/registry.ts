// The beat registry: the one place a beat role is spelled out. A beat is a
// storyboard act with a role; its definition says which scene kinds it may
// hold, what it needs from the project and what else it checks. Renderers
// never read this; they draw scene kinds. Pure and browser-safe.
// Design: docs/story-arc-plan.md § 1.3.
import { contextAt, isCodeScene, type Act, type BeatRole, type SceneKind, type Scene, type Storyboard } from "../storyboard/schema.ts";

/** What a beat needs beyond the storyboard: the build ingests it on demand. */
export type BeatNeed = "dataset" | "code" | "git-log" | "git-blame" | "driver";

/** One beat's scenes with their indices in the storyboard. */
export type BeatScenes = { scene: Scene; i: number }[];

export type BeatDef = {
  role: BeatRole;
  kinds: SceneKind[];
  needs: BeatNeed[];
  /** Why the role cannot be used yet; a storyboard naming it fails verify with this. */
  reserved?: string;
  /** Extra checks over the beat's scenes; returns problems. */
  validate?: (beat: Act, scenes: BeatScenes, sb: Storyboard) => string[];
  /** Project data a producer may quote for this beat's narration. */
  narrationSources: ("dataset.documents" | "dataset.model" | "excerpt" | "commit" | "pr" | "issue" | "credits")[];
};

/** The element a storyboard's focus beat names (its focus-element scene), if any. */
export function focusElementOf(sb: Storyboard): string | undefined {
  const focus = sb.acts?.find((a) => a.role === "focus");
  const s = focus && sb.scenes.find((x) => x.act === focus.id && x.kind === "focus-element");
  return s && "elementId" in s ? s.elementId : undefined;
}

const reserved = (role: BeatRole, why: string): BeatDef => ({ role, kinds: [], needs: [], reserved: why, narrationSources: [] });
const DEFERRED = "deferred (docs/story-arc-plan.md § 10): the gains card is out of current scope";
const CHANGE = "reserved for the change pattern (docs/story-arc-plan.md § 5, build item 8), not built yet";

export const BEATS: Record<BeatRole, BeatDef> = {
  "repo-intro": {
    role: "repo-intro",
    kinds: ["repo-card", "architecture-overview"],
    needs: ["dataset", "code", "git-log"],
    narrationSources: ["dataset.documents", "excerpt", "commit"],
    validate: (beat, scenes) =>
      scenes[0]?.scene.kind === "repo-card" ? [] : [`beat ${beat.id}: a repo-intro opens on a repo-card`],
  },
  architecture: {
    role: "architecture",
    kinds: ["architecture-overview"],
    needs: ["dataset"],
    narrationSources: ["dataset.documents"],
  },
  focus: {
    role: "focus",
    kinds: ["focus-element", "follow-request"],
    needs: ["dataset"],
    narrationSources: ["dataset.model", "dataset.documents"],
    validate: (beat, scenes) =>
      scenes.filter((x) => x.scene.kind === "focus-element").length === 1 ? [] : [`beat ${beat.id}: a focus beat has exactly one focus-element scene`],
  },
  "deep-dive": {
    role: "deep-dive",
    kinds: ["code-explanation"],
    needs: ["code"],
    narrationSources: ["excerpt"],
    // Each excerpt shown is tied to the focus: bound to the focus element, or
    // shown with that element lit in its context diagram.
    validate: (beat, scenes, sb) => {
      const focus = focusElementOf(sb);
      if (!focus) return [];
      const errs: string[] = [];
      for (const { scene, i } of scenes) {
        if (!isCodeScene(scene)) continue;
        const x = sb.excerpts.find((e) => e.id === scene.excerpt);
        if (x?.elementId !== focus && contextAt(sb.scenes, i)?.elementId !== focus)
          errs.push(`${scene.id}: deep-dive excerpt ${scene.excerpt} is not tied to the focus element ${focus} (bind it with elementId or light it in the context)`);
      }
      return errs;
    },
  },
  shoutout: {
    role: "shoutout",
    kinds: ["credits"],
    needs: ["code", "git-blame"],
    narrationSources: ["credits", "commit"],
  },
  gains: reserved("gains", DEFERRED),
  "cold-open": reserved("cold-open", CHANGE),
  investigation: reserved("investigation", CHANGE),
  change: reserved("change", CHANGE),
  verification: reserved("verification", CHANGE),
};

/**
 * What the storyboard needs ingested: the arc's beats' needs plus what its
 * scene kinds imply (a repo-card reads git-log facts, a credits scene reads
 * blame), so an arc-less storyboard using a card still gets its data.
 */
export function needsOf(sb: Storyboard): Set<BeatNeed> {
  const needs = new Set<BeatNeed>(["dataset", "code"]);
  for (const id of sb.arc?.beats ?? []) {
    const role = sb.acts?.find((a) => a.id === id)?.role;
    for (const n of (role && BEATS[role]?.needs) || []) needs.add(n);
  }
  for (const s of sb.scenes) {
    if (s.kind === "repo-card") needs.add("git-log");
    if (s.kind === "credits") needs.add("git-blame");
  }
  return needs;
}
