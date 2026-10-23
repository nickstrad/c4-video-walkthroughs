// Draws any View + Layout from the bundle through a camera. Geometry is the
// bundle's (elkjs boxes and routed edges); this file only paints it. Boxes and
// edges live on a scaled "board"; the packet, badges and notes are drawn in
// screen space so they stay readable at any zoom.
import React from "react";
import type { Box, Layout, Point, View } from "../../core/src/index.ts";
import type { Beats } from "./beats.ts";
import type { Cam } from "./camera.ts";
import { C, KIND, MONO, SANS, TONE, mix } from "./theme.ts";

export type EmphasisW = { id: string; mode: "focus" | "context"; w: number };

export type DiagramProps = {
  view: View;
  layout: Layout;
  cam: Cam;
  /** Screen box the camera centres on (design px). */
  viewport: Box;
  /** Screen box the diagram is clipped to. */
  clip: Box;
  /** 0 = borderless full screen, 1 = framed context strip. */
  framed: number;
  emphasis: EmphasisW[];
  beats: Beats;
  opacity: number;
  /** Absolute time, s (pulses). */
  t: number;
};

const eyebrow = (kind: string, tech: string | null) => [KIND[kind] ?? kind, tech].filter(Boolean).join(" · ").toUpperCase();

export const Diagram: React.FC<DiagramProps> = ({ view, layout, cam, viewport, clip, framed, emphasis, beats, opacity, t }) => {
  if (opacity <= 0.001) return null;
  const s = cam.scale;
  const ox = viewport.x + viewport.w / 2 - cam.cx * s - clip.x;
  const oy = viewport.y + viewport.h / 2 - cam.cy * s - clip.y;
  const screen = (p: Point) => ({ x: ox + p.x * s, y: oy + p.y * s });
  const ui = Math.max(0.8, Math.min(1.2, s / 0.8)); // overlay size factor

  const focus = emphasis.filter((e) => e.mode === "focus");
  const focusW = Math.max(0, ...focus.map((e) => e.w));
  const focusOf = (id: string) => Math.max(0, ...focus.filter((e) => e.id === id).map((e) => e.w));
  const ctxOf = (id: string) => Math.max(0, ...emphasis.filter((e) => e.mode === "context" && e.id === id).map((e) => e.w));
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);

  const scope = view.scope && layout.boxes[view.scope.id] ? { el: view.scope, b: layout.boxes[view.scope.id] } : null;

  return (
    <div style={{
      position: "absolute", left: clip.x, top: clip.y, width: clip.w, height: clip.h, overflow: "hidden", opacity,
      borderRadius: 10 * framed, background: C.bg,
      boxShadow: `inset 0 0 0 1px rgba(48, 54, 61, ${framed})`,
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, width: layout.width, height: layout.height,
        transformOrigin: "0 0", transform: `translate(${ox}px, ${oy}px) scale(${s})`, fontFamily: SANS,
      }}>
        {scope && (
          <div style={{
            position: "absolute", left: scope.b.x, top: scope.b.y, width: scope.b.w, height: scope.b.h, boxSizing: "border-box",
            border: `1.5px dashed ${C.line}`, borderRadius: 8, background: C.boundary, opacity: 1 - 0.5 * focusW,
          }}>
            <div style={{ padding: "6px 10px 0", fontSize: 13, fontWeight: 700, color: C.ink }}>{scope.el.name}</div>
            <div style={{ padding: "0 10px", fontSize: 9.5, color: C.muted }}>
              [{[KIND[scope.el.kind] ?? scope.el.kind, scope.el.technology].filter(Boolean).join(" · ")}]
            </div>
          </div>
        )}

        <svg width={layout.width} height={layout.height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {view.edges.map((e) => {
            const r = layout.routes[e.id];
            if (!r || r.points.length < 2) return null;
            const touch = Math.max(focusOf(e.from), focusOf(e.to));
            const hot = beats.hot[e.id] ?? 0, seen = beats.visited[e.id] ?? 0, dim = beats.dim[e.id] ?? 0;
            let col = mix(C.line, C.accent, seen);
            col = mix(col, C.glow, touch);
            col = mix(col, C.packet, hot);
            const width = 1.5 + 1.5 * Math.max(touch, hot, seen * 0.4);
            const op = (1 - 0.72 * dim) * (1 - 0.65 * focusW * (1 - touch));
            const pts = r.points;
            const a = pts[pts.length - 2], b = pts[pts.length - 1];
            const ang = Math.atan2(b.y - a.y, b.x - a.x);
            const ah = 9 + width;
            const head = [
              [b.x, b.y],
              [b.x - ah * Math.cos(ang - 0.42), b.y - ah * Math.sin(ang - 0.42)],
              [b.x - ah * Math.cos(ang + 0.42), b.y - ah * Math.sin(ang + 0.42)],
            ].map((p) => p.join(",")).join(" ");
            const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
            return (
              <g key={e.id} opacity={op}>
                <path d={d} fill="none" stroke={col} strokeWidth={width} strokeLinejoin="round" />
                <polygon points={head} fill={col} />
                {r.label?.lines.map((ln, i) => (
                  <text key={i} x={r.label!.x + r.label!.w / 2} y={r.label!.y + 10 + i * 13} textAnchor="middle"
                    fontSize={10} fill={mix(C.muted, C.ink, Math.max(touch, hot))} fontFamily={SANS}>{ln}</text>
                ))}
              </g>
            );
          })}
        </svg>

        {view.nodes.map((n) => {
          const b = layout.boxes[n.id];
          if (!b) return null;
          const f = focusOf(n.id), cx = ctxOf(n.id);
          const lit = beats.lit[n.id] ?? 0, arrive = beats.arrive[n.id] ?? 0, dim = beats.dim[n.id] ?? 0;
          let bg = n.external ? C.external : C.panel;
          bg = mix(bg, C.accentFill, Math.max(cx * 0.8, f));
          let border = mix(C.line, C.accent, Math.max(lit, cx));
          border = mix(border, C.glow, f);
          const glow = Math.max(f * (0.55 + 0.45 * pulse), arrive);
          const op = (1 - 0.7 * dim) * (1 - 0.6 * focusW * (1 - f));
          return (
            <div key={n.id} style={{
              position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: "border-box", overflow: "hidden",
              background: bg, border: `${1.5 + Math.max(lit, f, cx)}px solid ${border}`, borderRadius: n.kind === "person" ? 18 : 8,
              padding: "8px 10px", textAlign: "center", opacity: op, color: C.ink,
              boxShadow: glow > 0.01 ? `0 0 ${6 + 18 * glow}px ${3 * glow}px ${f > arrive ? C.glow : C.accent}99` : "none",
            }}>
              <div style={{ fontSize: 8.5, letterSpacing: 0.6, fontWeight: 700, color: C.muted }}>{eyebrow(n.kind, n.technology)}</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, margin: "4px 0 5px", lineHeight: 1.2 }}>{n.name}</div>
              <div style={{ fontSize: 10, lineHeight: 1.3, color: mix(C.muted, C.ink, f) }}>{n.description}</div>
            </div>
          );
        })}
      </div>

      {/* screen-space overlays */}
      {beats.notes.map((nt, i) => {
        const bs = nt.ids.map((id) => layout.boxes[id]).filter(Boolean);
        if (!bs.length) return null;
        const x = (Math.min(...bs.map((b) => b.x)) + Math.max(...bs.map((b) => b.x + b.w))) / 2;
        const p = screen({ x, y: Math.min(...bs.map((b) => b.y)) });
        return (
          <div key={`note-${i}`} style={{
            position: "absolute", left: p.x, top: p.y - 6 * ui, transform: "translate(-50%, -100%)", opacity: nt.k,
            fontFamily: SANS, fontSize: 13 * ui, color: C.muted, whiteSpace: "nowrap", fontStyle: "italic",
          }}>{nt.text}</div>
        );
      })}
      {beats.badges.map((bd, i) => {
        const b = layout.boxes[bd.elementId];
        if (!b) return null;
        const p = screen({ x: b.x + b.w / 2, y: b.y + b.h });
        return (
          <div key={`badge-${i}`} style={{
            position: "absolute", left: p.x, top: p.y + 7 * ui, transform: `translate(-50%, 0) scale(${0.85 + 0.15 * bd.k})`,
            opacity: bd.k, background: TONE[bd.tone] ?? C.accent, color: C.bg, fontFamily: SANS, fontWeight: 700,
            fontSize: 13 * ui, padding: `${3 * ui}px ${10 * ui}px`, borderRadius: 6, whiteSpace: "nowrap",
          }}>{bd.text}</div>
        );
      })}
      {beats.packet && (() => {
        const p = screen(beats.packet.at);
        return (
          <>
            <div style={{
              position: "absolute", left: p.x - 5 * ui, top: p.y - 5 * ui, width: 10 * ui, height: 10 * ui, borderRadius: "50%",
              background: C.packet, boxShadow: `0 0 10px 2px ${C.packet}88`, opacity: beats.packet.k,
            }} />
            <div style={{
              position: "absolute", left: p.x, top: p.y - 9 * ui, transform: "translate(-50%, -100%)", opacity: beats.packet.k,
              background: C.packet, color: C.bg, fontFamily: MONO, fontWeight: 700, fontSize: 13 * ui,
              padding: `${3 * ui}px ${10 * ui}px`, borderRadius: 12 * ui, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}>{beats.packet.label}</div>
          </>
        );
      })()}
    </div>
  );
};
