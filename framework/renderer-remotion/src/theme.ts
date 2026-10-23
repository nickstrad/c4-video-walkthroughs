// One dark palette for diagram, context strip and code (Code Hike github-dark),
// so a diagram can stay on screen above the code without a light/dark cut.
export const SANS = "'DejaVu Sans', 'Liberation Sans', sans-serif";
export const MONO = "'DejaVu Sans Mono', 'Liberation Mono', monospace";
export const C = {
  bg: "#0d1117",
  panel: "#161b22",
  panelHi: "#1c2330",
  border: "#30363d",
  line: "#56606d",
  ink: "#e6edf3",
  muted: "#8b949e",
  faint: "#6e7681",
  accent: "#58a6ff",
  accentFill: "#1f3a5f",
  focus: "#1f6feb",
  glow: "#f2a33a",
  packet: "#f0b429",
  external: "#1b1f24",
  boundary: "rgba(88, 166, 255, 0.045)",
  ok: "#3fb950",
  warn: "#f85149",
};
export const TONE: Record<string, string> = { ok: C.ok, warn: C.warn, accent: C.accent };

/** The design canvas; the stage is scaled to the composition size. */
export const DESIGN = { w: 1280, h: 720 };

/** Blend two #rrggbb colours (k = 0 → a, 1 → b). */
export function mix(a: string, b: string, k: number) {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  const kk = Math.max(0, Math.min(1, k));
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * kk).toString(16).padStart(2, "0")).join("");
}

/** Human C4 kind names for box eyebrows. */
export const KIND: Record<string, string> = {
  person: "Person", softwareSystem: "Software system", container: "Container", component: "Component",
};
