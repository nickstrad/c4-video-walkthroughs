// Card overlays for the story-arc scene kinds: the repo-card (repo-intro
// beat), the credits card (shoutout beat) and the focus-element
// responsibilities list. Every string comes from the bundle through core's
// play.ts (repoFactsOf, videoCreditsOf, responsibilitiesOf) or the views.
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { repoFactsOf, responsibilitiesOf, videoCreditsOf } from "../../core/src/index.ts";
import { ramp } from "./anim.ts";
import type { SceneCtx } from "./scenes.tsx";
import { CARD, FOCUS_LIST } from "./stage.ts";
import { C, KIND, MONO, SANS } from "./theme.ts";

/** Scene-relative time and the in/out fade every card shares. */
function useCardTime(ctx: SceneCtx, hold: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rel = frame / fps;
  const out = 1 - ramp(rel - (hold - 0.5), 0.5);
  return { rel, opacity: ramp(rel - 0.15, 0.6) * out };
}

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 12.5, letterSpacing: 1.6, fontWeight: 700, color: C.muted }}>{children}</div>
);

const element = (ctx: SceneCtx, id: string) =>
  Object.values(ctx.story.bundle.views).flatMap((v) => [...v.view.nodes, ...(v.view.scope ? [v.view.scope] : [])]).find((n) => n.id === id);

export const RepoCard: React.FC<{ ctx: SceneCtx }> = ({ ctx }) => {
  const { rel, opacity } = useCardTime(ctx, ctx.timed.duration);
  const s = ctx.scene;
  if (s.kind !== "repo-card") return null;
  const b = ctx.story.bundle;
  const r = b.repo!;
  const el = element(ctx, s.elementId);
  const rows = repoFactsOf(b, s.id);
  return (
    <div style={{ position: "absolute", left: CARD.x, top: CARD.y, width: CARD.w, opacity, fontFamily: SANS }}>
      <Eyebrow>{[r.repo, r.scope].filter(Boolean).join(" · ").toUpperCase()}</Eyebrow>
      <div style={{ fontSize: 64, fontWeight: 800, color: C.ink, marginTop: 10, letterSpacing: -0.5 }}>{el?.name ?? s.elementId}</div>
      <div style={{ fontSize: 22, color: C.ink, opacity: 0.86, marginTop: 6, maxWidth: 900, lineHeight: 1.35 }}>{el?.description}</div>
      <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "180px 1fr", rowGap: 12, columnGap: 18, maxWidth: 900 }}>
        {rows.map((row, i) => {
          const k = ramp(rel - 0.9 - 0.25 * i, 0.4);
          return (
            <React.Fragment key={row.fact}>
              <div style={{ fontSize: 15, color: C.muted, textAlign: "right", opacity: k, letterSpacing: 0.4 }}>{row.label}</div>
              <div style={{ fontSize: 17, color: row.fact === "commit" ? C.accent : C.ink, fontFamily: MONO, opacity: k, transform: `translateX(${(1 - k) * 12}px)` }}>{row.value}</div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export const CreditsCard: React.FC<{ ctx: SceneCtx }> = ({ ctx }) => {
  const b = ctx.story.bundle;
  // The last scene's card holds through the outro.
  const { rel, opacity } = useCardTime(ctx, b.timeline.total - ctx.timed.start + 1);
  const cr = videoCreditsOf(b);
  const at = (i: number) => ramp(rel - 0.6 - 0.18 * i, 0.4);
  return (
    <div style={{ position: "absolute", left: CARD.x, top: CARD.y, width: CARD.w, opacity, fontFamily: SANS }}>
      <Eyebrow>{b.storyboard.title.toUpperCase()}</Eyebrow>
      <div style={{ fontSize: 14, color: C.accent, fontFamily: MONO, marginTop: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cr.line}</div>
      <div style={{ marginTop: 28 }}>
        {cr.authors.map((a, i) => (
          <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 18, opacity: at(i) }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: C.ink, minWidth: 260 }}>{a.name}</div>
            <div style={{ flex: 1, maxWidth: 420, height: 10, borderRadius: 5, background: C.panelHi, overflow: "hidden" }}>
              <div style={{ width: `${100 * a.share * at(i + 1)}%`, height: "100%", background: C.glow }} />
            </div>
            <div style={{ fontSize: 15, color: C.muted, fontFamily: MONO }}>{a.lines} / {cr.total} lines</div>
          </div>
        ))}
        {cr.coAuthors.length > 0 && (
          <div style={{ fontSize: 14.5, color: C.muted, marginTop: 10, opacity: at(cr.authors.length + 1) }}>
            Co-authored-by trailers on these commits: <span style={{ color: C.ink }}>{cr.coAuthors.join(", ")}</span>
          </div>
        )}
      </div>
      <div style={{ marginTop: 26, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
        {cr.commits.map((c, i) => (
          <div key={c.sha7} style={{ display: "flex", gap: 14, fontSize: 14, lineHeight: "26px", opacity: at(cr.authors.length + 2 + i), whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: MONO, color: C.accent, width: 70 }}>{c.sha7}</span>
            <span style={{ color: C.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{c.subject}</span>
            <span style={{ fontFamily: MONO, color: C.muted, width: 80, textAlign: "right" }}>{c.lines} {c.lines === 1 ? "line" : "lines"}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** The focus element's responsibilities, each arriving on its cue. */
export const Responsibilities: React.FC<{ ctx: SceneCtx }> = ({ ctx }) => {
  const { rel, opacity } = useCardTime(ctx, ctx.timed.duration);
  const s = ctx.scene;
  if (s.kind !== "focus-element" || !s.elementId) return null;
  const items = responsibilitiesOf(ctx.story.bundle, s.id);
  if (!items.length) return null;
  const el = element(ctx, s.elementId);
  return (
    <div style={{
      position: "absolute", left: FOCUS_LIST.x, top: FOCUS_LIST.y, width: FOCUS_LIST.w, opacity, fontFamily: SANS,
      background: "rgba(13, 17, 23, 0.94)", border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px 10px", boxSizing: "border-box",
    }}>
      <Eyebrow>{[el && (KIND[el.kind] ?? el.kind), el?.technology].filter(Boolean).join(" · ").toUpperCase()}</Eyebrow>
      <div style={{ fontSize: 30, fontWeight: 800, color: C.ink, margin: "6px 0 22px" }}>{el?.name}</div>
      {items.map((it) => {
        const k = ramp(rel - it.at + 0.15, 0.45);
        return (
          <div key={it.label} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", marginBottom: 10, borderRadius: 8,
            background: C.panel, border: `1px solid ${k > 0.5 ? C.glow : C.border}`, opacity: k, transform: `translateX(${(1 - k) * 18}px)`,
          }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, background: C.glow, flexShrink: 0 }} />
            <span style={{ fontSize: 20, color: C.ink }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
};
