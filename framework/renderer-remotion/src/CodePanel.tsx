// A pinned excerpt rendered with Code Hike's <Pre> and two annotation
// handlers (generalised from the option-1 POC): `focus` blocks paint the
// selected ranges, and every line gets its real file line number and is
// dimmed when outside the selection. Tokens were highlighted in Node by
// scripts/prepare.mjs; selection timing comes from play.ts's focusOf.
import React from "react";
import { InnerLine, Pre, type AnnotationHandler, type HighlightedCode } from "codehike/code";
import { citation, type Box, type CodeScene, type Excerpt, type Range } from "../../core/src/index.ts";
import { lerp, ramp } from "./anim.ts";
import { selectionAt, stepIndexAt, type Selection, type Story } from "./story.ts";
import { C, MONO, SANS } from "./theme.ts";

const HEADER = 56;
const PAD = 12;
const ADVANCE = 0.602; // DejaVu Sans Mono advance width, em

type Ctx = { sel: Selection; firstLine: number; lineH: number; gutter: number; blockKeys: Set<string> };
const SelCtx = React.createContext<Ctx | null>(null);

const parse = (q: string): Range => q.split("-").map(Number) as Range;
const lineWeight = (sel: Selection, n: number, skip?: Set<string>) =>
  Math.max(0, ...[...sel.cur, ...sel.prev].filter((r) => n >= r[0] && n <= r[1] && !skip?.has(`${r[0]}-${r[1]}`)).map((r) => sel.weight(r)));

const focus: AnnotationHandler = {
  name: "focus",
  Block: ({ annotation, children }) => {
    const c = React.useContext(SelCtx)!;
    const w = c.sel.weight(parse(annotation.query));
    return (
      <div style={{ background: `rgba(56, 139, 253, ${0.17 * w})`, boxShadow: `inset 4px 0 0 rgba(242, 163, 58, ${w})`, borderRadius: 4 }}>
        {children}
      </div>
    );
  },
};

const lines: AnnotationHandler = {
  name: "lines",
  Line: (props) => {
    const c = React.useContext(SelCtx)!;
    const n = props.lineNumber + c.firstLine - 1;
    const w = lineWeight(c.sel, n);
    // Ranges without a block annotation (overlapping ones) are painted per line.
    const loose = lineWeight(c.sel, n, c.blockKeys);
    return (
      <div style={{
        display: "flex", height: c.lineH, alignItems: "center", opacity: 1 - 0.66 * c.sel.any * (1 - w),
        background: loose > 0 ? `rgba(56, 139, 253, ${0.17 * loose})` : undefined,
      }}>
        <span style={{ width: c.gutter, textAlign: "right", paddingRight: 16, boxSizing: "border-box", color: w > 0.5 ? C.muted : C.faint, flexShrink: 0 }}>
          {n}
        </span>
        <InnerLine merge={props} />
      </div>
    );
  },
};

export type CodePanelProps = {
  story: Story;
  /** Scene index whose run, selection and steps are shown. */
  i: number;
  highlighted: HighlightedCode;
  box: Box;
  rail?: Box;
  railK: number;
  opacity: number;
  t: number;
};

export const CodePanel: React.FC<CodePanelProps> = ({ story, i, highlighted, box, rail, railK, opacity, t }) => {
  if (opacity <= 0.001) return null;
  const scene = story.scenes[i] as CodeScene;
  const ex: Excerpt = story.bundle.excerpts[scene.excerpt];
  const sel = selectionAt(story, i, t);

  const nLines = ex.lines[1] - ex.lines[0] + 1;
  const cols = Math.max(...ex.text.split("\n").map((l) => l.replace(/\t/g, "    ").length));
  const digits = String(ex.lines[1]).length;
  // Fit the longest line: gutter (digits + padding) + code columns.
  const font = Math.min(15, (box.w - 2 * PAD - 24) / ((cols + digits + 3) * ADVANCE));
  const lineH = Math.round(font * 1.45);
  const gutter = (digits + 2.7) * ADVANCE * font;
  const areaH = box.h - HEADER;
  const maxScroll = Math.max(0, nLines * lineH + 2 * PAD - areaH);
  // Scroll so the selection sits mid-pane. A selection taller than the pane
  // (far-apart ranges) is split into groups that fit, visited in order over
  // the time the selection holds.
  const px = (r: Range) => [(r[0] - ex.lines[0]) * lineH, (r[1] - ex.lines[0] + 1) * lineH];
  const target = (rs: Range[]) => {
    if (!rs.length) return 0;
    const top = Math.min(...rs.map((r) => px(r)[0])), bottom = Math.max(...rs.map((r) => px(r)[1]));
    const centred = (top + bottom) / 2 + PAD - areaH / 2;
    return Math.max(0, Math.min(maxScroll, bottom - top > areaH ? top - lineH / 2 : centred));
  };
  const groups = (rs: Range[]) => {
    const out: Range[][] = [];
    for (const r of [...rs].sort((a, b) => a[0] - b[0])) {
      const g = out.at(-1);
      if (g && px(r)[1] - px(g[0])[0] <= areaH) g.push(r);
      else out.push([r]);
    }
    return out;
  };
  const prevGroups = groups(sel.prev), curGroups = groups(sel.cur);
  let scroll = target(prevGroups.at(-1) ?? []);
  curGroups.forEach((g, j) => {
    const at = j === 0 ? 0 : (j * sel.span) / curGroups.length;
    scroll = lerp(scroll, target(g), ramp(sel.since - at, 0.7));
  });
  if (!curGroups.length) scroll = lerp(scroll, 0, ramp(sel.since, 0.7));

  const blockKeys = new Set(highlighted.annotations.filter((a) => a.name === "focus").map((a) => a.query));
  const spec = story.bundle.storyboard.excerpts.find((x) => x.id === ex.id);
  const elementId = spec?.elementId;
  const elementName = elementId
    ? Object.values(story.bundle.views).flatMap((v) => [...v.view.nodes, ...(v.view.scope ? [v.view.scope] : [])]).find((n) => n.id === elementId)?.name
    : undefined;

  const ts = story.timed[i];
  const step = stepIndexAt(ts, t - ts.start);

  return (
    <>
      <div style={{
        position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity, overflow: "hidden",
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, boxSizing: "border-box",
      }}>
        <div style={{ position: "absolute", left: 18, top: 10, right: 18, display: "flex", alignItems: "baseline", gap: 12, whiteSpace: "nowrap" }}>
          {elementName && <span style={{ color: C.glow, fontFamily: SANS, fontSize: 15, fontWeight: 700 }}>{elementName}</span>}
          {elementName && <span style={{ color: C.muted, fontFamily: SANS, fontSize: 15 }}>→</span>}
          <span style={{ color: C.ink, fontFamily: MONO, fontSize: 16, fontWeight: 700 }}>{ex.symbol}</span>
        </div>
        <div style={{ position: "absolute", left: 18, top: 33, right: 18, color: C.accent, fontFamily: MONO, fontSize: 12.5, whiteSpace: "nowrap" }}>
          {citation(ex, { symbol: false })}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: HEADER, bottom: 0, overflow: "hidden", borderTop: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ transform: `translateY(${-scroll}px)` }}>
            <SelCtx.Provider value={{ sel, firstLine: ex.lines[0], lineH, gutter, blockKeys }}>
              <Pre
                code={highlighted}
                handlers={[focus, lines]}
                style={{
                  margin: 0, padding: `${PAD}px ${PAD}px`, fontFamily: MONO, fontSize: font, lineHeight: `${lineH}px`,
                  background: "transparent", color: highlighted.style.color as string, tabSize: 4, whiteSpace: "pre",
                }}
              />
            </SelCtx.Provider>
          </div>
        </div>
      </div>

      {rail && scene.steps && railK > 0.001 && (
        <div style={{ position: "absolute", left: rail.x, top: rail.y, width: rail.w, opacity: opacity * railK, fontFamily: SANS }}>
          <div style={{ color: C.muted, fontSize: 12, letterSpacing: 1.2, fontWeight: 700, margin: "8px 0 14px" }}>
            {(scene.railTitle ?? "Steps").toUpperCase()}
          </div>
          {scene.steps.map((s, j) => {
            const on = j === step, done = step > j;
            return (
              <div key={s.id} style={{
                display: "flex", gap: 12, alignItems: "center", padding: "11px 12px", marginBottom: 9, borderRadius: 7,
                background: on ? "rgba(56,139,253,0.18)" : "transparent", border: `1px solid ${on ? C.glow : C.border}`,
                color: on ? C.ink : done ? C.muted : C.faint,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 12.5, width: 78, flexShrink: 0 }}>L{s.lines[0]}–{s.lines[1]}</span>
                <span style={{ fontSize: 15, fontWeight: on ? 700 : 400 }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
