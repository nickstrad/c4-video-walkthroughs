import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { AnnotationHandler, HighlightedCode, InnerLine, Pre } from "codehike/code";
import code from "../data/code.json";
import { Step, storyboard, sec } from "./storyboard";
import { C, MONO, SANS } from "./theme";

const LINE_H = 24;
const PANE_H = 500;
const FADE = 10; // frames for focus to move between steps

/** Frame-relative timeline for the steps: [startFrame, endFrame) per step. */
const useSteps = (steps: Step[], introFrames: number) => {
  let t = introFrames;
  return steps.map((s) => {
    const r = { ...s, from: t, to: t + sec(s.duration) };
    t = r.to;
    return r;
  });
};

const StepCtx = React.createContext<{ weight: (id: string) => number; any: number; stepOf: (line: number) => string | undefined }>({
  weight: () => 0, any: 0, stepOf: () => undefined,
});

// Code Hike block annotations, one per storyboard step (added in
// calculateMetadata). The handler lights the block while its step is current.
const focus: AnnotationHandler = {
  name: "focus",
  Block: ({ annotation, children }) => {
    const { weight } = React.useContext(StepCtx);
    const w = weight(annotation.query);
    return (
      <div
        style={{
          background: `rgba(56, 139, 253, ${0.16 * w})`,
          boxShadow: `inset 4px 0 0 rgba(242, 163, 58, ${w})`,
          borderRadius: 4,
        }}
      >
        {children}
      </div>
    );
  },
};

// Every line: real file line numbers, and dimming of lines outside the step.
const lines: AnnotationHandler = {
  name: "lines",
  Line: (props) => {
    const { any, weight, stepOf } = React.useContext(StepCtx);
    const fileLine = props.lineNumber + code.firstLine - 1;
    const step = stepOf(fileLine);
    const opacity = 1 - 0.6 * any * (1 - (step ? weight(step) : 0));
    return (
      <div style={{ display: "flex", height: LINE_H, alignItems: "center", opacity }}>
        <span style={{ width: 48, textAlign: "right", paddingRight: 18, color: "#6e7681", flexShrink: 0 }}>
          {fileLine}
        </span>
        <InnerLine merge={props} />
      </div>
    );
  },
};

export const CodeScene: React.FC<{ highlighted: HighlightedCode; steps: Step[]; introFrames: number; title: string }> = ({
  highlighted, steps, introFrames, title,
}) => {
  const frame = useCurrentFrame();
  const timeline = useSteps(steps, introFrames);
  const weight = (id: string) => {
    const s = timeline.find((x) => x.id === id)!;
    const fadeIn = interpolate(frame, [s.from, s.from + FADE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const fadeOut = s === timeline.at(-1) ? 1 : interpolate(frame, [s.to, s.to + FADE], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return Math.min(fadeIn, fadeOut);
  };
  const stepOf = (n: number) => steps.find((s) => n >= s.lines[0] && n <= s.lines[1])?.id;
  const any = interpolate(frame, [introFrames, introFrames + FADE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Scroll so the current step's range sits in the middle of the pane; ease
  // between consecutive steps' targets.
  const total = code.code.split("\n").length;
  const target = (s?: Step) => {
    if (!s) return 0;
    const mid = ((s.lines[0] + s.lines[1]) / 2 - code.firstLine + 0.5) * LINE_H;
    return Math.max(0, Math.min(total * LINE_H + 16 - PANE_H, mid - PANE_H / 2));
  };
  let scroll = 0;
  for (const s of timeline) {
    scroll = interpolate(frame, [s.from, s.from + 18], [scroll, target(s)], {
      easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
  }
  const current = [...timeline].reverse().find((s) => frame >= s.from);
  const enter = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: C.codeBg, fontFamily: SANS, opacity: enter }}>
      {/* header: element → function, with the pinned source */}
      <div style={{ position: "absolute", left: 40, top: 22, right: 40, display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ color: C.glow, fontSize: 15, fontWeight: 700 }}>{storyboard.focus.elementName}</span>
        <span style={{ color: "#8b949e", fontSize: 15 }}>→</span>
        <span style={{ color: "#e6edf3", fontSize: 19, fontWeight: 700, fontFamily: MONO }}>{title}</span>
      </div>
      <div style={{ position: "absolute", left: 40, top: 52, color: "#8b949e", fontSize: 13, fontFamily: MONO }}>
        {code.provenance.path.replace("books/release-it/project/", "")}:{code.provenance.lines[0]}–{code.provenance.lines[1]} @ {code.provenance.tag} · {code.provenance.commit.slice(0, 7)}
      </div>

      {/* code pane */}
      <div style={{ position: "absolute", left: 30, top: 84, width: 860, height: PANE_H, overflow: "hidden", border: "1px solid #30363d", borderRadius: 8 }}>
        <div style={{ transform: `translateY(${8 - scroll}px) scale(${0.96 + 0.04 * enter})`, transformOrigin: "50% 0" }}>
          <StepCtx.Provider value={{ weight, any, stepOf }}>
            <Pre
              code={highlighted}
              handlers={[focus, lines]}
              style={{ margin: 0, padding: "0 12px", fontFamily: MONO, fontSize: 15, lineHeight: `${LINE_H}px`, background: "transparent", color: highlighted.style.color, tabSize: 4 }}
            />
          </StepCtx.Provider>
        </div>
      </div>

      {/* step rail: the storyboard's beats, current one lit */}
      <div style={{ position: "absolute", left: 914, top: 84, width: 330 }}>
        <div style={{ color: "#8b949e", fontSize: 12, letterSpacing: 1, fontWeight: 700, marginBottom: 12 }}>WHAT ACQUIRE CHECKS</div>
        {timeline.map((s, i) => {
          const on = current?.id === s.id;
          const done = current && timeline.indexOf(current) > i;
          return (
            <div key={s.id} style={{
              display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", marginBottom: 8, borderRadius: 6,
              background: on ? "rgba(56,139,253,0.18)" : "transparent", border: `1px solid ${on ? C.glow : "#30363d"}`,
              color: on ? "#e6edf3" : done ? "#8b949e" : "#6e7681",
            }}>
              <span style={{ fontFamily: MONO, fontSize: 13, width: 70 }}>L{s.lines[0]}–{s.lines[1]}</span>
              <span style={{ fontSize: 15, fontWeight: on ? 700 : 400 }}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
