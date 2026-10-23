// Caption track: timeline.captions (absolute), each fading in briefly.
import React from "react";
import { captionAt, type RenderBundle } from "../../core/src/index.ts";
import { ramp } from "./anim.ts";
import { C, SANS } from "./theme.ts";

export const Captions: React.FC<{ bundle: RenderBundle; t: number }> = ({ bundle, t }) => {
  const cap = captionAt(bundle, t);
  if (!cap) return null;
  const opacity = ramp(t - cap.start, 0.25);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 18, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{
        maxWidth: 1180, padding: "12px 26px", borderRadius: 10, boxSizing: "border-box",
        background: "rgba(36, 42, 51, 0.94)", boxShadow: "0 4px 18px rgba(0,0,0,0.45)", color: "#f0f3f6",
        fontFamily: SANS, fontSize: 23, lineHeight: 1.35, textAlign: "center", opacity, borderLeft: `4px solid ${C.glow}`,
      }}>
        {cap.text}
      </div>
    </div>
  );
};
