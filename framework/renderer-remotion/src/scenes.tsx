// The scene registry: storyboard scene kind → how that scene is shot. A shot
// says which diagram (view, camera, placement, emphasis), which code pane and
// whether the state panel are on screen; the Walkthrough's layers blend one
// shot into the next (camera moves, crossfades). A kind may also add an
// Overlay component that plays inside its own <Sequence>.
//
// Seam: a new story-arc scene kind is one more entry here — a `shot` built
// from the existing cameras/regions (or new ones) plus an optional Overlay.
import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { approachOf, isCodeScene, isDiagramScene, type Box, type DiagramScene, type Scene, type TimedScene } from "../../core/src/index.ts";
import { cameras, type Camera } from "./camera.ts";
import { CreditsCard, RepoCard, Responsibilities } from "./cards.tsx";
import { CODE_ALONE, CODE_UNDER_STRIP, FOCUS_LEFT, FRAME, FULL, FULL_UNDER_PANEL, PANEL, STRIP, withRail } from "./stage.ts";
import type { Story } from "./story.ts";
import { C, MONO, SANS } from "./theme.ts";

export type Emphasis = { id: string; mode: "focus" | "context"; at: number };
export type DiagramShot = {
  view: string;
  camera: Camera;
  viewport: Box;
  clip: Box;
  framed: number;
  emphasis?: Emphasis;
  /** Diagram opacity (default 1): a card dims the view behind it. */
  opacity?: number;
};
export type CodeShot = { excerpt: string; run: number; box: Box; rail?: Box };
export type HeaderShot = { key: string; eyebrow: string; title: string; detail: string };
export type Shot = { diagram?: DiagramShot; code?: CodeShot; panel?: Box; header?: HeaderShot };

export type SceneCtx = { story: Story; i: number; scene: Scene; timed: TimedScene };
export type SceneDef = { shot: (c: SceneCtx) => Shot; Overlay?: React.FC<{ ctx: SceneCtx }> };

const viewHeader = (c: SceneCtx, viewId: string): HeaderShot => {
  const v = c.story.view(viewId).view;
  return { key: viewId, eyebrow: `C4 · ${v.kind} view`.toUpperCase(), title: v.title, detail: `dataset ${v.datasetRevision}` };
};
const full = (view: string, camera: Camera, viewport: Box = FULL): DiagramShot =>
  ({ view, camera, viewport, clip: FRAME, framed: 0 });
const hasPanel = (c: SceneCtx) => !!c.story.bundle.storyboard.statePanel;

/** Follow the action: the scene's hop ends, badge and skipped elements. */
function followShot(c: SceneCtx): Shot {
  const s = c.scene;
  if (!isDiagramScene(s)) throw new Error(`${s.id}: not a diagram scene`);
  const { layout } = c.story.view(s.view);
  const ids = [
    ...(s.hops ?? []).flatMap((h) => [h.from, h.to]),
    ...(s.badge ? [s.badge.elementId] : []),
    ...(s.skip?.elements ?? []),
  ];
  const panel = hasPanel(c) && !!s.state?.length;
  return {
    diagram: full(s.view, ids.length ? cameras.follow(layout, ids, 1.1) : cameras.whole(layout), panel ? FULL_UNDER_PANEL : FULL),
    panel: panel ? PANEL : undefined,
    header: viewHeader(c, s.view),
  };
}

/** Big title card for an overview: view kind, title, dataset revision. */
const TitleCard: React.FC<{ ctx: SceneCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = ctx.scene;
  if (!isDiagramScene(s)) return null;
  const v = ctx.story.view(s.view).view;
  // A descend/settle clears the title as the camera starts to move.
  const ap = approachOf(ctx.story.bundle, s.id);
  const d = ap ? Math.min(ctx.timed.duration, ap.at + 0.9) : ctx.timed.duration;
  const opacity = interpolate(frame / fps, [0.4, 0.8, Math.max(0.9, d - 1), Math.max(1, d - 0.4)], [0, 1, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <div style={{ position: "absolute", left: 40, top: 22, opacity, fontFamily: SANS }}>
      <div style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 700, color: C.muted }}>C4 · {v.kind.toUpperCase()} VIEW</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.ink, marginTop: 4 }}>{s.title ?? v.title}</div>
      <div style={{ fontSize: 13, color: C.muted, fontFamily: MONO, marginTop: 4 }}>dataset revision {v.datasetRevision}</div>
    </div>
  );
};

type DiagramOf = DiagramScene;

export const SCENE_KINDS: Record<string, SceneDef> = {
  "architecture-overview": {
    shot: (c) => {
      const s = c.scene as DiagramOf;
      const { layout } = c.story.view(s.view);
      // Descend: light the element on its cue, then dive into it as the scene
      // ends (the next scene crossfades to its detail view). Settle: light it
      // and let the camera come to rest on it for the focus beat.
      const ap = approachOf(c.story.bundle, s.id);
      if (!ap) return { diagram: full(s.view, cameras.whole(layout)) };
      const d = c.timed.duration;
      const camera = ap.mode === "descend"
        ? cameras.zoom(layout, ap.elementId, Math.max(ap.at + 0.5, d - 1.3), d, 0.92)
        : cameras.zoom(layout, ap.elementId, ap.at + 0.3, Math.min(d, ap.at + 1.8), 0.22);
      return { diagram: { ...full(s.view, camera), emphasis: { id: ap.elementId, mode: "focus", at: ap.at } } };
    },
    Overlay: TitleCard,
  },
  "focus-element": {
    shot: (c) => {
      const s = c.scene as DiagramOf;
      if (!s.elementId) throw new Error(`${s.id}: focus-element needs elementId`);
      const { layout } = c.story.view(s.view);
      // After an overview that settled on this element the camera is already
      // there: hold it (the layer blends over). Otherwise light first, then fly in.
      const prev = c.i > 0 ? c.story.scenes[c.i - 1] : undefined;
      const settled = !!prev && !isCodeScene(prev) && prev.kind === "architecture-overview" && prev.view === s.view && prev.settle?.elementId === s.elementId;
      const list = !!s.responsibilities?.length;
      const camera = settled
        ? cameras.zoom(layout, s.elementId, 0, 0, list ? 0.38 : 0.45)
        : cameras.zoom(layout, s.elementId, 0.8, Math.max(1.2, c.timed.duration - 0.4), list ? 0.38 : 0.45);
      return { diagram: { ...full(s.view, camera, list ? FOCUS_LEFT : FULL), emphasis: { id: s.elementId, mode: "focus", at: 0 } } };
    },
    Overlay: Responsibilities,
  },
  "repo-card": {
    // The card over its view, dimmed far back; the next scene on that view brings it forward.
    shot: (c) => {
      const s = c.scene;
      if (s.kind !== "repo-card" || !s.view) return {};
      return { diagram: { ...full(s.view, cameras.whole(c.story.view(s.view).layout)), opacity: 0.07 } };
    },
    Overlay: RepoCard,
  },
  credits: { shot: () => ({}), Overlay: CreditsCard },
  "follow-request": { shot: followShot },
  "state-change": { shot: followShot },
  "code-explanation": {
    shot: (c) => {
      const s = c.scene;
      if (!isCodeScene(s)) throw new Error(`${s.id}: not a code scene`);
      const ctx = c.story.contextOf(c.i);
      const panel = hasPanel(c) && (!!ctx || !!s.state?.length);
      const area = ctx || panel ? CODE_UNDER_STRIP : CODE_ALONE;
      const { code, rail } = withRail(area, !!s.steps);
      let diagram: DiagramShot | undefined;
      if (ctx) {
        const { view, layout } = c.story.view(ctx.view);
        diagram = {
          view: ctx.view, camera: cameras.around(view, layout, ctx.elementId), viewport: STRIP, clip: STRIP, framed: 1,
          emphasis: ctx.elementId ? { id: ctx.elementId, mode: "context", at: 0 } : undefined,
        };
      }
      return { diagram, code: { excerpt: s.excerpt, run: c.story.runOf(c.i), box: code, rail }, panel: panel ? PANEL : undefined };
    },
  },
};

export function shotOf(story: Story, i: number): Shot {
  const scene = story.scenes[i];
  const def = SCENE_KINDS[scene.kind];
  if (!def) throw new Error(`no renderer for scene kind "${scene.kind}" (${scene.id}); add it to SCENE_KINDS`);
  return def.shot({ story, i, scene, timed: story.timed[i] });
}
