// Look and screen layout. Colours are the option-2 POC's dark palette (GitHub
// dark), plus option 1's focus glow. Screen boxes are in pixels, top-left
// origin, for the bundle's output size (1280×720 in litefleet).
import type {Box} from '../../core/src/index.ts';

export const C = {
  bg: '#0d1117',
  panel: '#161b22',
  codeBg: '#0f141b',
  external: '#11161d',
  boundary: 'rgba(88,166,255,0.035)',
  border: '#30363d',
  line: '#4a5563',
  text: '#e6edf3',
  muted: '#8b949e',
  faint: '#6e7681',
  accent: '#58a6ff',
  focusFill: '#173554',
  band: 'rgba(56,139,253,0.16)',
  glow: '#f2a33a',
  packet: '#f0b429',
  ok: '#3fb950',
  warn: '#f85149',
  caption: '#010409',
};
export const TONE: Record<string, string> = {ok: C.ok, warn: C.warn, accent: C.accent};
export const MONO = 'DejaVu Sans Mono';
export const SANS = 'DejaVu Sans';
/** DejaVu Sans Mono advance width per pixel of font size. */
export const MONO_ADVANCE = 0.602;

export type Screen = {width: number; height: number};

/** Where every panel sits. All boxes are screen pixels, top-left origin. */
export function screenLayout({width: W, height: H}: Screen) {
  const captionH = 72;
  const bottom = H - captionH; // content stays above the caption band
  const statePanel: Box = {x: W - 500, y: 12, w: 488, h: 164};
  return {
    caption: {x: 0, y: bottom, w: W, h: captionH} as Box,
    /** One-line view header over a full-screen diagram. */
    header: {x: 20, y: 18},
    /** Big title card (architecture-overview). */
    titleCard: {x: 40, y: 22},
    /** Everything above the caption band (a focus zoom). */
    full: {x: 0, y: 0, w: W, h: bottom} as Box,
    /** Full-screen diagram under the one-line header. */
    diagram: {x: 0, y: 48, w: W, h: bottom - 48 - 4} as Box,
    /** Diagram under the title card. */
    diagramUnderTitle: {x: 0, y: 112, w: W, h: bottom - 112 - 4} as Box,
    /** Diagram under the state panel (a request scene once state is in play). */
    diagramUnderState: {x: 0, y: statePanel.y + statePanel.h + 4, w: W, h: bottom - statePanel.y - statePanel.h - 8} as Box,
    /** Context strip: the diagram above the code, beside the state panel. */
    strip: {x: 12, y: 8, w: statePanel.x - 24, h: statePanel.y + statePanel.h - 4} as Box,
    statePanel,
    /** Code under the strip and the state panel. */
    codeWide: {x: 14, y: statePanel.y + statePanel.h + 8, w: W - 28, h: bottom - 6 - (statePanel.y + statePanel.h + 8)} as Box,
    /** Code without context: tall left column; the step rail takes the right. */
    codeTall: {x: 14, y: 14, w: 880, h: bottom - 6 - 14} as Box,
    rail: {x: 910, y: 14, w: W - 910 - 14, h: bottom - 6 - 14} as Box,
  };
}
export type ScreenLayout = ReturnType<typeof screenLayout>;
