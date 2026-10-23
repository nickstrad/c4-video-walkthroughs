import {chromium} from 'playwright';
import {spawn, execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, existsSync, readdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {homedir} from 'node:os';
import {resolve} from 'node:path';

const started=performance.now();
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
  for(let slide=1;slide<=6;slide++) {
    for(let attempt=0;attempt<3;attempt++) {
      try {
        await warm.goto(`${url}/${slide}`,{waitUntil:'domcontentloaded',timeout:90000});
        await warm.locator('.slidev-page:visible h1').first().waitFor({timeout:30000});
        break;
      } catch(error) {
        if(attempt===2) throw error;
        console.log(`Retrying slide ${slide} after a startup/module loading timeout`);
      }
    }
    await warm.evaluate(()=>document.fonts.ready);
    await warm.waitForTimeout(300);
    await warm.screenshot({path:`evidence/slide-${slide}.png`});
    if(slide===4) {
      await warm.keyboard.press('ArrowRight');
      await warm.waitForTimeout(2500);
      await warm.screenshot({path:'evidence/slide-4-after.png'});
      const clipped=await warm.locator('.slidev-page:visible .shiki-magic-move-item').evaluateAll(items=>items.some(el=>el.getBoundingClientRect().right>1225));
      if(clipped) throw Error('Hardened Magic Move tokens overflow the slide');
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
  await advance(4,'architecture');
  await advance(8,'node client');
  await advance(12,'evolution before');
  await waitUntil(14);
  const before=await page.locator('.slidev-page:visible .shiki-magic-move-container').count();
  if(before!==1) throw Error(`Expected one active Magic Move block, got ${before}`);
  const beforeText=await page.locator('.slidev-page:visible .shiki-magic-move-container').innerText();
  if(!beforeText.includes('http.Client{}')) throw Error('Magic Move before code missing');
  await advance(16,'magic move click');
  await waitUntil(17.2);
  const moving=await page.locator('.slidev-page:visible .shiki-magic-move-container').evaluate(el=>({text:el.textContent,animations:el.getAnimations({subtree:true}).length}));
  if(!moving.animations) throw Error('No active Magic Move animations detected');
  await waitUntil(18.6);
  const afterText=await page.locator('.slidev-page:visible .shiki-magic-move-container').innerText();
  if(!afterText.includes('2500') || !afterText.includes('retry.Policy')) throw Error('Magic Move after code missing');
  await advance(19,'transport');
  await advance(23,'evidence');
  await page.locator('[data-slidev-no="6"]:visible h1').waitFor();
  await waitUntil(28);
  const video=page.video();
  await context.close();
  const raw=await video.path();
  const ffmpeg=process.env.FFMPEG || 'ffmpeg';
  const rawInfo=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',raw],{encoding:'utf8'}));
  // Playwright begins video at page creation; cut the warm navigation lead-in
  // by taking the final 28 seconds of the recorded context.
  const trimStart=Math.max(0,Number(rawInfo.format.duration)-28);
  execFileSync(ffmpeg,['-y','-v','error','-ss',String(trimStart),'-i',raw,'-t','28','-an','-vf','fps=30','-c:v','libx264','-threads','2','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart','demo.mp4']);
  for(const [name,t] of [['01-architecture',6],['02-magic-move',17.6],['03-hardened',18.6]]) {
    execFileSync(ffmpeg,['-y','-v','error','-ss',String(t),'-i','demo.mp4','-frames:v','1',`frames/${name}.png`]);
  }
  const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json','demo.mp4'],{encoding:'utf8'}));
  writeFileSync('evidence/render.json',JSON.stringify({elapsedSeconds:(performance.now()-started)/1000,buildSeconds,consoleMessages,chromium:browser.version(),executablePath:executablePath||chromium.executablePath(),timeline,magicMove:{beforeText,afterText,during:moving},trimStart,errors,probe},null,2)+'\n');
  if(errors.length) throw Error(`Browser errors: ${errors.join('; ')}`);
  console.log(`Recorded ${probe.format.duration}s MP4, ${probe.format.size} bytes; ${(performance.now()-started)/1000}s wall time`);
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
  writeFileSync('evidence/slidev.log',log.join(''));
}
