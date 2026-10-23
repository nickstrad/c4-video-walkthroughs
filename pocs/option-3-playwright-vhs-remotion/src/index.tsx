import React from 'react';
import {AbsoluteFill,Composition,Sequence,OffthreadVideo,Audio,Freeze,staticFile,useCurrentFrame,interpolate,Easing,registerRoot} from 'remotion';
import code from '../public/code.json';
import actions from '../public/browser-actions.json';
import storyboard from '../storyboard.json';
// Every scene, caption, cut and highlight below is read from storyboard.json; nothing is timed here.
type Caption={at:number,text:string,audio:string,audioFrames:number,lowerThird?:boolean};
type Step={at:number,lines:number[],note:string,skipped?:boolean};
type Scene={id:string,kind:string,from:number,duration:number,act?:string,captions:Caption[],[k:string]:any};
const sb=storyboard as unknown as {fps:number,width:number,height:number,durationFrames:number,commit:string,acts:Record<string,string>,scenes:Scene[]};
const scenes=sb.scenes;
const ink='#eef3fb',muted='#9fb0c8',accent='#65e4cd',amber='#ffb454',bg='#0b1220',panel='#121d31';
const sans='"DejaVu Sans", Arial, sans-serif',mono='"DejaVu Sans Mono", monospace';
const SAFE_X=64,SAFE_BOTTOM=36;
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const fade=(f:number,len:number,edge=8)=>interpolate(f,[0,edge,len-edge,len],[0,1,1,0],clamp);
const rise=(f:number,at:number)=>({opacity:interpolate(f,[at,at+8],[0,1],clamp),transform:`translateY(${interpolate(f,[at,at+8],[14,0],{...clamp,easing:Easing.out(Easing.cubic)})}px)`});
const short=sb.commit.slice(0,7);

// Lower third: act name, act progress and the caption of the line being spoken. Persistent across scenes of one act.
const actOrder=Object.keys(sb.acts);
function LowerThird(){
 const f=useCurrentFrame();
 const scene=scenes.find(s=>f>=s.from&&f<s.from+s.duration);
 if(!scene?.act)return null;
 const same=scenes.filter(s=>s.act===scene.act),start=same[0].from,end=same[same.length-1].from+same[same.length-1].duration;
 const local=f-scene.from,caption=[...scene.captions].reverse().find(c=>c.at<=local);
 return <div style={{position:'absolute',left:SAFE_X,right:SAFE_X,bottom:SAFE_BOTTOM,opacity:fade(f-start,end-start),background:'rgba(7,12,22,0.9)',borderLeft:`6px solid ${accent}`,borderRadius:10,padding:'12px 24px 14px',boxShadow:'0 8px 30px rgba(0,0,0,0.35)'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:sans,fontSize:15,letterSpacing:2.5,fontWeight:700,textTransform:'uppercase'}}>
   <span style={{color:accent}}>{sb.acts[scene.act]}</span>
   <span style={{display:'flex',gap:18}}>{actOrder.map((a,i)=><span key={a} style={{color:a===scene.act?accent:'#4b5d78'}}>{i+1} {a}</span>)}</span>
  </div>
  {caption&&<div key={caption.text} style={{fontFamily:sans,fontSize:28,lineHeight:1.3,fontWeight:600,color:ink,marginTop:6,opacity:interpolate(local-caption.at,[0,6],[0,1],clamp)}}>{caption.text}</div>}
 </div>;
}

function TitleCard({scene}:{scene:Scene}){
 const f=useCurrentFrame();
 return <AbsoluteFill style={{padding:`80px ${SAFE_X+16}px`,opacity:interpolate(f,[scene.duration-8,scene.duration],[1,0],clamp),fontFamily:sans}}>
  <div style={{...rise(f,0),color:accent,fontSize:18,letterSpacing:3,fontWeight:700}}>LITEFLEET · RELEASE IT! v1-HARDENED · COMMIT {short}</div>
  <div style={{...rise(f,2),color:ink,fontSize:54,lineHeight:1.15,fontWeight:700,margin:'22px 0 40px',maxWidth:1050,letterSpacing:-0.5}}>{scene.headline}</div>
  <div style={{...rise(f,10),color:muted,fontSize:22,marginBottom:18}}>The proof, in three acts:</div>
  <div style={{display:'flex',gap:20}}>{scene.steps.map((s:string,i:number)=><div key={s} style={{...rise(f,14+i*5),flex:1,background:panel,borderTop:`4px solid ${accent}`,borderRadius:10,padding:'18px 20px'}}>
   <div style={{color:accent,fontSize:16,fontWeight:700,letterSpacing:2}}>{i+1} · {actOrder[i].toUpperCase()}</div>
   <div style={{color:ink,fontSize:25,marginTop:8,fontWeight:600}}>{s}</div></div>)}</div>
 </AbsoluteFill>;
}

function EndCard({scene}:{scene:Scene}){
 const f=useCurrentFrame();
 return <AbsoluteFill style={{padding:`86px ${SAFE_X+16}px`,opacity:interpolate(f,[0,8],[0,1],clamp),fontFamily:sans}}>
  <div style={{color:accent,fontSize:18,letterSpacing:3,fontWeight:700}}>DEMONSTRATED</div>
  <div style={{color:ink,fontSize:46,fontWeight:700,margin:'14px 0 34px'}}>Litefleet · gateway control circuit breaker</div>
  {scene.checks.map((c:string,i:number)=><div key={c} style={{...rise(f,6+i*6),display:'flex',gap:18,alignItems:'center',fontSize:30,color:ink,marginBottom:18}}>
   <span style={{color:bg,background:accent,borderRadius:20,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:24}}>✓</span>{c}</div>)}
  <div style={{...rise(f,26),position:'absolute',left:SAFE_X+16,right:SAFE_X+16,bottom:SAFE_BOTTOM+20,borderTop:'1px solid #2a3a55',paddingTop:16,color:muted,fontSize:19,lineHeight:1.5}}>
   {scene.caveat}<br/>Built with Playwright · VHS · Remotion — book-notes {storyboard.tag}.</div>
 </AbsoluteFill>;
}

// Real browser footage cut to its action windows (1x), with click/zoom markers from the capture's action log.
// If the narration outlasts the footage, the last real frame is held for scene.holdFrames.
type Action={t:number,kind:string,label:string,x:number|null,y:number|null};
function Browser({scene}:{scene:Scene}){
 const f=useCurrentFrame(),segs:[number,number][]=scene.segments;
 const starts=segs.reduce<number[]>((a,[s,e],i)=>[...a,i?a[i-1]+segs[i-1][1]-segs[i-1][0]:0],[]);
 // Map a source frame to scene time; a click that triggers navigation sits just past its segment end.
 const toScene=(src:number)=>{for(let i=0;i<segs.length;i++){const [s,e]=segs[i];if(src>=s&&src<=e+6)return starts[i]+Math.min(src,e)-s;}return null;};
 const marks=(actions as Action[]).filter(a=>a.x!==null&&(a.kind==='click'||a.kind==='zoom')).map(a=>({...a,at:toScene(Math.round(a.t*sb.fps)-1)})).filter(a=>a.at!==null) as (Action&{at:number})[];
 const zoom=marks.find(m=>m.kind===scene.pushIn.afterAction);
 const push=zoom?interpolate(f,[zoom.at+scene.pushIn.delayFrames,zoom.at+scene.pushIn.delayFrames+40],[1,scene.pushIn.scale],{...clamp,easing:Easing.inOut(Easing.cubic)}):1;
 return <AbsoluteFill style={{background:'#fff',opacity:fade(f,scene.duration)}}>
  <AbsoluteFill style={{transform:`scale(${push})`,transformOrigin:`${scene.pushIn.originX*100}% ${scene.pushIn.originY*100}%`}}>
   {segs.map(([s,e],i)=>{const last=i===segs.length-1,hold=last?scene.holdFrames??0:0;return <Sequence key={i} from={starts[i]} durationInFrames={e-s+hold}><Freeze frame={e-s-1} active={hold>0&&f-starts[i]>=e-s}><OffthreadVideo muted src={staticFile(scene.asset.replace('public/',''))} trimBefore={s} trimAfter={e} style={{width:sb.width,height:sb.height}}/></Freeze></Sequence>;})}
   {marks.map(m=>{const lead=m.kind==='click'?14:10,d=f-(m.at-lead);if(d<0||d>lead+24)return null;
    const ring=interpolate(d,[lead-2,lead+14],[0.3,1.6],clamp),ringO=interpolate(d,[lead-2,lead+18],[0.9,0],clamp),o=interpolate(d,[0,5,lead+16,lead+24],[0,1,1,0],clamp);
    return <div key={m.label} style={{position:'absolute',left:m.x!,top:m.y!,opacity:o}}>
     <div style={{position:'absolute',left:-28,top:-28,width:56,height:56,borderRadius:28,border:`4px solid ${amber}`,transform:`scale(${ring})`,opacity:ringO}}/>
     <div style={{position:'absolute',left:-9,top:-9,width:18,height:18,borderRadius:9,background:amber,boxShadow:'0 0 0 3px rgba(0,0,0,0.35)'}}/>
     <div style={{position:'absolute',left:22,top:14,whiteSpace:'nowrap',background:'#111a2b',color:ink,fontFamily:sans,fontSize:20,fontWeight:600,padding:'6px 12px',borderRadius:8,border:`2px solid ${amber}`}}>{m.kind==='zoom'?'Ctrl + scroll: zoom the live canvas':`Click: ${m.label}`}</div>
    </div>;})}
  </AbsoluteFill>
 </AbsoluteFill>;
}

// Exact pinned excerpt; tabs are kept and rendered with tab-size, so the text on screen is the bytes in git.
type Excerpt={id:string,path:string,symbol:string,start:number,end:number,lines:string[]};
function Code({scene}:{scene:Scene}){
 const f=useCurrentFrame(),ex=(code.excerpts as Excerpt[]).find(x=>x.id===scene.source)!;
 const steps:Step[]=scene.steps,step=[...steps].reverse().find(s=>s.at<=f)!;
 const widest=Math.max(...ex.lines.map(l=>l.replace(/\t/g,'    ').length+4));
 const size=Math.min(25,Math.floor(1060/(widest*0.602))),lh=Math.round(size*1.55);
 return <AbsoluteFill style={{background:bg,padding:`44px ${SAFE_X}px`,fontFamily:sans,opacity:fade(f,scene.duration)}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',color:muted,fontSize:19,marginBottom:14}}>
   <span><span style={{color:ink,fontFamily:mono}}>{ex.path.replace('books/release-it/project/','')}</span> · lines {ex.start}–{ex.end} · {ex.symbol}</span>
   <span style={{fontFamily:mono,color:accent,border:`1px solid ${accent}`,borderRadius:6,padding:'2px 10px'}}>@ {short}</span>
  </div>
  <div style={{background:panel,borderRadius:14,padding:'20px 0',boxShadow:'inset 0 0 0 1px #24334d'}}>
   {ex.lines.map((line,i)=>{const n=ex.start+i,on=step.lines.includes(n),skip=on&&step.skipped,col=skip?amber:accent;
    return <div key={n} style={{display:'flex',fontFamily:mono,fontSize:size,lineHeight:`${lh}px`,whiteSpace:'pre',tabSize:4,background:on?(skip?'rgba(255,180,84,0.12)':'rgba(101,228,205,0.16)'):'transparent',borderLeft:`5px solid ${on?col:'transparent'}`,color:on?ink:(step.lines.length?'#8796ad':ink),transition:'none'}}>
     <span style={{width:64,textAlign:'right',paddingRight:20,color:on?col:'#56688a',flex:'none'}}>{n}</span><span style={{textDecoration:skip?`line-through ${amber}`:'none'}}>{line}</span></div>;})}
  </div>
  <div key={step.note} style={{...rise(f,step.at),marginTop:18,fontSize:27,fontWeight:600,color:step.skipped?amber:accent}}>→ {step.note}</div>
 </AbsoluteFill>;
}

function Terminal({scene}:{scene:Scene}){
 const f=useCurrentFrame(),h=scene.highlight,[x,y,w,hh]=h.box;
 const o=interpolate(f,[h.at,h.at+8],[0,1],clamp);
 return <AbsoluteFill style={{background:bg,padding:`44px ${SAFE_X}px`,fontFamily:sans,opacity:fade(f,scene.duration)}}>
  <div style={{borderRadius:12,overflow:'hidden',boxShadow:'0 0 0 1px #2c3a52, 0 16px 40px rgba(0,0,0,0.4)',width:1152,position:'relative'}}>
   <div style={{height:34,background:'#2b2d3a',display:'flex',alignItems:'center',gap:8,padding:'0 14px',color:'#b9bfd3',fontSize:16}}>
    {['#ff5f57','#febc2e','#28c840'].map(c=><span key={c} style={{width:12,height:12,borderRadius:6,background:c}}/>)}
    <span style={{marginLeft:14,fontFamily:mono}}>VHS · pinned export of {short} · unmodified tests</span></div>
   <div style={{position:'relative',height:500}}>
    <Freeze frame={scene.duration-(scene.holdFrames??0)-1} active={f>=scene.duration-(scene.holdFrames??0)}><OffthreadVideo muted src={staticFile(scene.asset.replace('public/',''))} style={{width:1152,height:500,display:'block'}}/></Freeze>
    <div style={{position:'absolute',left:x,top:y,width:w,height:hh,border:`3px solid ${accent}`,borderRadius:6,background:'rgba(101,228,205,0.10)',opacity:o}}/>
    <div style={{position:'absolute',left:x+w+14,top:y-2,...rise(f,h.at+4),background:accent,color:bg,fontWeight:700,fontSize:19,padding:'6px 12px',borderRadius:8}}>← the claim, passing</div>
   </div>
  </div>
 </AbsoluteFill>;
}

const views:Record<string,React.FC<{scene:Scene}>>={'title-card':TitleCard,'end-card':EndCard,playwright:Browser,code:Code,vhs:Terminal};
function Film(){
 const f=useCurrentFrame();
 return <AbsoluteFill style={{background:bg}}>
  {scenes.map(s=>{const View=views[s.kind];return <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}><View scene={s}/></Sequence>;})}
  {/* Narration: each line's ElevenLabs audio starts at its caption, so caption and voice share one clock. */}
  {scenes.flatMap(s=>s.captions.map(c=><Sequence key={c.audio} from={s.from+c.at} durationInFrames={c.audioFrames+6} name={c.audio}><Audio src={staticFile(c.audio)}/></Sequence>))}
  <LowerThird/>
  <div style={{position:'absolute',bottom:0,left:0,height:4,width:`${f/(sb.durationFrames-1)*100}%`,background:accent}}/>
 </AbsoluteFill>;
}
registerRoot(()=> <Composition id="Litefleet" component={Film} durationInFrames={sb.durationFrames} fps={sb.fps} width={sb.width} height={sb.height}/>);
