// Pull stills from a rendered MP4 at times taken from the bundle's timeline,
// with the static ffmpeg that @motion-canvas/ffmpeg already installs.
//
//   node scripts/stills.mjs [projectDir] [video] [what=scene[:step] ...]
//     default stills (litefleet): cache-hit, focus-zoom, acquire-step, row-caps
//     each is taken 0.25 s before its scene (or step) ends, after every cue fired
//   node scripts/stills.mjs [projectDir] [video] --review <dir>
//     two stills per scene (mid and end) into <dir>, for looking over a render
//
// Output: <projectDir>/renders/frames/motion-canvas-0N-<what>.png
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const project = path.resolve(args[0] && !args[0].startsWith('--') ? args.shift() : path.join(root, '../projects/litefleet'));
const video = path.resolve(args[0] && !args[0].startsWith('--') && !args[0].includes('=') ? args.shift() : path.join(project, 'renders/motion-canvas.mp4'));
const {timeline} = JSON.parse(readFileSync(path.join(project, 'build/bundle.json'), 'utf8'));
const scene = (id) => timeline.scenes.find((s) => s.id === id) ?? fail(`no scene ${id}`);
function fail(m) {
  console.error(m);
  process.exit(1);
}
const grab = (at, out) => {
  execFileSync(ffmpeg.path, ['-v', 'error', '-y', '-ss', at.toFixed(3), '-i', video, '-frames:v', '1', out]);
  console.log(`${out} @ ${at.toFixed(3)} s`);
};

if (args[0] === '--review') {
  const dir = path.resolve(args[1] ?? '/tmp/c4v-review');
  mkdirSync(dir, {recursive: true});
  timeline.scenes.forEach((s, i) => {
    const n = String(i + 1).padStart(2, '0');
    grab(s.start + s.duration / 2, path.join(dir, `${n}-${s.id}-mid.png`));
    grab(s.start + s.duration - 0.25, path.join(dir, `${n}-${s.id}-end.png`));
    for (const st of s.steps ?? []) grab(s.start + st.end - 0.25, path.join(dir, `${n}-${s.id}-${st.id}.png`));
  });
  process.exit(0);
}

const picks = args.length
  ? args
  : ['cache-hit=s3-cache-hit', 'focus-zoom=n-focus', 'acquire-step=n-acquire:wait', 'row-caps=s10-caps'];
const dir = path.join(project, 'renders/frames');
mkdirSync(dir, {recursive: true});
picks.forEach((p, i) => {
  const [what, ref] = p.split('=');
  const [id, stepId] = ref.split(':');
  const s = scene(id);
  const end = stepId ? (s.steps?.find((x) => x.id === stepId) ?? fail(`no step ${ref}`)).end : s.duration;
  grab(s.start + end - 0.25, path.join(dir, `motion-canvas-${String(i + 1).padStart(2, '0')}-${what}.png`));
});
