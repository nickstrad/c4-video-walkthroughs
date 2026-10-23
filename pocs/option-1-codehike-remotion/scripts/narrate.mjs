// Stage 3: narration. One ElevenLabs /with-timestamps call per scene (the
// code scene's step lines are stitched into one take), saved under narration/
// and committed. Existing takes are reused, never regenerated. The alignment
// then retimes storyboard.json: scene and step durations follow the speech.
//
//   node scripts/narrate.mjs            # synthesise missing takes, then retime
//   node scripts/narrate.mjs --retime   # retime from committed takes only
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const here = new URL("..", import.meta.url).pathname;
const story = JSON.parse(readFileSync(here + "storyboard.json", "utf8"));
const dir = here + "narration/";
mkdirSync(dir, { recursive: true });

const MODEL = "eleven_multilingual_v2";
const DEFAULT_VOICE = "CwhRBWXzGAHq8TQ4Fs17"; // "Roger"
const LEAD = { overview: 0.5, focus: 0.3 }; // silence before speech, s
const TAIL = 0.4;   // padding after the last character, s
const STEP_LEAD = 0.25; // a step lights this long before its words
const MIN_FOCUS = 4;    // the focus scene's zoom needs this long

// Spoken text for a line: `speech` when the caption needs a speakable form
// (see NOTES.md, "Narration pass"), else the caption itself.
const said = (line) => line.speech ?? line.narration;

const takes = story.scenes.map((sc) => {
  const parts = sc.steps ? sc.steps.map(said) : [said(sc)];
  return { scene: sc, parts, text: parts.join(" ") };
});

async function synth({ scene, text }) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set (source /root/Software/.secrets/c4-video.env)");
  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ text, model_id: MODEL }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  writeFileSync(`${dir}${scene.id}.mp3`, Buffer.from(body.audio_base64, "base64"));
  writeFileSync(`${dir}${scene.id}.json`, JSON.stringify({
    voiceId: voice, model: MODEL, text, characters: text.length,
    alignment: body.alignment, normalized_alignment: body.normalized_alignment,
  }, null, 1) + "\n");
  console.log(`synthesised ${scene.id}: ${text.length} chars`);
}

const round = (x) => Math.round(x * 100) / 100;

if (!process.argv.includes("--retime")) {
  for (const t of takes) if (!existsSync(`${dir}${t.scene.id}.json`)) await synth(t);
}

let start = 0, chars = 0;
for (const { scene, parts, text } of takes) {
  const take = JSON.parse(readFileSync(`${dir}${scene.id}.json`, "utf8"));
  if (take.text !== text) throw new Error(`${scene.id}: storyboard text changed since the take; delete narration/${scene.id}.* to re-record`);
  const a = take.alignment;
  if (a.characters.join("") !== text) throw new Error(`${scene.id}: alignment does not cover the text 1:1`);
  const end = a.character_end_times_seconds.at(-1);
  chars += take.characters;
  scene.start = round(start);
  if (scene.steps) {
    // Each step lights STEP_LEAD before its first spoken character.
    const at = scene.intro ?? 0;
    let offset = 0;
    const bounds = parts.map((p, i) => {
      const t0 = a.character_start_times_seconds[offset];
      offset += p.length + 1;
      return i === 0 ? at : at + Math.max(0, t0 - STEP_LEAD);
    });
    bounds.push(at + end + TAIL);
    scene.steps.forEach((st, i) => { st.duration = round(bounds[i + 1] - bounds[i]); });
    scene.audio = { file: `${scene.id}.mp3`, at, end: round(end) };
    scene.duration = round(at + scene.steps.reduce((s, st) => s + st.duration, 0));
  } else {
    const at = LEAD[scene.id] ?? 0.3;
    scene.audio = { file: `${scene.id}.mp3`, at, end: round(end) };
    scene.duration = round(Math.max(at + end + TAIL, scene.id === "focus" ? MIN_FOCUS : 0));
  }
  start += scene.duration;
}
// Keep [a, b] pairs on one line, as in the hand-written storyboard.
const json = JSON.stringify(story, null, 2).replace(/\[\s+(\d+),\s+(\d+)\s+\]/g, "[$1, $2]");
writeFileSync(here + "storyboard.json", json + "\n");
console.log(`retimed: ${takes.length} takes, ${chars} chars, total ${round(start)} s`);
for (const sc of story.scenes) {
  console.log(`  ${sc.id}: start ${sc.start} dur ${sc.duration}${sc.steps ? " steps " + sc.steps.map((s) => s.duration).join(" / ") : ""}`);
}
