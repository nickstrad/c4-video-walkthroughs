// Screen regions on the 1280×720 design canvas (the stage is scaled to the
// composition size). Scene kinds place their diagram, code and state panel
// into these; layers blend between consecutive scenes' placements.
import type { Box } from "../../core/src/index.ts";

export const FRAME: Box = { x: 0, y: 0, w: 1280, h: 720 };
/** Where a full-screen diagram is fitted: under the view header, above the captions. */
export const FULL: Box = { x: 24, y: 92, w: 1232, h: 516 };
/** The state panel, top right. */
export const PANEL: Box = { x: 836, y: 14, w: 424, h: 176 };
/** A full-screen diagram that shares the screen with the state panel. */
export const FULL_UNDER_PANEL: Box = { x: 24, y: 200, w: 1232, h: 408 };
/** The reduced "context" placement for a diagram kept on screen over code. */
export const STRIP: Box = { x: 16, y: 12, w: 804, h: 182 };
/** Code pane under a context strip. */
export const CODE_UNDER_STRIP: Box = { x: 16, y: 206, w: 1248, h: 402 };
/** Code pane on its own. */
export const CODE_ALONE: Box = { x: 24, y: 20, w: 1232, h: 588 };
/** Width the step rail takes from the right of a code pane. */
export const RAIL_W = 344;
export const GAP = 20;

/** Split a code area into pane + rail when the scene has steps. */
export function withRail(area: Box, rail: boolean): { code: Box; rail?: Box } {
  if (!rail) return { code: area };
  return {
    code: { ...area, w: area.w - RAIL_W - GAP },
    rail: { x: area.x + area.w - RAIL_W, y: area.y, w: RAIL_W, h: area.h },
  };
}
/**
 * The act tracker (story-arc chrome): a strip under the content regions
 * (which end at y 608) and above a one-line caption (top ≈ y 647).
 */
export const LOWER_THIRD: Box = { x: 32, y: 614, w: 1216, h: 26 };
/** A focus-element scene with a responsibilities list: diagram left, list right. */
export const FOCUS_LEFT: Box = { x: 24, y: 92, w: 760, h: 516 };
export const FOCUS_LIST: Box = { x: 812, y: 150, w: 440, h: 420 };
/** A full-screen card (repo-card, credits). */
export const CARD: Box = { x: 140, y: 64, w: 1000, h: 530 };
