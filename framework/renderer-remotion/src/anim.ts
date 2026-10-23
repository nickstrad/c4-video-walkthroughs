// Tiny animation helpers: everything is a pure function of time in seconds.
import type { Box } from "../../core/src/index.ts";

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
/** 0 → 1 eased over `d` seconds starting at x = 0. */
export const ramp = (x: number, d: number) => (d <= 0 ? (x >= 0 ? 1 : 0) : easeInOut(clamp01(x / d)));
export const lerpBox = (a: Box, b: Box, k: number): Box => ({
  x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k),
});
/** Crossfade halves: the outgoing layer clears early, the incoming one arrives late (no muddy overlap). */
export const fadeOut = (k: number) => 1 - clamp01(k / 0.55);
export const fadeIn = (k: number) => clamp01((k - 0.35) / 0.65);
