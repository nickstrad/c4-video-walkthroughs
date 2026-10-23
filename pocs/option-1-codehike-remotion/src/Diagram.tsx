import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import view from "../data/view.json";
import layout from "../data/layout.json";
import { C, SANS } from "./theme";

type Box = { x: number; y: number; w: number; h: number };
type Route = {
  points: { x: number; y: number }[];
  label?: { x: number; y: number; w: number; h: number; lines: string[] };
};
const boxes = layout.boxes as Record<string, Box>;
const routes = layout.routes as Record<string, Route>;

const kindLabel = (kind: string, technology: string | null) => {
  const k = { component: "Component", container: "Data store", softwareSystem: "External software system" }[kind] ?? kind;
  return [k, technology].filter(Boolean).join(" · ").toUpperCase();
};

const ease = Easing.inOut(Easing.cubic);

/**
 * The C4 view as a camera-filmed board. `focusAt`/`zoomAt` are frame numbers
 * relative to this sequence: the focus element lights up and everything else
 * dims at focusAt; the camera flies to it from zoomAt over zoomFrames.
 */
export const Diagram: React.FC<{
  focusId: string;
  focusAt: number;
  zoomAt: number;
  zoomFrames: number;
  width: number;
  height: number;
}> = ({ focusId, focusAt, zoomAt, zoomFrames, width, height }) => {
  const frame = useCurrentFrame();
  const lit = interpolate(frame, [focusAt, focusAt + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [zoomAt, zoomAt + zoomFrames], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Camera: from "fit whole view above the caption band" to "focus box fills
  // ~45% of the width", centred on the box. Log-space scale keeps the move even.
  const viewH = height - 150;
  const fit = Math.min((width - 60) / layout.width, viewH / layout.height);
  const f = boxes[focusId];
  const near = (width * 0.45) / f.w;
  const scale = Math.exp(interpolate(zoom, [0, 1], [Math.log(fit), Math.log(near)]));
  const cx = interpolate(zoom, [0, 1], [layout.width / 2, f.x + f.w / 2]);
  const cy = interpolate(zoom, [0, 1], [layout.height / 2, f.y + f.h / 2]);
  const tx = width / 2 - cx * scale;
  const ty = 20 + viewH / 2 - cy * scale;
  const pulse = 0.5 + 0.5 * Math.sin((frame - focusAt) / 6);

  const scope = view.scope!;
  const sb = boxes[scope.id];
  const isFocusEdge = (from: string, to: string) => from === focusId || to === focusId;

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: SANS, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute", left: 0, top: 0, width: layout.width, height: layout.height,
          transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        }}
      >
        {/* boundary */}
        <div style={{ position: "absolute", left: sb.x, top: sb.y, width: sb.w, height: sb.h, border: `1.5px solid ${C.line}`, borderRadius: 6, background: C.boundary }}>
          <div style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, color: C.ink }}>{scope.name}</div>
          <div style={{ padding: "0 10px", fontSize: 9, color: C.muted }}>{scope.technology} · container boundary</div>
        </div>
        {/* edges */}
        <svg width={layout.width} height={layout.height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.line} />
            </marker>
            <marker id="arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.glow} />
            </marker>
          </defs>
          {view.edges.map((e) => {
            const r = routes[e.id];
            const hot = isFocusEdge(e.from, e.to);
            const d = r.points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
            return (
              <g key={e.id} opacity={hot ? 1 : 1 - 0.65 * lit}>
                <path d={d} fill="none" stroke={hot && lit > 0 ? C.glow : C.line} strokeWidth={hot ? 1.2 + 1.3 * lit : 1.2} markerEnd={`url(#${hot && lit > 0 ? "arrow-hot" : "arrow"})`} />
                {r.label && r.label.lines.map((ln, i) => (
                  <text key={i} x={r.label!.x + r.label!.w / 2} y={r.label!.y + 10 + i * 13} textAnchor="middle" fontSize={10} fill={C.muted}>{ln}</text>
                ))}
              </g>
            );
          })}
        </svg>
        {/* elements */}
        {view.nodes.map((n) => {
          const b = boxes[n.id];
          const focus = n.id === focusId;
          const ext = n.tags.includes("external");
          const bg = focus ? `color-mix(in srgb, ${C.accent} ${lit * 100}%, ${C.box})` : ext ? C.external : C.box;
          const fg = focus && lit > 0.5 ? "#ffffff" : C.ink;
          return (
            <div
              key={n.id}
              style={{
                position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: "border-box",
                background: bg, color: fg, border: `1.5px solid ${focus && lit > 0 ? C.glow : C.line}`, borderRadius: 6,
                padding: "8px 10px", textAlign: "center", opacity: focus ? 1 : 1 - 0.6 * lit,
                boxShadow: focus && lit > 0 ? `0 0 ${6 + 16 * pulse * lit}px ${4 * lit}px ${C.glow}aa` : "none",
              }}
            >
              <div style={{ fontSize: 7.5, letterSpacing: 0.6, fontWeight: 700, opacity: 0.75 }}>{kindLabel(n.kind, n.technology)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, margin: "4px 0 5px" }}>{n.name}</div>
              <div style={{ fontSize: 9.5, lineHeight: 1.3, opacity: 0.9 }}>{n.description}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
