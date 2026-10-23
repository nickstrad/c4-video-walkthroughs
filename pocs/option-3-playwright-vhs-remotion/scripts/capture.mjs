import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
// Record the real diagrams site: drill from the catalog to the gateway's breaker, inspect it,
// and zoom the live canvas onto it. Every click/zoom is logged so the composition can mark it.
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:'.work/browser',size:{width:1280,height:720}},reducedMotion:'reduce'});
const t0=Date.now();
const page=await context.newPage();
const errors=[],actions=[];page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.locator('[data-layout-ready]').waitFor();
const pause=ms=>page.waitForTimeout(ms);
const log=(kind,label,box)=>actions.push({t:(Date.now()-t0)/1000,kind,label,x:box?Math.round(box.x+box.width/2):null,y:box?Math.round(box.y+box.height/2):null});
const click=async(locator,label)=>{const box=await locator.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:6});log('click',label,box);await locator.click();};
const canvas=page.locator('[data-layout-ready]');
const frame=async()=>{await ready();await canvas.scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Fit View',exact:true}).click();await pause(250);};
await page.goto('http://127.0.0.1:4333/book-notes/');await frame();log('ready','Catalog opens on Litefleet: system context');await pause(1100);
await click(page.getByRole('link',{name:'Open detail for Litefleet',exact:true}),'Open Litefleet');await frame();log('ready','Litefleet: containers');await pause(1000);
await click(page.getByRole('link',{name:'Open detail for Gateway',exact:true}),'Open Gateway');await frame();log('ready','Litefleet: gateway components');await pause(900);
await click(page.getByRole('button',{name:'Inspect Control circuit breaker',exact:true}),'Inspect Control circuit breaker');await pause(1000);
// Zoom the real canvas (ctrl+wheel) at a point right of the breaker, so route client → breaker → control plane stay in view.
const node=page.locator('[data-id="node:gw-breaker"]');let b=await node.boundingBox();
const zoomAt={x:b.x+b.width*0.9,y:b.y+b.height/2};
await page.mouse.move(zoomAt.x,zoomAt.y,{steps:6});log('zoom','Zoom onto the breaker',{x:zoomAt.x,y:zoomAt.y,width:0,height:0});
await page.keyboard.down('Control');for(let i=0;i<12;i++){await page.mouse.wheel(0,-50);await pause(70);}await page.keyboard.up('Control');
await pause(1800);log('end','Hold');
await page.screenshot({path:'evidence/browser-final.png'});
b=await node.boundingBox();
const heading=await page.getByRole('heading',{level:1}).textContent();
const inspector=await page.getByRole('heading',{name:'Control circuit breaker',exact:true}).count();
const sources=await page.getByText('936786399d7bab3ebbfa845b9a07df02b41ed363'.slice(0,30)).count();
if(!page.url().endsWith('/gateway-components/elements/gw-breaker')||!heading.includes('gateway components')||!inspector||!sources||errors.length)throw Error(JSON.stringify({heading,inspector,sources,errors,url:page.url()}));
await pause(300);
const video=page.video();await context.close();await video.saveAs('public/browser.webm');await browser.close();
writeFileSync('public/browser-actions.json',JSON.stringify(actions,null,2)+'\n');
writeFileSync('evidence/browser.json',JSON.stringify({heading,inspectorHeading:'Control circuit breaker',pinnedRevisionShownInSources:true,breakerBoxAfterZoom:b,errors,url:page.url(),viewport:'1280x720',workflow:['open catalog (Litefleet is the site default)','Fit View at each level','open Litefleet containers','open gateway components','Inspect Control circuit breaker','ctrl+wheel zoom on the live canvas'],mockedRequests:false,actionLog:'public/browser-actions.json (seconds since context creation; approximates video time)'},null,2)+'\n');
