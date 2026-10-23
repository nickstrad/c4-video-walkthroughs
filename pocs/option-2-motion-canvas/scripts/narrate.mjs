// Narration stage: voice each storyboard scene once with ElevenLabs, then derive
// the timeline (scene durations, cue times) from the returned character
// alignment and assemble one narration track for the Motion Canvas project.
//
// Voicing is skipped for any scene whose narration/<id>.mp3 and
// <id>.alignment.json already exist, so with the committed files this script is
// fully offline and deterministic. The API key is read from the secrets env
// file at runtime and never written anywhere.
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = path.join(root, 'narration');
const board = JSON.parse(readFileSync(path.join(root, 'storyboard/query-flow.storyboard.json'), 'utf8'));
const meta = JSON.parse(readFileSync(path.join(root, 'src/project.meta'), 'utf8'));
const fps = meta.rendering.fps;
const RATE = 44100;
const {leadIn, tail, model} = board.narration;
const ENDING = 0.4; // the scene's final waitFor after the last beat
mkdirSync(dir, {recursive: true});

function secrets() {
  const file = process.env.C4V_SECRETS ?? '/root/Software/.secrets/c4-video.env';
  const env = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  if (!env.ELEVENLABS_API_KEY) throw new Error(`ELEVENLABS_API_KEY missing in ${file}`);
  return env;
}

let usedChars = 0;
async function voice(scene, i) {
  const mp3 = path.join(dir, `${scene.id}.mp3`);
  const align = path.join(dir, `${scene.id}.alignment.json`);
  if (existsSync(mp3) && existsSync(align)) return JSON.parse(readFileSync(align, 'utf8'));
  const env = secrets();
  const voiceId = env.ELEVENLABS_VOICE_ID || board.narration.voice.id;
  const text = scene.narration.text;
  // Neighbouring lines keep prosody continuous across separately voiced scenes.
  const body = {
    text,
    model_id: model,
    previous_text: board.scenes[i - 1]?.narration.text,
    next_text: board.scenes[i + 1]?.narration.text,
  };
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {method: 'POST', headers: {'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json'}, body: JSON.stringify(body)},
  );
  if (!res.ok) throw new Error(`${scene.id}: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  writeFileSync(mp3, Buffer.from(json.audio_base64, 'base64'));
  const record = {
    sceneId: scene.id,
    text,
    voiceId,
    model,
    outputFormat: 'mp3_44100_128',
    characters: text.length,
    alignment: json.alignment,
    normalized_alignment: json.normalized_alignment,
  };
  writeFileSync(align, JSON.stringify(record, null, 2) + '\n');
  usedChars += text.length;
  console.log(`voiced ${scene.id} (${text.length} chars)`);
  return record;
}

function pcm(file) {
  const buf = execFileSync(ffmpegInstaller.path, ['-v', 'error', '-i', file, '-f', 's16le', '-ac', '1', '-ar', String(RATE), '-'], {
    maxBuffer: 64 << 20,
  });
  return new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
}

const frame = (t) => Math.ceil(t * fps - 1e-6) / fps;
const timeline = {fps, leadIn, tail, voice: board.narration.voice, model, scenes: []};
const clips = [];
let t = 0;
for (const [i, scene] of board.scenes.entries()) {
  const rec = await voice(scene, i);
  const a = rec.alignment;
  const text = a.characters.join('');
  if (text !== scene.narration.text) throw new Error(`${scene.id}: alignment text differs from storyboard narration`);
  // Sync on the last spoken character: the closing punctuation's span is
  // trailing silence (up to ~1 s), which would otherwise pad every gap.
  let last = text.length - 1;
  while (!/[\p{L}\p{N}]/u.test(text[last])) last--;
  const speechEnd = a.character_end_times_seconds[last];
  const samples = pcm(path.join(dir, `${scene.id}.mp3`));
  const duration = frame(Math.max(scene.duration, leadIn + speechEnd + tail));
  // The clip is cut where its scene ends. Guard against cutting a line off:
  // no 10 ms window past the cut may exceed -40 dBFS, except the clip's last
  // 50 ms, where the decoded MP3s carry an end-of-stream click.
  const cut = Math.round((duration - leadIn) * RATE);
  const W = RATE / 100;
  for (let k = cut; k + W <= samples.length - RATE / 20; k += W) {
    let e = 0;
    for (let j = k; j < k + W; j++) e += samples[j] * samples[j];
    const db = 10 * Math.log10(e / W / 32767 ** 2 + 1e-12);
    if (db > -40) throw new Error(`${scene.id}: audio at ${(k / RATE).toFixed(2)}s (${db.toFixed(0)} dBFS) would be cut off`);
  }
  // Keep up to the cut, with a 20 ms fade so the edit never clicks.
  const kept = samples.slice(0, Math.min(cut, samples.length));
  const fade = Math.min(kept.length, RATE / 50);
  for (let j = 0; j < fade; j++) kept[kept.length - 1 - j] = Math.round((kept[kept.length - 1 - j] * j) / fade);
  const cues = {};
  for (const [name, phrase] of Object.entries(scene.narration.cues ?? {})) {
    const at = text.indexOf(phrase);
    if (at < 0) throw new Error(`${scene.id}: cue "${name}" anchor "${phrase}" not in narration`);
    cues[name] = +(leadIn + a.character_start_times_seconds[at]).toFixed(3);
  }
  timeline.scenes.push({
    id: scene.id,
    start: +t.toFixed(4),
    duration: +duration.toFixed(4),
    storyboardDuration: scene.duration,
    speech: [+leadIn.toFixed(3), +(leadIn + speechEnd).toFixed(3)],
    clipLength: +(samples.length / RATE).toFixed(3),
    cues,
  });
  clips.push({at: t + leadIn, samples: kept});
  t += duration;
}
timeline.total = +(t + ENDING).toFixed(4);
writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify(timeline, null, 2) + '\n');

// One mono track spanning the whole video. The exporter muxes with -shortest,
// so the track runs a second past the last frame to never clip the picture.
const track = new Int16Array(Math.ceil((timeline.total + 1) * RATE));
for (const c of clips) track.set(c.samples, Math.round(c.at * RATE));
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + track.byteLength, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(track.byteLength, 40);
writeFileSync(path.join(dir, 'track.wav'), Buffer.concat([header, Buffer.from(track.buffer)]));

const chars = board.scenes.reduce((n, s) => n + s.narration.text.length, 0);
console.log(`${board.scenes.length} lines, ${chars} chars total (${usedChars} voiced this run)`);
console.log(`video ${timeline.total}s; track.wav ${(track.length / RATE).toFixed(2)}s`);
for (const s of timeline.scenes) console.log(`  ${s.id.padEnd(14)} ${s.start.toFixed(2).padStart(6)} +${s.duration.toFixed(2)}  speech ${s.speech[1].toFixed(2)}  ${JSON.stringify(s.cues)}`);
