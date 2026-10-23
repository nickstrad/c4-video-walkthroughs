import React from 'react';
import {AbsoluteFill,Composition,Sequence,Img,OffthreadVideo,staticFile,useCurrentFrame,interpolate,registerRoot} from 'remotion';
import code from '../public/code.json';
import storyboard from '../storyboard.json';
const ink='#e8eef9',muted='#9aabc5',accent='#65e4cd';
const page:React.CSSProperties={background:'#0b1220',color:ink,fontFamily:'Arial, sans-serif'};
const Label=({children}:{children:React.ReactNode})=><div style={{color:accent,fontSize:17,letterSpacing:3,fontWeight:700,textTransform:'uppercase'}}>{children}</div>;
const Scene=({label,title,caption,children}:{label:string,title:string,caption:string,children:React.ReactNode})=>{
 const f=useCurrentFrame();return <AbsoluteFill style={{...page,padding:'30px 40px',opacity:interpolate(f,[0,8],[0,1],{extrapolateRight:'clamp'})}}>
 <Label>{label}</Label><h1 style={{fontSize:34,margin:'10px 0 20px',letterSpacing:-1}}>{title}</h1>{children}
 <div style={{position:'absolute',bottom:30,left:40,right:40,borderTop:'1px solid #30415b',paddingTop:14,fontSize:22,lineHeight:1.35}}>{caption}</div>
 <div style={{position:'absolute',top:32,right:40,color:muted,fontSize:14}}>LITEFLEET / 9367863 · CAPTIONS ONLY</div>
 </AbsoluteFill>;
};
function Film(){const f=useCurrentFrame();return <AbsoluteFill style={page}>
 <Sequence from={0} durationInFrames={120}><Scene label="01 / architecture" title="Stop a failing dependency from taking more calls" caption="The gateway’s control circuit breaker guards calls to the control plane.">
 <div style={{display:'flex',gap:24,height:445}}><div style={{width:900,borderRadius:14,overflow:'hidden',background:'#f7fafc'}}><Img src={staticFile('diagram.png')} style={{width:'100%',height:'100%',objectFit:'contain'}}/></div>
 <div style={{width:270,padding:'38px 10px',fontSize:25,lineHeight:1.5}}><div style={{color:accent}}>Gateway</div><div>↓</div><strong>Control circuit breaker</strong><div>↓</div><div style={{color:muted}}>Control plane</div></div></div>
 </Scene></Sequence>
 <Sequence from={120} durationInFrames={360}><Scene label="02 / real browser" title="Find the component in the running C4 catalog" caption="Select Litefleet → containers → gateway components. This is the real diagrams site.">
 <OffthreadVideo muted src={staticFile('browser.mp4')} playbackRate={storyboard.browserPlaybackRate} style={{width:1200,height:490,objectFit:'contain',background:'#fff',borderRadius:12}}/>
 </Scene></Sequence>
 <Sequence from={480} durationInFrames={210}><Scene label="03 / pinned source" title="An open circuit returns before calling the dependency" caption="Call checks admission first. A rejection increments a metric and returns ErrOpen.">
 <div style={{background:'#152238',borderRadius:16,padding:26,height:440}}>
 <div style={{fontFamily:'monospace',fontSize:18,color:muted,marginBottom:20}}>internal/breaker/breaker.go : {code.start}–{code.end} · (*Breaker).Call</div>
 {code.lines.map((line,i)=><div key={i} style={{fontFamily:'monospace',whiteSpace:'pre',fontSize:22,lineHeight:'34px',background:i>=1&&i<=3?'#244b50':'transparent',borderLeft:i>=1&&i<=3?'4px solid #65e4cd':'4px solid transparent',paddingLeft:10}}><span style={{color:muted,marginRight:22}}>{code.start+i}</span>{line.replaceAll('\t','  ')}</div>)}
 <div style={{color:accent,fontSize:23,marginTop:18}}>↑ The dependency function runs only after this guard.</div>
 </div></Scene></Sequence>
 <Sequence from={690} durationInFrames={270}><Scene label="04 / real terminal" title="Run the breaker’s own tests at the pinned commit" caption="Five failures → reject without calling. Recovery and non-counting errors are tested too.">
 <OffthreadVideo muted src={staticFile('terminal.mp4')} style={{width:1200,height:480,objectFit:'contain',borderRadius:12}}/>
 </Scene></Sequence>
 <div style={{position:'absolute',bottom:0,left:0,height:4,width:`${f/959*100}%`,background:accent}}/>
 </AbsoluteFill>}
registerRoot(()=> <Composition id="Litefleet" component={Film} durationInFrames={960} fps={30} width={1280} height={720}/>);
