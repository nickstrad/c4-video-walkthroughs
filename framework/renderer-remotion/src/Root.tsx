// One composition whose size, fps and length come from the bundle's timeline
// (calculateMetadata), so nothing project-specific is compiled in. Props are
// written by scripts/prepare.mjs and handed to the CLI with --props.
import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { BUNDLE_SCHEMA } from "../../core/src/index.ts";
import type { RenderProps } from "./props.ts";
import { Walkthrough } from "./Walkthrough.tsx";

const calculateMetadata: CalculateMetadataFunction<RenderProps> = ({ props }) => {
  const b = props.bundle;
  if (!b) throw new Error("no render bundle in props: run `node scripts/prepare.mjs <projectDir>` and pass --props=out/props.json");
  if (b.schema !== BUNDLE_SCHEMA) throw new Error(`bundle schema ${b.schema}, expected ${BUNDLE_SCHEMA}`);
  const tl = b.timeline;
  return { durationInFrames: tl.totalFrames, fps: tl.fps, width: tl.width, height: tl.height };
};

export const Root: React.FC = () => (
  <Composition
    id="Walkthrough"
    component={Walkthrough}
    defaultProps={{} as RenderProps}
    calculateMetadata={calculateMetadata}
  />
);
