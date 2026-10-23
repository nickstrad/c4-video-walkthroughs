// The whole video as layers over one timeline. Each timed scene maps to a
// shot through the kind registry (scenes.tsx); at every scene start the layers
// blend from the previous shot: same view → the camera moves, different view
// → crossfade; same code run → the selection moves, new excerpt → crossfade.
// One narration track plays from frame 0.
import React, { useMemo } from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Box } from "../../core/src/index.ts";
import { beatsAt } from "./beats.ts";
import { mixCam } from "./camera.ts";
import { Captions } from "./Captions.tsx";
import { CodePanel } from "./CodePanel.tsx";
import { Diagram, type EmphasisW } from "./Diagram.tsx";
import { fadeIn, fadeOut, lerp, lerpBox, ramp } from "./anim.ts";
import type { RenderProps } from "./props.ts";
import { SCENE_KINDS, shotOf, type DiagramShot, type HeaderShot, type Shot } from "./scenes.tsx";
import { StatePanel } from "./StatePanel.tsx";
import { buildStory, sceneIndexAt, type Story } from "./story.ts";
import { C, DESIGN, MONO, SANS } from "./theme.ts";

/** Seconds a shot takes to blend into the next. */
const TRANS = 0.8;

export const Walkthrough: React.FC<RenderProps> = ({ bundle, code }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const story = useMemo(() => buildStory(bundle), [bundle]);
  const shots = useMemo(() => story.scenes.map((_, i) => shotOf(story, i)), [story]);

  const t = frame / fps;
  const i = sceneIndexAt(story, t);
  const ts = story.timed[i];
  const rel = t - ts.start;
  const cur = shots[i];
  const prev: Shot = i > 0 ? shots[i - 1] : {};
  const prevEnd = i > 0 ? story.timed[i - 1].duration : 0;
  const k = ramp(rel, i > 0 ? TRANS : 0.5);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{
        position: "absolute", left: 0, top: 0, width: DESIGN.w, height: DESIGN.h, overflow: "hidden",
        transformOrigin: "0 0", transform: `scale(${width / DESIGN.w}, ${height / DESIGN.h})`,
      }}>
        <DiagramLayer story={story} prev={prev.diagram} cur={cur.diagram} prevRel={prevEnd} rel={rel} k={k} t={t} />
        <CodeLayer story={story} shots={shots} i={i} code={code} k={k} t={t} />
        <PanelLayer story={story} prev={prev.panel} cur={cur.panel} k={k} t={t} />
        <HeaderLayer prev={prev.header} cur={cur.header} k={k} />
        {story.scenes.map((scene, j) => {
          const Overlay = SCENE_KINDS[scene.kind]?.Overlay;
          const tj = story.timed[j];
          return Overlay ? (
            <Sequence key={scene.id} from={tj.startFrame} durationInFrames={tj.frames} layout="none">
              <Overlay ctx={{ story, i: j, scene, timed: tj }} />
            </Sequence>
          ) : null;
        })}
        <Captions bundle={bundle} t={t} />
      </div>
      <Html5Audio src={staticFile(bundle.timeline.audio.file)} />
    </AbsoluteFill>
  );
};

const emph = (d: DiagramShot, rel: number, mult: number): EmphasisW[] =>
  d.emphasis && mult > 0 ? [{ id: d.emphasis.id, mode: d.emphasis.mode, w: ramp(rel - d.emphasis.at, 0.5) * mult }] : [];

const DiagramLayer: React.FC<{
  story: Story; prev?: DiagramShot; cur?: DiagramShot; prevRel: number; rel: number; k: number; t: number;
}> = ({ story, prev, cur, prevRel, rel, k, t }) => {
  const draw = (d: DiagramShot, r: number, opacity: number, key: string) => {
    const { view, layout } = story.view(d.view);
    return (
      <Diagram key={key} view={view} layout={layout} cam={d.camera(r, d.viewport)} viewport={d.viewport} clip={d.clip}
        framed={d.framed} emphasis={emph(d, r, 1)} beats={beatsAt(story, d.view, t)} opacity={opacity} t={t} />
    );
  };
  if (prev && cur && prev.view === cur.view) {
    const { view, layout } = story.view(cur.view);
    const viewport = lerpBox(prev.viewport, cur.viewport, k);
    const cam = mixCam(prev.camera(prevRel, prev.viewport), cur.camera(rel, cur.viewport), k);
    return (
      <Diagram view={view} layout={layout} cam={cam} viewport={viewport} clip={lerpBox(prev.clip, cur.clip, k)}
        framed={lerp(prev.framed, cur.framed, k)} emphasis={[...emph(prev, prevRel, 1 - k), ...emph(cur, rel, k)]}
        beats={beatsAt(story, cur.view, t)} opacity={1} t={t} />
    );
  }
  return (
    <>
      {prev && k < 1 && draw(prev, prevRel, fadeOut(k), "prev")}
      {cur && draw(cur, rel, prev ? fadeIn(k) : k, "cur")}
    </>
  );
};

const CodeLayer: React.FC<{
  story: Story; shots: Shot[]; i: number; code: RenderProps["code"]; k: number; t: number;
}> = ({ story, shots, i, code, k, t }) => {
  const cur = shots[i].code, prev = i > 0 ? shots[i - 1].code : undefined;
  const hl = (ex: string) => {
    const h = code[ex];
    if (!h) throw new Error(`no highlighted code for excerpt ${ex}; rerun scripts/prepare.mjs`);
    return h;
  };
  if (prev && cur && prev.run === cur.run) {
    const rail = cur.rail ?? prev.rail;
    const railK = cur.rail ? (prev.rail ? 1 : k) : 1 - k;
    return <CodePanel story={story} i={i} highlighted={hl(cur.excerpt)} box={lerpBox(prev.box, cur.box, k)} rail={rail} railK={railK} opacity={1} t={t} />;
  }
  return (
    <>
      {prev && k < 1 && <CodePanel key="prev" story={story} i={i - 1} highlighted={hl(prev.excerpt)} box={prev.box} rail={prev.rail} railK={1} opacity={fadeOut(k)} t={t} />}
      {cur && <CodePanel key="cur" story={story} i={i} highlighted={hl(cur.excerpt)} box={cur.box} rail={cur.rail} railK={1} opacity={prev ? fadeIn(k) : k} t={t} />}
    </>
  );
};

const PanelLayer: React.FC<{ story: Story; prev?: Box; cur?: Box; k: number; t: number }> = ({ story, prev, cur, k, t }) => {
  if (prev && cur) return <StatePanel bundle={story.bundle} t={t} box={lerpBox(prev, cur, k)} opacity={1} />;
  if (cur) return <StatePanel bundle={story.bundle} t={t} box={cur} opacity={k} />;
  if (prev) return <StatePanel bundle={story.bundle} t={t} box={prev} opacity={1 - k} />;
  return null;
};

const Header: React.FC<{ h: HeaderShot; opacity: number }> = ({ h, opacity }) => (
  <div style={{ position: "absolute", left: 32, top: 22, opacity, fontFamily: SANS, whiteSpace: "nowrap" }}>
    <span style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 700, color: C.muted }}>{h.eyebrow}</span>
    <span style={{ fontSize: 19, fontWeight: 700, color: C.ink, marginLeft: 14 }}>{h.title}</span>
    <div style={{ fontSize: 12.5, color: C.muted, fontFamily: MONO, marginTop: 5 }}>{h.detail}</div>
  </div>
);

const HeaderLayer: React.FC<{ prev?: HeaderShot; cur?: HeaderShot; k: number }> = ({ prev, cur, k }) => {
  if (prev && cur && prev.key === cur.key) return <Header h={cur} opacity={1} />;
  return (
    <>
      {prev && k < 1 && <Header h={prev} opacity={fadeOut(k)} />}
      {cur && <Header h={cur} opacity={fadeIn(k)} />}
    </>
  );
};
