import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const repo=process.env.BOOK_NOTES_REPO||'/root/Software/book-notes';
const read=p=>JSON.parse(readFileSync(p));
const s=read('storyboard.json'),code=read('public/code.json'),dataset=read('public/litefleet.json');
assert.equal(execFileSync('git',['-C',repo,'rev-parse',`${s.tag}^{commit}`],{encoding:'utf8'}).trim(),s.commit);
assert.equal(code.sha,s.commit);
// Every excerpt on screen is byte-identical to its declared inclusive range in the pinned git object.
const decl=sym=>sym.startsWith('(*')?sym.replace(/^\(\*(\w+)\)\.(\w+)$/,(_,t,m)=>`func (${t[0].toLowerCase()} *${t}) ${m}(`):`func ${sym}(`;
for(const item of s.sources){
 const src=execFileSync('git',['-C',repo,'show',`${item.commit}:${item.path}`],{encoding:'utf8'}).split('\n');
 const range=src.slice(item.lines[0]-1,item.lines[1]);
 assert.ok(range[0].startsWith(decl(item.symbol)),`${item.symbol} declared on line ${item.lines[0]}`);
 if(item.excerpt){const ex=code.excerpts.find(x=>x.id===item.id);assert.ok(ex,item.id);assert.equal(ex.path,item.path);assert.deepEqual([ex.start,ex.end],item.lines);assert.deepEqual(ex.lines,range,`${item.id} excerpt is byte-identical`);}
}
for(const element of s.elements)assert.ok(dataset.model.elements.some(x=>x.id===element),element);
assert.ok(dataset.diagrams.some(x=>x.id===s.view));
assert.equal(createHash('sha256').update(readFileSync('public/litefleet.json')).digest('hex'),read('evidence/provenance.json').datasetSha256);
const browser=read('evidence/browser.json');assert.deepEqual(browser.errors,[]);assert.ok(browser.url.endsWith('/gateway-components/elements/gw-breaker'));
assert.match(readFileSync('evidence/breaker-tests.txt','utf8'),/--- PASS: TestOpensAfterConsecutiveFailures[\s\S]*PASS\nok\s+litefleet\/internal\/breaker/);
// Timeline: contiguous scenes, highlighted lines inside their excerpt, cuts inside the real clip, 1x terminal.
const probe=p=>JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_format','-show_streams','-of','json',p],{encoding:'utf8'}));
let end=0;for(const scene of s.scenes){assert.equal(scene.from,end,scene.id);end+=scene.duration;}
assert.equal(end,s.durationFrames);assert.ok(end/s.fps>=25&&end/s.fps<=60,'25–60 s');
for(const scene of s.scenes.filter(x=>x.kind==='code')){const ex=code.excerpts.find(x=>x.id===scene.source);for(const st of scene.steps)for(const n of st.lines)assert.ok(n>=ex.start&&n<=ex.end,`${scene.id} line ${n}`);}
const where=s.scenes.find(x=>x.id==='where'),browserFrames=Number(probe('public/browser.mp4').streams[0].nb_read_frames);
assert.equal(where.duration,where.segments.reduce((n,[a,b])=>n+b-a,0)+(where.holdFrames??0));for(const [a,b] of where.segments)assert.ok(a<b&&b<=browserFrames);
const term=s.scenes.find(x=>x.id==='proof-terminal');assert.equal(term.duration-(term.holdFrames??0),Math.round(Number(probe('public/terminal-vhs.mp4').format.duration)*s.fps),'terminal plays at 1x');
// Narration: every line synthesised from its storyboard text, spoken inside its scene, no two lines overlapping.
for(const scene of s.scenes){let free=0;for(const c of scene.captions){const a=read(c.alignment),endF=Math.ceil(a.alignment.character_end_times_seconds.at(-1)*s.fps);
 assert.equal(a.text,c.spoken,c.audio);assert.equal(a.model,s.narration.model);assert.equal(c.audioFrames,endF);assert.ok(c.at>=free,`${c.audio} overlaps the previous line`);
 assert.ok(c.at+endF+9<=scene.duration,`${c.audio} must end ≥0.3 s before its scene cut`);assert.ok(statSync(c.audio).size>10000);free=c.at+endF;}}
const tsx=readFileSync('src/index.tsx','utf8');for(const c of s.scenes.flatMap(x=>x.captions))assert.ok(!tsx.includes(c.text),'captions come only from storyboard');
const film=probe('demo.mp4'),v=film.streams.find(x=>x.codec_type==='video');
const au=film.streams.filter(x=>x.codec_type==='audio');assert.equal(au.length,1,'one narration audio track');assert.equal(au[0].codec_name,'aac');
assert.ok(Math.abs(Number(au[0].duration)-Number(v.duration))<0.1,'audio and video durations agree');
assert.equal(v.width,1280);assert.equal(v.height,720);assert.equal(v.codec_name,'h264');assert.equal(v.r_frame_rate,'30/1');assert.equal(Number(v.nb_read_frames),s.durationFrames);assert.ok(Math.abs(Number(film.format.duration)-s.durationFrames/s.fps)<0.1);assert.ok(statSync('demo.mp4').size<10000000);
const decodeErr=execFileSync('ffmpeg',['-v','error','-threads','2','-i','demo.mp4','-map','0','-f','null','-'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.equal(decodeErr,'');
// The rendered audio is speech where the storyboard says a line plays (not silence).
const loud=(t0,t1)=>Number(/mean_volume: (-?[\d.]+) dB/.exec(spawnSync('ffmpeg',['-hide_banner','-ss',String(t0),'-t',String(t1-t0),'-i','demo.mp4','-vn','-af','volumedetect','-f','null','-'],{encoding:'utf8'}).stderr)[1]);
const speech=s.scenes.flatMap(x=>x.captions.map(c=>{const start=(x.from+c.at)/s.fps,end=(x.from+c.at+c.audioFrames)/s.fps;return {audio:c.audio,start,end,meanDb:loud(start,end)};}));
for(const l of speech)assert.ok(l.meanDb>-35,`${l.audio} is audible in the film (${l.meanDb} dB)`);
const pause=speech.slice(0,-1).map((l,i)=>[l.end+0.05,speech[i+1].start-0.02]).filter(([a,b])=>b-a>=0.2).map(([a,b])=>loud(a,b));
assert.ok(pause.every(db=>db<-45),'pauses between lines are silent: '+pause);
for(const name of ['title','architecture','code','terminal','end'])assert.ok(statSync(`frames/${name}.png`).size>20000);
const assets=['demo.mp4','public/browser.webm','public/browser.mp4','public/browser-actions.json','public/terminal-vhs.mp4','public/code.json'];
const result={verdict:'PASS',audio:{codec:au[0].codec_name,seconds:Number(au[0].duration),videoSeconds:Number(v.duration),lines:speech.length,perLine:speech,pausesMeanDb:pause},sourceCommit:s.commit,dimensions:[v.width,v.height],fps:v.r_frame_rate,frames:Number(v.nb_read_frames),seconds:Number(film.format.duration),decodedWholeVideo:true,excerptsByteIdentical:code.excerpts.map(x=>`${x.path}:${x.start}-${x.end}`),assets:assets.map(path=>({path,bytes:statSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),...(path.endsWith('.json')?{}:{seconds:Number(probe(path).format.duration)})}))};
writeFileSync('evidence/verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
