import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const repo=process.env.BOOK_NOTES_REPO||'/root/Software/book-notes';
const read=p=>JSON.parse(readFileSync(p));
const s=read('storyboard.json'),code=read('public/code.json'),dataset=read('public/litefleet.json');
assert.equal(execFileSync('git',['-C',repo,'rev-parse',`${s.tag}^{commit}`],{encoding:'utf8'}).trim(),s.commit);
for(const item of s.sources){
 const src=execFileSync('git',['-C',repo,'show',`${s.commit}:${item.path}`],{encoding:'utf8'});
 assert.ok(src.includes(item.symbol.replace('(*Breaker).','func (b *Breaker) ').replace('(*Client).','func (c *Client) ')),item.symbol);
 assert.ok(src.split('\n').slice(item.lines[0]-1,item.lines[1]).join('\n').includes(item.symbol.split('.').pop()),'symbol in pinned range');
 if(item.path===code.path)assert.deepEqual(src.split('\n').slice(code.start-1,code.end),code.lines);
}
for(const element of s.elements)assert.ok(dataset.model.elements.some(x=>x.id===element),element);
assert.ok(dataset.diagrams.some(x=>x.id===s.view));
assert.equal(createHash('sha256').update(readFileSync('public/litefleet.json')).digest('hex'),read('evidence/provenance.json').datasetSha256);
assert.deepEqual(read('evidence/browser.json').errors,[]);
assert.match(readFileSync('evidence/breaker-tests.txt','utf8'),/PASS\nok\s+litefleet\/internal\/breaker/);
let end=0;for(const scene of s.scenes){assert.equal(scene.from,end);end+=scene.duration;}assert.equal(end,32);
const probe=p=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',p],{encoding:'utf8'}));
const film=probe('demo.mp4'),v=film.streams.find(x=>x.codec_type==='video');
assert.ok(!film.streams.some(x=>x.codec_type==='audio'),'Narration stub has no audio track');
assert.equal(v.width,1280);assert.equal(v.height,720);assert.equal(v.codec_name,'h264');assert.equal(v.r_frame_rate,'30/1');assert.equal(Number(v.nb_frames),960);assert.ok(Math.abs(Number(film.format.duration)-32)<0.1);assert.ok(statSync('demo.mp4').size<10000000);
execFileSync('ffmpeg',['-v','error','-threads','2','-i','demo.mp4','-f','null','-'],{stdio:'pipe'});
for(const name of ['architecture','code','terminal'])assert.ok(statSync(`frames/${name}.png`).size>20000);
const assets=['demo.mp4','public/browser.webm','public/browser.mp4','public/terminal-vhs.mp4','public/terminal.mp4'];
const result={verdict:'PASS',sourceCommit:s.commit,dimensions:[v.width,v.height],fps:v.r_frame_rate,frames:Number(v.nb_frames),seconds:Number(film.format.duration),decodedWholeVideo:true,assets:assets.map(path=>({path,bytes:statSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),seconds:Number(probe(path).format.duration)}))};
writeFileSync('evidence/verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
