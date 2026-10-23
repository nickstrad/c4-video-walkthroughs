/// <reference types="@motion-canvas/core/project" />

// The project build directory is chosen at build time (C4V_PROJECT, see
// vite.config.ts), so the renderer types its two inputs by contract, not by
// whichever project happens to sit at the default path.
declare module '@c4v-project/build/bundle.json' {
  const bundle: unknown;
  export default bundle;
}
declare module '@c4v-project/build/track.wav' {
  const url: string;
  export default url;
}
