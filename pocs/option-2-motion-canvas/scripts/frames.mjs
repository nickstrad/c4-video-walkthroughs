// Pull still frames from the rendered MP4 at key narrated-scene moments, using the
// static ffmpeg that @motion-canvas/ffmpeg already installs (no system ffmpeg).
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const timeline = JSON.parse(readFileSync(new URL('../narration/timeline.json', import.meta.url)));
const video = new URL('../output/project.mp4', import.meta.url).pathname;
const keys = {'s3-cache-hit': '01-cache-hit', 's7-epoch': '02-epoch-check', 's10-caps': '03-row-caps'};

for (const s of timeline.scenes) {
  if (keys[s.id]) {
    // Just before the cut, after every narration cue in the scene has fired.
    const at = (s.start + s.duration - 0.25).toFixed(2);
    const out = new URL(`../frames/${keys[s.id]}.png`, import.meta.url).pathname;
    execFileSync(ffmpegInstaller.path, ['-v', 'error', '-y', '-ss', at, '-i', video, '-frames:v', '1', out]);
    console.log(`${out} @ ${at}s`);
  }
}
