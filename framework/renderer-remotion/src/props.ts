// Render props: the bundle exactly as core wrote it, plus Code Hike tokens
// that scripts/prepare.mjs computed in Node (the browser build of Code Hike
// would fetch its theme from lighter.codehike.org at render time).
import type { HighlightedCode } from "codehike/code";
import type { RenderBundle } from "../../core/src/index.ts";

export type RenderProps = {
  bundle: RenderBundle;
  /** Highlighted excerpt text, keyed by excerpt id. */
  code: Record<string, HighlightedCode>;
};
