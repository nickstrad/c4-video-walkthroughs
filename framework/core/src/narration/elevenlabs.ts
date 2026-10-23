// ElevenLabs text-to-speech/with-timestamps client. The API key is read from
// the secrets env file at call time and never written or logged. Nothing else
// in the framework talks to ElevenLabs; builds reuse committed takes.
import { readFileSync } from "node:fs";
import type { Alignment } from "./types.ts";

export const SECRETS_FILE = "/root/Software/.secrets/c4-video.env";

/** Parse KEY=value lines (optionally `export`ed and quoted). */
export function readEnvFile(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return env;
}

export function credentials(file = process.env.C4V_SECRETS ?? SECRETS_FILE) {
  const env = readEnvFile(file);
  if (!env.ELEVENLABS_API_KEY) throw new Error(`ELEVENLABS_API_KEY missing in ${file}`);
  return { key: env.ELEVENLABS_API_KEY, voiceId: env.ELEVENLABS_VOICE_ID || undefined };
}

export type SynthRequest = {
  text: string;
  voiceId: string;
  model: string;
  outputFormat: string;
  /** Neighbouring lines, so separately voiced takes keep continuous prosody. */
  previousText?: string;
  nextText?: string;
};
export type SynthResult = { audio: Buffer; alignment: Alignment; normalized_alignment: Alignment };

export async function synthesize(req: SynthRequest, key: string): Promise<SynthResult> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${req.voiceId}/with-timestamps?output_format=${req.outputFormat}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ text: req.text, model_id: req.model, previous_text: req.previousText, next_text: req.nextText }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  return { audio: Buffer.from(body.audio_base64, "base64"), alignment: body.alignment, normalized_alignment: body.normalized_alignment };
}
