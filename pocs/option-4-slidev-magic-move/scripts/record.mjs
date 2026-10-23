import {chromium} from 'playwright';
import {spawn, execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {homedir} from 'node:os';
import {resolve} from 'node:path';

const started=performance.now();
// Narration drives the schedule. Each slide's take (npm run narrate) starts
// LEAD seconds after that slide appears; the next slide waits for the take's
// last aligned character plus TAIL. Clicks fire CLICK_LEAD before the cue phrase,
// so a morph or zoom plays while its words are spoken.
const LEAD=0.3, TAIL=0.45, HOLD=1.5, CLICK_LEAD=0.2;
const narration=JSON.parse(readFileSync('narration/script.json','utf8'));
const takes=narration.slides.map(s=>{
  const saved=JSON.parse(readFileSync(`narration/${s.id}.alignment.json`,'utf8'));
  const al=saved.alignment, spoken=al.characters.join('');
  if(saved.text!==s.text || spoken!==s.text) throw Error(`${s.id}: alignment does not match narration/script.json`);
  const file=`narration/${s.id}.mp3`;
  const audioSeconds=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file],{encoding:'utf8'}));
  const cues=s.cues.map(c=>{
    const i=spoken.indexOf(c.phrase);
    if(i<0) throw Error(`${s.id}: cue phrase not found: ${c.phrase}`);
    return {...c,at:al.character_start_times_seconds[i]};
  });
  return {id:s.id,file,characters:s.text.length,speechEnd:al.character_end_times_seconds.at(-1),audioSeconds,cues};
});
if(takes.length!==5) throw Error('Expected one narration take per slide');
const url='http://localhost:4314';
mkdirSync('evidence',{recursive:true});
mkdirSync('recordings',{recursive:true});
mkdirSync('frames',{recursive:true});
const buildStarted=performance.now();
try {
  const output=execFileSync(process.execPath,['node_modules/@slidev/cli/bin/slidev.mjs','build','slides.md'],{
    encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=1536'}
  });
  writeFileSync('evidence/build.log',output);
} catch(error) {
  writeFileSync('evidence/build.log',String(error.stdout||'')+'\n'+String(error.stderr||''));
  throw error;
}
const buildSeconds=(performance.now()-buildStarted)/1000;
console.log(`Static Slidev build completed in ${buildSeconds.toFixed(1)}s`);
const log=[];
writeFileSync('evidence/slidev.log','');
const collect=d=>{log.push(d.toString());writeFileSync('evidence/slidev.log',log.join(''));};
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','localhost','--port','4314','--strictPort'],{stdio:['ignore','pipe','pipe']});
server.stdout.on('data',collect);
server.stderr.on('data',collect);
let browser;
const errors=[];
const consoleMessages=[];
const observeConsole=msg=>{if(['warning','error'].includes(msg.type()))consoleMessages.push({type:msg.type(),text:msg.text()});};
try {
  let ready=false;
  for(let i=0;i<360;i++) {
    if(server.exitCode!==null) throw Error(`Slidev exited ${server.exitCode}`);
    try { if((await fetch(url)).ok) {ready=true;break;} } catch {}
    await new Promise(r=>setTimeout(r,500));
  }
  if(!ready) throw Error('Slidev did not become ready');
  // Prefer the pinned Playwright browser. An explicit executable may reuse a
  // preinstalled browser on constrained hosts; its actual version is logged.
  let executablePath=process.env.CHROMIUM_PATH;
  if(!executablePath && !existsSync(chromium.executablePath())) {
    const cache=resolve(homedir(),'.cache/ms-playwright');
    const dir=readdirSync(cache).filter(x=>x.startsWith('chromium_headless_shell-')).sort().at(-1);
    const candidate=dir && resolve(cache,dir,'chrome-headless-shell-linux64','chrome-headless-shell');
    if(candidate && existsSync(candidate)) executablePath=candidate;
  }
  browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
  const warm=await browser.newPage({viewport:{width:1280,height:720}});
  await warm.addInitScript(()=>localStorage.setItem('slidev-wake-lock','false'));
  warm.on('console',observeConsole);
  warm.on('pageerror',e=>errors.push(e.message));
  // Warm every scene and click state; screenshot each for evidence/.
  const states=[[1,0],[2,0],[2,1],[3,0],[3,1],[3,2],[4,0],[5,0]];
  for(const [slide,clicks] of states) {
    for(let attempt=0;attempt<3;attempt++) {
      try {
        await warm.goto(`${url}/${slide}?clicks=${clicks}`,{waitUntil:'domcontentloaded',timeout:90000});
        await warm.locator('.slidev-page:visible h1').first().waitFor({timeout:30000});
        break;
      } catch(error) {
        if(attempt===2) throw error;
        console.log(`Retrying slide ${slide} after a startup/module loading timeout`);
      }
    }
    await warm.evaluate(()=>document.fonts.ready);
    await warm.waitForTimeout(2500);
    await warm.screenshot({path:`evidence/slide-${slide}${clicks?`-click-${clicks}`:''}.png`});
    if(slide===3) {
      const layout=await warm.locator('.slidev-page:visible').evaluate(page=>{
        const tokens=[...page.querySelectorAll('.shiki-magic-move-item')].map(el=>el.getBoundingClientRect());
        const code=page.querySelector('.shiki-magic-move-container').getBoundingClientRect();
        const cite=[...page.querySelectorAll('.cites .source')].map(el=>el.getBoundingClientRect().bottom);
        const callouts=page.querySelector('.callouts').getBoundingClientRect();
        return {maxRight:Math.max(...tokens.map(r=>r.right)),codeBottom:code.bottom,citeBottom:Math.max(...cite),calloutsTop:callouts.top,calloutsBottom:callouts.bottom};
      });
      if(layout.maxRight>1225) throw Error(`Magic Move tokens overflow the slide at click ${clicks}`);
      if(layout.citeBottom>layout.calloutsTop || layout.calloutsBottom>646) throw Error(`Magic Move callout overlaps code or caption at click ${clicks}: ${JSON.stringify(layout)}`);
    }
  }
  await warm.close();
  const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:'recordings',size:{width:1280,height:720}}});
  await context.addInitScript(()=>localStorage.setItem('slidev-wake-lock','false'));
  const page=await context.newPage();
  page.on('console',observeConsole);
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${url}/1`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('.slidev-page:visible h1').first().waitFor({timeout:90000});
  await page.evaluate(()=>document.fonts.ready);
  await page.mouse.move(1279,719);
  const timeline=[];
  const origin=performance.now();
  const waitUntil=async(seconds)=>{const ms=origin+seconds*1000-performance.now();if(ms>0)await page.waitForTimeout(ms);};
  const advance=async(at,label)=>{
    await waitUntil(at);
    await page.keyboard.press('ArrowRight');
    timeline.push({targetSeconds:at,actualSeconds:(performance.now()-origin)/1000,label,url:page.url()});
  };
  // Scene schedule (seconds), computed from each slide's actual start so
  // browser drift never pushes a click or slide change into the wrong words.
  const schedule={};
  const placements=[];
  const startSlide=(index,actual)=>{
    placements.push({id:takes[index].id,file:takes[index].file,at:actual+LEAD,speechEnd:actual+LEAD+takes[index].speechEnd});
    return actual;
  };
  const speechDone=index=>placements[index].speechEnd+TAIL;
  const cueAt=(index,label)=>placements[index].at+takes[index].cues.find(c=>c.label===label).at-CLICK_LEAD;
  const advanceAt=async(at,label)=>{schedule[label]=at;await advance(at,label);return timeline.at(-1).actualSeconds;};
  const codeText=()=>page.locator('.slidev-page:visible .shiki-magic-move-container').innerText();
  const animations=()=>page.locator('.slidev-page:visible .shiki-magic-move-container').evaluate(el=>el.getAnimations({subtree:true}).length);
  const s1=startSlide(0,0);
  const s2=startSlide(1,await advanceAt(speechDone(0),'architecture'));
  const zoom=await advanceAt(cueAt(1,'C4 zoom to node client'),'C4 zoom to node client');
  const s3=startSlide(2,await advanceAt(speechDone(1),'magic move: v0-flawed'));
  await waitUntil(s3+1.5);
  const active=await page.locator('.slidev-page:visible .shiki-magic-move-container').count();
  if(active!==1) throw Error(`Expected one active Magic Move block, got ${active}`);
  const flawedText=await codeText();
  if(!flawedText.includes('http.Client{}')) throw Error('Magic Move v0 code missing');
  const deadlines=await advanceAt(cueAt(2,'magic move click: lesson-02 deadlines'),'magic move click: lesson-02 deadlines');
  await waitUntil(deadlines+0.4);
  const morph1=await animations();
  if(!morph1) throw Error('No active Magic Move animations in the first morph');
  await waitUntil(deadlines+2.5);
  const deadlinesText=await codeText();
  if(!deadlinesText.includes('Dial: 200') || deadlinesText.includes('retry.Policy')) throw Error('Magic Move lesson-02 code missing');
  const hardened=await advanceAt(cueAt(2,'magic move click: v1-hardened'),'magic move click: v1-hardened');
  await waitUntil(hardened+0.4);
  const morph2=await animations();
  if(!morph2) throw Error('No active Magic Move animations in the second morph');
  await waitUntil(hardened+2.5);
  const hardenedText=await codeText();
  if(!hardenedText.includes('2500') || !hardenedText.includes('retry.Policy')) throw Error('Magic Move v1 code missing');
  const s4=startSlide(3,await advanceAt(speechDone(2),'evidence'));
  const s5=startSlide(4,await advanceAt(speechDone(3),'end card'));
  await page.locator('[data-slidev-no="5"]:visible h1').waitFor();
  schedule.stop=placements[4].speechEnd+HOLD;
  await waitUntil(schedule.stop);
  // No spoken word may run past its slide: each take must end before the next
  // slide's actual start (and the last before the end of the video).
  const slideStarts=[s1,s2,s3,s4,s5,schedule.stop];
  placements.forEach((p,i)=>{if(p.speechEnd>slideStarts[i+1]-0.1) throw Error(`${p.id} speech runs past its slide`);});
  const video=page.video();
  await context.close();
  const raw=await video.path();
  const ffmpeg=process.env.FFMPEG || 'ffmpeg';
  const rawInfo=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',raw],{encoding:'utf8'}));
  // Playwright begins video at page creation; cut the warm navigation lead-in
  // by taking the final scheduled seconds of the recorded context.
  const length=schedule.stop;
  const trimStart=Math.max(0,Number(rawInfo.format.duration)-length);
  // Mux: each take is delayed to its slide's actual start + LEAD, mixed without
  // level normalisation, padded with silence and cut with the video.
  const audioInputs=placements.flatMap(p=>['-i',p.file]);
  const delays=placements.map((p,i)=>`[${i+1}:a]adelay=${Math.round(p.at*1000)}:all=1[a${i}]`).join(';');
  const mix=`${delays};${placements.map((_,i)=>`[a${i}]`).join('')}amix=inputs=${placements.length}:normalize=0:duration=longest,apad[aout]`;
  execFileSync(ffmpeg,['-y','-v','error','-ss',String(trimStart),'-i',raw,...audioInputs,'-filter_complex',mix,'-map','0:v','-map','[aout]','-t',String(length),
    '-vf','fps=30','-c:v','libx264','-threads','2','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','44100','-movflags','+faststart','demo.mp4']);
  const frames=[['01-opener',s1+3],['02-architecture-zoom',zoom+3],['03-flawed',s3+6],['04-magic-move',hardened+1.4],['05-hardened',hardened+8],['06-evidence',s4+10],['07-end-card',s5+5]];
  for(const [name,t] of frames) {
    execFileSync(ffmpeg,['-y','-v','error','-ss',String(t),'-i','demo.mp4','-frames:v','1',`frames/${name}.png`]);
  }
  const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json','demo.mp4'],{encoding:'utf8'}));
  writeFileSync('evidence/render.json',JSON.stringify({elapsedSeconds:(performance.now()-started)/1000,buildSeconds,narration:{voice:narration.voice,lead:LEAD,tail:TAIL,hold:HOLD,clickLead:CLICK_LEAD,takes,placements},consoleMessages,chromium:browser.version(),executablePath:executablePath||chromium.executablePath(),timeline,schedule,frames,magicMove:{flawedText,deadlinesText,hardenedText,activeAnimations:[morph1,morph2]},trimStart,errors,probe},null,2)+'\n');
  if(errors.length) throw Error(`Browser errors: ${errors.join('; ')}`);
  console.log(`Recorded ${probe.format.duration}s MP4, ${probe.format.size} bytes; ${(performance.now()-started)/1000}s wall time`);
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
  writeFileSync('evidence/slidev.log',log.join(''));
}
