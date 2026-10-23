import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
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
assert.equal(end,s.durationFrames);assert.ok(end/s.fps>=25&&end/s.fps<=40,'25–40 s');
for(const scene of s.scenes.filter(x=>x.kind==='code')){const ex=code.excerpts.find(x=>x.id===scene.source);for(const st of scene.steps)for(const n of st.lines)assert.ok(n>=ex.start&&n<=ex.end,`${scene.id} line ${n}`);}
const where=s.scenes.find(x=>x.id==='where'),browserFrames=Number(probe('public/browser.mp4').streams[0].nb_read_frames);
assert.equal(where.duration,where.segments.reduce((n,[a,b])=>n+b-a,0));for(const [a,b] of where.segments)assert.ok(a<b&&b<=browserFrames);
const term=s.scenes.find(x=>x.id==='proof-terminal');assert.equal(term.duration,Math.round(Number(probe('public/terminal-vhs.mp4').format.duration)*s.fps),'terminal plays at 1x');
const tsx=readFileSync('src/index.tsx','utf8');for(const c of s.scenes.flatMap(x=>x.captions))assert.ok(!tsx.includes(c.text),'captions come only from storyboard');
const film=probe('demo.mp4'),v=film.streams.find(x=>x.codec_type==='video');
assert.ok(!film.streams.some(x=>x.codec_type==='audio'),'Narration stub has no audio track');
assert.equal(v.width,1280);assert.equal(v.height,720);assert.equal(v.codec_name,'h264');assert.equal(v.r_frame_rate,'30/1');assert.equal(Number(v.nb_read_frames),s.durationFrames);assert.ok(Math.abs(Number(film.format.duration)-s.durationFrames/s.fps)<0.1);assert.ok(statSync('demo.mp4').size<10000000);
execFileSync('ffmpeg',['-v','error','-threads','2','-i','demo.mp4','-f','null','-'],{stdio:'pipe'});
for(const name of ['title','architecture','code','terminal','end'])assert.ok(statSync(`frames/${name}.png`).size>20000);
const assets=['demo.mp4','public/browser.webm','public/browser.mp4','public/browser-actions.json','public/terminal-vhs.mp4','public/code.json'];
const result={verdict:'PASS',sourceCommit:s.commit,dimensions:[v.width,v.height],fps:v.r_frame_rate,frames:Number(v.nb_read_frames),seconds:Number(film.format.duration),decodedWholeVideo:true,excerptsByteIdentical:code.excerpts.map(x=>`${x.path}:${x.start}-${x.end}`),assets:assets.map(path=>({path,bytes:statSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),...(path.endsWith('.json')?{}:{seconds:Number(probe(path).format.duration)})}))};
writeFileSync('evidence/verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
