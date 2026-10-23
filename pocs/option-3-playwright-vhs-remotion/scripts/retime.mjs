import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
// Let the voice drive the cuts. Each caption starts where the previous line's alignment ends (plus a gap);
// highlight steps with a `cue` start at that word's aligned start; every scene lasts until its last
// line's aligned end plus a tail. Footage still plays at 1x: the browser's last cut runs on into the
// clip's real static tail, and only what the voice needs beyond the real footage is a held last frame.
const LEAD=6,GAP=4,TAIL=12,CUE_LEAD=2; // frames; TAIL 0.4 s at 30 fps
const s=JSON.parse(readFileSync('storyboard.json')),fps=s.fps;
const frames=p=>Number(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','csv=p=0',p],{encoding:'utf8'}).trim());
const seconds=p=>Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',p],{encoding:'utf8'}).trim());
const lines=[];
for(const scene of s.scenes){
 let t=LEAD;
 for(const c of scene.captions){
  const a=JSON.parse(readFileSync(c.alignment));
  if(a.text!==c.spoken)throw new Error(`${c.alignment} was synthesised from different text`);
  const al=a.alignment,end=al.character_end_times_seconds.at(-1);
  c.at=t;c.audioFrames=Math.ceil(end*fps);t=c.at+c.audioFrames+GAP;
  for(const st of scene.steps??[])if(st.cue){
   const i=c.spoken.indexOf(st.cue);if(i<0)throw new Error(`cue "${st.cue}" not in ${scene.id}`);
   st.at=Math.max(0,c.at+Math.round(al.character_start_times_seconds[i]*fps)-CUE_LEAD);
  }
  lines.push({id:c.audio.replace(/^narration\/|\.mp3$/g,''),scene:scene.id,characters:c.spoken.length,alignedEndSeconds:end,audioSeconds:seconds(c.audio),startFrame:null,at:c.at,audioFrames:c.audioFrames});
 }
 const last=scene.captions.at(-1),need=last?last.at+last.audioFrames+TAIL:scene.duration;
 if(scene.kind==='playwright'){
  const actions=JSON.parse(readFileSync(scene.actionsAsset)),clip=frames(scene.asset);
  const seg=scene.segments.at(-1),base=scene.segments.slice(0,-1).reduce((n,[a,b])=>n+b-a,0);
  const actionEnd=Math.round((actions.find(x=>x.kind==='end').t-0.1)*fps); // normalize.mjs's cut
  seg[1]=Math.min(clip,Math.max(actionEnd,seg[0]+need-base));
  const real=base+seg[1]-seg[0];scene.holdFrames=Math.max(0,need-real);scene.duration=real+scene.holdFrames;
 }else if(scene.kind==='vhs'){
  const real=Math.round(seconds(scene.asset)*fps);scene.holdFrames=Math.max(0,need-real);scene.duration=real+scene.holdFrames;
 }else scene.duration=need;
}
let from=0;for(const scene of s.scenes){scene.from=from;from+=scene.duration;}
s.durationFrames=from;s.durationSeconds=Math.round(from/fps*1000)/1000;
for(const l of lines)l.startFrame=s.scenes.find(x=>x.id===l.scene).from+l.at;
writeFileSync('storyboard.json',JSON.stringify(s,null,2)+'\n');
const summary={voice:s.narration.voice,voiceId:s.narration.voiceId,model:s.narration.model,lines:lines.length,characters:lines.reduce((n,l)=>n+l.characters,0),timing:{leadFrames:LEAD,gapFrames:GAP,tailFrames:TAIL,cueLeadFrames:CUE_LEAD},holds:Object.fromEntries(s.scenes.filter(x=>x.holdFrames).map(x=>[x.id,x.holdFrames])),filmFrames:from,filmSeconds:from/fps,perLine:lines};
writeFileSync('evidence/narration.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({scenes:s.scenes.map(x=>[x.id,x.from,x.duration,x.holdFrames??0]),total:from,seconds:from/fps}));
