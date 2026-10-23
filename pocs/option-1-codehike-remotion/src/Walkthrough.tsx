import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import type { HighlightedCode } from "codehike/code";
import view from "../data/view.json";
import { Captions } from "./Captions";
import { CodeScene } from "./CodeScene";
import { Diagram } from "./Diagram";
import { sceneById, sec, storyboard } from "./storyboard";
import { C, MONO, SANS } from "./theme";

export type WalkthroughProps = { highlighted: HighlightedCode };

const TitleCard: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12, sec(4), sec(4.6)], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 40, top: 26, opacity, fontFamily: SANS }}>
      <div style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 700, color: C.muted }}>C4 · {view.view.kind.toUpperCase()} VIEW</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.ink, marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.muted, fontFamily: MONO, marginTop: 4 }}>{view.provenance.datasetRevision}</div>
    </div>
  );
};

export const Walkthrough: React.FC<WalkthroughProps> = ({ highlighted }) => {
  const overview = sceneById("overview");
  const focus = sceneById("focus");
  const code = sceneById("code");
  const codeFrom = sec(code.start);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Diagram keeps rolling half a second under the code fade-in. */}
      <Sequence durationInFrames={codeFrom + 15}>
        <Diagram
          focusId={focus.elementId!}
          focusAt={sec(focus.start)}
          zoomAt={sec(focus.start + 0.8)}
          zoomFrames={sec(focus.duration - 0.6)}
          width={storyboard.width}
          height={storyboard.height}
        />
        <TitleCard title={overview.title!} />
      </Sequence>
      <Sequence from={codeFrom} durationInFrames={sec(code.duration)}>
        <CodeScene highlighted={highlighted} steps={code.steps!} introFrames={sec(code.intro ?? 0)} title={`${storyboard.focus.function.replace(/^func \(e \*Engine\) /, "e.")}()`} />
      </Sequence>
      <Captions />
    </AbsoluteFill>
  );
};
