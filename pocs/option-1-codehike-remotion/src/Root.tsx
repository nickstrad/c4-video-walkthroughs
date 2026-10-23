import React from "react";
import { Composition } from "remotion";
import type { HighlightedCode } from "codehike/code";
import highlighted from "../data/highlighted.json";
import { storyboard, sec } from "./storyboard";
import { Walkthrough } from "./Walkthrough";

const total = Math.max(...storyboard.scenes.map((s) => s.start + s.duration));

// Code Hike tokens and annotations are precomputed by scripts/highlight.mjs
// and passed in as props, as in Code Hike's Remotion examples.
export const Root: React.FC = () => (
  <Composition
    id="Walkthrough"
    component={Walkthrough}
    durationInFrames={sec(total)}
    fps={storyboard.fps}
    width={storyboard.width}
    height={storyboard.height}
    defaultProps={{ highlighted: highlighted as unknown as HighlightedCode }}
  />
);
