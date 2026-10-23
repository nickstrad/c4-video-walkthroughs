// Output proof: is this MP4 the video the timeline describes? Renderer-
// agnostic; it reads only the timeline and the file. Lifted from the option-3
// POC's verify.mjs (audit-34 item 3.4), minus its footage asserts:
//
// - streams: H.264 video at the timeline's size and fps with exactly
//   totalFrames frames; AAC audio whose length is within 0.1 s of the video;
// - container: moov before mdat (faststart), under a size cap;
// - decode: a full `ffmpeg -map 0 -f null` pass prints nothing on stderr;
// - sound: every spoken line is audible inside its window (mean > -35 dB),
//   and every pause between lines of 0.2 s or more is quiet (< -45 dB).
//
// The loudness rules assume a narration-only track, with no music bed.
import { execFileSync, spawnSync } from "node:child_process";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { decodeMono, ffmpegPath } from "../narration/track.ts";
import { speechWindows } from "../narration/timeline.ts";
import type { Timeline } from "../narration/types.ts";

export const ffprobePath = process.env.FFPROBE ?? "ffprobe";

export type ProofOptions = {
  videoCodec?: string;
  audioCodec?: string;
  maxBytes?: number;
  avTolerance?: number; // s
  speechDb?: number; // a line's mean level must exceed this
  silenceDb?: number; // a pause's mean level must stay under this
  minPause?: number; // s; shorter gaps are not checked
};

export type Proof = {
  file: string;
  bytes: number;
  video?: { codec: string; width: number; height: number; fps: string; frames: number; duration: number };
  audio?: { codec: string; sampleRate: number; channels: number; duration: number };
  faststart: boolean;
  quietestLine?: { id: string; db: number };
  loudestPause?: { at: number; db: number };
  errors: string[];
};

const RATE = 16000;
const db = (x: Int16Array, a: number, b: number) => {
  const i0 = Math.max(0, Math.floor(a * RATE)), i1 = Math.min(x.length, Math.ceil(b * RATE));
  let e = 0;
  for (let i = i0; i < i1; i++) e += x[i] * x[i];
  return 10 * Math.log10(e / Math.max(1, i1 - i0) / 32767 ** 2 + 1e-12);
};

/** Top-level MP4 atoms in file order (just their types). */
function atoms(file: string): string[] {
  const fd = openSync(file, "r");
  const size = statSync(file).size;
  const out: string[] = [];
  const h = Buffer.alloc(16);
  try {
    for (let pos = 0; pos + 8 <= size && out.length < 64; ) {
      readSync(fd, h, 0, 16, pos);
      let len = h.readUInt32BE(0);
      if (len === 1) len = Number(h.readBigUInt64BE(8));
      else if (len === 0) len = size - pos;
      out.push(h.toString("latin1", 4, 8));
      if (len < 8) break;
      pos += len;
    }
  } finally {
    closeSync(fd);
  }
  return out;
}

export function proveOutput(file: string, tl: Timeline, o: ProofOptions = {}): Proof {
  const {
    videoCodec = "h264", audioCodec = "aac", maxBytes = 10 * 1024 * 1024,
    avTolerance = 0.1, speechDb = -35, silenceDb = -45, minPause = 0.2,
  } = o;
  const errors: string[] = [];
  const bytes = statSync(file).size;
  const probe = JSON.parse(execFileSync(ffprobePath, [
    "-v", "error", "-count_packets",
    "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,duration,nb_read_packets,sample_rate,channels",
    "-of", "json", file,
  ], { encoding: "utf8" })) as { streams: Record<string, string | number>[] };
  const vs = probe.streams.find((s) => s.codec_type === "video");
  const as = probe.streams.find((s) => s.codec_type === "audio");
  const proof: Proof = { file, bytes, faststart: false, errors };

  if (!vs) errors.push("no video stream");
  else {
    const v = proof.video = {
      codec: String(vs.codec_name), width: Number(vs.width), height: Number(vs.height), fps: String(vs.r_frame_rate),
      frames: Number(vs.nb_read_packets), duration: Number(vs.duration),
    };
    if (v.codec !== videoCodec) errors.push(`video codec ${v.codec}, expected ${videoCodec}`);
    if (v.width !== tl.width || v.height !== tl.height) errors.push(`video ${v.width}x${v.height}, timeline ${tl.width}x${tl.height}`);
    const [num, den = "1"] = v.fps.split("/");
    if (Math.abs(Number(num) / Number(den) - tl.fps) > 1e-6) errors.push(`video ${v.fps} fps, timeline ${tl.fps}`);
    if (v.frames !== tl.totalFrames) errors.push(`video has ${v.frames} frames, timeline ${tl.totalFrames}`);
  }
  if (!as) errors.push("no audio stream");
  else {
    const a = proof.audio = { codec: String(as.codec_name), sampleRate: Number(as.sample_rate), channels: Number(as.channels), duration: Number(as.duration) };
    if (a.codec !== audioCodec) errors.push(`audio codec ${a.codec}, expected ${audioCodec}`);
    const vd = proof.video?.duration ?? tl.total;
    if (Math.abs(a.duration - vd) > avTolerance) errors.push(`audio ${a.duration} s vs video ${vd} s (> ${avTolerance} s apart)`);
  }

  const order = atoms(file);
  proof.faststart = order.includes("moov") && order.indexOf("moov") < order.indexOf("mdat");
  if (!proof.faststart) errors.push(`not faststart: atoms ${order.join(" ")}`);
  if (bytes >= maxBytes) errors.push(`${bytes} B ≥ ${maxBytes} B cap`);

  const dec = spawnSync(ffmpegPath, ["-nostdin", "-v", "error", "-i", file, "-map", "0", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 16 << 20 });
  if (dec.status !== 0 || dec.stderr.trim()) errors.push(`decode: exit ${dec.status} ${dec.stderr.trim().split("\n").slice(0, 3).join(" | ")}`);

  if (as) {
    const pcm = decodeMono(file, RATE);
    const wins = speechWindows(tl);
    for (const w of wins) {
      const d = db(pcm, w.start, w.end);
      if (!proof.quietestLine || d < proof.quietestLine.db) proof.quietestLine = { id: w.id, db: +d.toFixed(1) };
      if (d <= speechDb) errors.push(`${w.id}: ${d.toFixed(1)} dB over ${w.start.toFixed(2)}-${w.end.toFixed(2)} s, expected > ${speechDb} dB`);
    }
    // Pauses: between consecutive lines, after the last one, and before the
    // first, trimmed so codec ramps at speech edges are not counted.
    const edges = [{ end: 0 }, ...wins, { start: tl.total }] as { start?: number; end?: number }[];
    for (let i = 0; i + 1 < edges.length; i++) {
      const a = (edges[i].end ?? 0) + 0.1, b = (edges[i + 1].start ?? tl.total) - 0.05;
      if (b - a < minPause) continue;
      const d = db(pcm, a, b);
      if (!proof.loudestPause || d > proof.loudestPause.db) proof.loudestPause = { at: +a.toFixed(2), db: +d.toFixed(1) };
      if (d >= silenceDb) errors.push(`pause ${a.toFixed(2)}-${b.toFixed(2)} s at ${d.toFixed(1)} dB, expected < ${silenceDb} dB`);
    }
  }
  return proof;
}
