// The act tracker (audit-34 item 10, story-arc plan § 2.7): a chrome layer,
// not a scene kind, drawn over every beat when the storyboard declares an
// arc. One chip per beat, the current one lit with its progress; the strip
// is bright as a beat begins and settles back while it plays. Everything it
// shows comes from core's arcProgressAt.
import React from "react";
import { arcProgressAt, type RenderBundle } from "../../core/src/index.ts";
import { ramp } from "./anim.ts";
import { LOWER_THIRD } from "./stage.ts";
import { C, MONO, SANS, mix } from "./theme.ts";

export const LowerThird: React.FC<{ bundle: RenderBundle; t: number }> = ({ bundle, t }) => {
  const arc = arcProgressAt(bundle, t);
  if (!arc) return null;
  const cur = bundle.timeline.acts!.find((a) => a.id === arc.beats[arc.index].id)!;
  const since = t - cur.start;
  // Bright for the first seconds of a beat, then settle back; in from the first frame.
  const lift = 1 - ramp(since - 3.2, 0.8);
  const opacity = ramp(t - 0.3, 0.6) * (0.62 + 0.38 * lift);
  return (
    <div style={{
      position: "absolute", left: LOWER_THIRD.x, top: LOWER_THIRD.y, width: LOWER_THIRD.w, height: LOWER_THIRD.h,
      display: "flex", alignItems: "center", gap: 8, opacity, fontFamily: SANS, pointerEvents: "none",
    }}>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted, marginRight: 4 }}>
        {arc.index + 1}/{arc.beats.length}
      </span>
      {arc.beats.map((b) => {
        const on = b.state === "current";
        const done = b.state === "done";
        const k = on ? ramp(since, 0.5) : 0;
        return (
          <div key={b.id} style={{
            position: "relative", height: LOWER_THIRD.h - 4, display: "flex", alignItems: "center", padding: "0 12px",
            borderRadius: 6, overflow: "hidden", boxSizing: "border-box",
            background: on ? mix(C.panel, C.accentFill, k) : C.panel,
            border: `1px solid ${on ? mix(C.border, C.glow, k) : C.border}`,
            color: on ? C.ink : done ? C.muted : C.faint,
            fontSize: 12.5, fontWeight: on ? 700 : 400, whiteSpace: "nowrap",
          }}>
            {b.label}
            {on && <div style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: `${100 * arc.within}%`, background: C.glow }} />}
            {done && <div style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: "100%", background: C.line }} />}
          </div>
        );
      })}
    </div>
  );
};
