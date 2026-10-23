// Generate one ElevenLabs take per slide from narration/script.json.
// Existing takes are reused, never regenerated: delete a take's files to redo it.
// The API key is read from ELEVENLABS_API_KEY or the secrets env file; it is
// never printed or written.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';

const secrets=process.env.C4_VIDEO_SECRETS || '/root/Software/.secrets/c4-video.env';
const env={};
if(existsSync(secrets)) {
  for(const line of readFileSync(secrets,'utf8').split('\n')) {
    const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');
  }
}
const key=process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY;
const script=JSON.parse(readFileSync('narration/script.json','utf8'));
const voiceId=process.env.ELEVENLABS_VOICE_ID || env.ELEVENLABS_VOICE_ID || script.voice.voice_id;
let generated=0, characters=0;
for(const s of script.slides) {
  const audio=`narration/${s.id}.mp3`, alignment=`narration/${s.id}.alignment.json`;
  if(existsSync(audio) && existsSync(alignment)) {
    const saved=JSON.parse(readFileSync(alignment,'utf8'));
    if(saved.text!==s.text) throw Error(`${s.id}: script text differs from the saved take; delete the take to regenerate`);
    console.log(`${s.id}: reusing saved take`);
    continue;
  }
  if(!key) throw Error('ELEVENLABS_API_KEY is not set');
  const response=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${script.voice.output_format}`,{
    method:'POST',
    headers:{'xi-api-key':key,'Content-Type':'application/json'},
    body:JSON.stringify({text:s.text,model_id:script.voice.model_id})
  });
  if(!response.ok) throw Error(`${s.id}: ElevenLabs HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
  const body=await response.json();
  writeFileSync(audio,Buffer.from(body.audio_base64,'base64'));
  writeFileSync(alignment,JSON.stringify({text:s.text,voice_id:voiceId,model_id:script.voice.model_id,output_format:script.voice.output_format,
    characters:s.text.length,alignment:body.alignment,normalized_alignment:body.normalized_alignment},null,1)+'\n');
  generated++; characters+=s.text.length;
  console.log(`${s.id}: generated ${s.text.length} characters, ends at ${body.alignment.character_end_times_seconds.at(-1)}s`);
}
console.log(`Generated ${generated} takes, ${characters} characters`);
