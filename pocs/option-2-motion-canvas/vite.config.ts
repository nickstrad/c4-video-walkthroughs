import {defineConfig} from 'vite';
import motionCanvasPlugin from '@motion-canvas/vite-plugin';
import ffmpegPlugin from '@motion-canvas/ffmpeg';

// Both plugins ship as CommonJS; under "type": "module" the default import is
// the module object, so unwrap `.default` when present.
const unwrap = <T>(m: T): T => ((m as {default?: T}).default ?? m);
const motionCanvas = unwrap(motionCanvasPlugin);
const ffmpeg = unwrap(ffmpegPlugin);

export default defineConfig({
  plugins: [motionCanvas(), ffmpeg()],
  server: {port: 9017, strictPort: true},
});
