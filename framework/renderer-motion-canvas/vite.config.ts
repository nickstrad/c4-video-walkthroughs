import {defineConfig, type Plugin} from 'vite';
import motionCanvasPlugin from '@motion-canvas/vite-plugin';
import ffmpegPlugin from '@motion-canvas/ffmpeg';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The project is data, not code: everything the scene plays comes from one
// project build directory, chosen with C4V_PROJECT (default: litefleet) and
// imported through the `@c4v-project` alias (build/bundle.json, build/track.wav).
const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, process.env.C4V_PROJECT ?? '../projects/litefleet');

// Both plugins ship as CommonJS; under "type": "module" the default import is
// the module object, so unwrap `.default` when present.
const unwrap = <T>(m: T): T => ((m as {default?: T}).default ?? m);
const motionCanvas = unwrap(motionCanvasPlugin);
const ffmpeg = unwrap(ffmpegPlugin);

/**
 * The FFmpeg exporter turns the project's audio URL into a file path with
 * `url.slice(1)`, relative to the server's cwd. That only works for audio
 * inside the Vite root; the track lives in the project dir, which Vite serves
 * as `/@fs/<absolute path>`. Rewrite the exporter's `start` payload to the
 * absolute file path (prefixed with "/" so its slice(1) yields the path).
 */
function exporterAudioPath(): Plugin {
  return {
    name: 'c4v:exporter-audio-path',
    enforce: 'pre',
    configureServer(server) {
      const on = server.ws.on.bind(server.ws) as (event: string, fn: (...a: any[]) => void) => void;
      (server.ws as {on: unknown}).on = (event: string, fn: (payload: any, client: unknown) => void) => {
        if (event !== 'motion-canvas/ffmpeg') return on(event, fn);
        return on(event, (payload: any, client: unknown) => {
          const audio = payload?.method === 'start' ? payload.data?.audio : undefined;
          if (typeof audio === 'string') {
            const url = audio.split('?')[0];
            const file = url.startsWith('/@fs/') ? url.slice('/@fs'.length) : path.join(server.config.root, url);
            payload.data.audio = '/' + file;
          }
          fn(payload, client);
        });
      };
    },
  };
}

export default defineConfig({
  resolve: {alias: {'@c4v-project': project}},
  plugins: [exporterAudioPath(), motionCanvas({output: process.env.C4V_OUTPUT ?? path.join(here, 'output')}), ffmpeg()],
  server: {fs: {allow: [path.resolve(here, '..'), project]}},
});
