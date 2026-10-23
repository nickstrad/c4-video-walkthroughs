import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
// Cut the real browser recording to its actions (dropping load waits and layout flashes) and
// time the storyboard from measured media. Footage is never retimed: every kept frame plays at 1x.
const probe=(p,entries)=>execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries',entries,'-of','csv=p=0',p],{encoding:'utf8'}).trim();
const seconds=p=>Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',p],{encoding:'utf8'}).trim());
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','public/browser.webm','-an','-vf','fps=30','-c:v','libx264','-threads','2','-crf','20','-pix_fmt','yuv420p','public/browser.mp4']);
const s=JSON.parse(readFileSync('storyboard.json'));
const fps=s.fps,actions=JSON.parse(readFileSync('public/browser-actions.json'));
const at=(kind,label)=>actions.find(a=>a.kind===kind&&(!label||a.label===label)).t;
const tail=-0.1; // the page starts navigating on the click frame; end just before it (the composition marks the click)
const cut=[[at('ready','Catalog opens on Litefleet: system context'),at('click','Open Litefleet')+tail],[at('ready','Litefleet: containers'),at('click','Open Gateway')+tail],[at('ready','Litefleet: gateway components'),at('end')+tail]];
const where=s.scenes.find(x=>x.id==='where');
where.segments=cut.map(([a,b])=>[Math.round(a*fps),Math.round(b*fps)]);
where.duration=where.segments.reduce((n,[a,b])=>n+b-a,0);
if(existsSync('public/terminal.mp4'))renameSync('public/terminal.mp4','public/terminal-vhs.mp4');
const terminal=s.scenes.find(x=>x.id==='proof-terminal');
terminal.duration=Math.round(seconds('public/terminal-vhs.mp4')*fps); // VHS emits 25 fps here; time by duration
let from=0;for(const scene of s.scenes){scene.from=from;from+=scene.duration;}
s.durationFrames=from;s.durationSeconds=Math.round(from/fps*1000)/1000;
writeFileSync('storyboard.json',JSON.stringify(s,null,2)+'\n');
writeFileSync('evidence/normalization.json',JSON.stringify({browserRawSeconds:seconds('public/browser.webm'),browserKeptSeconds:where.duration/fps,browserSegmentsFrames:where.segments,browserTreatment:'Cut to the action windows from public/browser-actions.json; kept footage plays at 1x.',terminalVhsRawSeconds:seconds('public/terminal-vhs.mp4'),terminalVhsFrames:Number(probe('public/terminal-vhs.mp4','stream=nb_read_frames')),terminalSceneFrames:terminal.duration,terminalTreatment:'Raw VHS take played at 1x, not retimed or padded; no synthetic test output.',filmFrames:from},null,2)+'\n');
console.log(JSON.stringify({segments:where.segments,where:where.duration,terminal:terminal.duration,total:from}));
