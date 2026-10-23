// One mono narration track for the whole video, from option 2's narrate.mjs:
// each take is placed at its scene start + its offset in the scene, and cut
// with a 20 ms fade where the next take of the scene starts or the scene ends. A guard fails the build if the cut would drop
// speech: no 10 ms window past the cut may exceed -40 dBFS, except the clip's
// last 50 ms, where decoded MP3s carry an end-of-stream click.
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Timeline } from "./types.ts";

export const ffmpegPath: string = ffmpegInstaller.path;

export function decodeMono(file: string, rate: number): Int16Array {
  const buf = execFileSync(ffmpegPath, ["-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", String(rate), "-"], { maxBuffer: 64 << 20 });
  return new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
}

export function wav(samples: Int16Array, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + samples.byteLength, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(samples.byteLength, 40);
  return Buffer.concat([h, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)]);
}

/**
 * Mix the takes into one track. `pad` seconds of silence follow the last
 * frame: Motion Canvas's exporter muxes with -shortest, so the track must
 * never be the shorter stream.
 */
export function mixTrack(tl: Timeline, takesDir: string, pad = 1): Buffer {
  const RATE = tl.audio.sampleRate;
  const W = RATE / 100;
  const track = new Int16Array(Math.ceil((tl.total + pad) * RATE));
  for (const s of tl.scenes) s.takes.forEach((t, i) => {
    const samples = decodeMono(path.join(takesDir, `${t.take}.mp3`), RATE);
    const cut = Math.round(((s.takes[i + 1]?.at ?? s.duration) - t.at) * RATE);
    for (let k = cut; k + W <= samples.length - RATE / 20; k += W) {
      let e = 0;
      for (let j = k; j < k + W; j++) e += samples[j] * samples[j];
      const db = 10 * Math.log10(e / W / 32767 ** 2 + 1e-12);
      if (db > -40) throw new Error(`${t.take}: audio at ${(k / RATE).toFixed(2)}s (${db.toFixed(0)} dBFS) would be cut off`);
    }
    const kept = samples.slice(0, Math.min(cut, samples.length));
    const fade = Math.min(kept.length, RATE / 50);
    for (let j = 0; j < fade; j++) kept[kept.length - 1 - j] = Math.round((kept[kept.length - 1 - j] * j) / fade);
    track.set(kept, Math.round((s.start + t.at) * RATE));
  });
  return wav(track, RATE);
}
