// The storyboard's state panel, driven by core's stateAt/stateEvents. A field
// flashes briefly when an event changes it.
import React from "react";
import { stateAt, stateEvents, type Box, type RenderBundle, type StateField } from "../../core/src/index.ts";
import { ramp } from "./anim.ts";
import { C, MONO, SANS, TONE } from "./theme.ts";

export const StatePanel: React.FC<{ bundle: RenderBundle; t: number; box: Box; opacity: number }> = ({ bundle, t, box, opacity }) => {
  const sp = bundle.storyboard.statePanel;
  if (!sp || opacity <= 0.001) return null;
  const vals = stateAt(bundle, t);
  const events = stateEvents(bundle);
  const flash = (f: StateField) => {
    const last = events.filter((e) => e.field === f.id && e.at <= t).at(-1);
    return last ? 1 - ramp(t - last.at - (last.duration ?? 0), 0.9) : 0;
  };
  const labelW = Math.max(...sp.fields.map((f) => f.label.length)) * 0.602 * 15 + 14;
  return (
    <div style={{
      position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, boxSizing: "border-box", opacity,
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", overflow: "hidden",
    }}>
      <div style={{ fontFamily: SANS, fontSize: 12, color: C.muted, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {sp.title}
      </div>
      {sp.fields.map((f) => {
        const v = vals[f.id];
        const tone = v.tone ? TONE[v.tone] : undefined;
        const k = flash(f);
        let body: React.ReactNode;
        if (f.kind === "slots") {
          const n = Math.round(Number(v.value));
          body = (
            <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
              {Array.from({ length: f.of }, (_, j) => (
                <span key={j} style={{
                  width: 22, height: 15, borderRadius: 3, boxSizing: "border-box", display: "inline-block",
                  border: `2px solid ${j < n ? C.packet : C.muted}`, background: j < n ? C.packet : "transparent",
                }} />
              ))}
              {f.note && <span style={{ fontSize: 12.5, color: C.muted, marginLeft: 4 }}>{f.note}</span>}
            </span>
          );
        } else if (f.kind === "counter") {
          body = <span style={{ color: tone ?? C.packet }}>{Math.round(Number(v.value))}{f.suffix ?? ""}</span>;
        } else {
          body = <span style={{ color: tone ?? C.muted }}>{String(v.value)}</span>;
        }
        return (
          <div key={f.id} style={{
            display: "flex", alignItems: "center", fontFamily: MONO, fontSize: 15, height: 30, borderRadius: 5,
            background: `rgba(240, 180, 41, ${0.16 * k})`, margin: "0 -6px", padding: "0 6px", whiteSpace: "nowrap",
          }}>
            <span style={{ width: labelW, color: C.ink, flexShrink: 0 }}>{f.label}</span>
            {body}
          </div>
        );
      })}
    </div>
  );
};
