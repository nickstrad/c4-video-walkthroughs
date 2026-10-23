import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { cues, storyboard } from "./storyboard";
import { C, SANS } from "./theme";

/**
 * Caption track for the narration. Each cue fades in over 8 frames; cue
 * times follow the speech because narrate.mjs retimes the storyboard.
 */
export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / storyboard.fps;
  const cue = cues.find((c) => t >= c.start && t < c.end);
  if (!cue) return null;
  const local = frame - cue.start * storyboard.fps;
  const opacity = interpolate(local, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", pointerEvents: "none" }}>
      <div style={{
        marginBottom: 26, maxWidth: 1100, padding: "14px 26px", borderRadius: 10,
        background: "rgba(36, 42, 51, 0.92)", boxShadow: "0 4px 18px rgba(0,0,0,0.35)", color: "#f0f3f6", fontFamily: SANS, fontSize: 25,
        lineHeight: 1.35, textAlign: "center", opacity, borderLeft: `4px solid ${C.glow}`,
      }}>
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
