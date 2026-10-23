import {readFileSync,writeFileSync,existsSync} from 'node:fs';
// Synthesise each caption's spoken text ONCE with ElevenLabs (with-timestamps) and keep the mp3 and
// alignment under narration/. Lines whose files already exist are never re-requested.
// The key is read from the environment only (source /root/Software/.secrets/c4-video.env); it is never written.
const s=JSON.parse(readFileSync('storyboard.json')),n=s.narration,key=process.env.ELEVENLABS_API_KEY;
const voice=process.env.ELEVENLABS_VOICE_ID||n.voiceId;
let chars=0;
for(const scene of s.scenes)for(const c of scene.captions){
 if(existsSync(c.audio)&&existsSync(c.alignment))continue;
 if(!key)throw new Error('ELEVENLABS_API_KEY is not set');
 const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`,{method:'POST',headers:{'xi-api-key':key,'content-type':'application/json'},body:JSON.stringify({text:c.spoken,model_id:n.model})});
 if(!r.ok)throw new Error(`${c.audio}: HTTP ${r.status} ${await r.text()}`);
 const j=await r.json();
 writeFileSync(c.audio,Buffer.from(j.audio_base64,'base64'));
 writeFileSync(c.alignment,JSON.stringify({text:c.spoken,voiceId:voice,model:n.model,alignment:j.alignment,normalized_alignment:j.normalized_alignment},null,1)+'\n');
 chars+=c.spoken.length;console.log(`${c.audio}: ${c.spoken.length} chars, ends ${j.alignment.character_end_times_seconds.at(-1)} s`);
}
console.log(`requested characters: ${chars}`);
