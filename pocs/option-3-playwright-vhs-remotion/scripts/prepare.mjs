import {cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const repo=process.env.BOOK_NOTES_REPO||'/root/Software/book-notes';
const sha='936786399d7bab3ebbfa845b9a07df02b41ed363';
mkdirSync('.work',{recursive:true});
// Run the real existing production bundle, without invoking writes in its checkout.
if(!existsSync(`${repo}/pages/dist/index.html`)) throw Error('Build pages in a disposable copy first; expected existing dist.');
rmSync('.work/site',{recursive:true,force:true});
cpSync(`${repo}/pages/dist`,'.work/site',{recursive:true});
const catalog=JSON.parse(readFileSync('.work/site/catalog.json'));
const dataset=readFileSync(`${repo}/pages/public/architectures/litefleet.json`);
// Current site builds list Litefleet natively; older bundles needed it appended to the scratch copy only.
const catalogAdapted=!catalog.entries.some(x=>x.id==='litefleet');
if(catalogAdapted){
 writeFileSync('.work/site/architectures/litefleet.json',dataset);
 catalog.entries.push({id:'litefleet',title:'Litefleet',url:'architectures/litefleet.json'});
 writeFileSync('.work/site/catalog.json',JSON.stringify(catalog,null,2));
}
writeFileSync('public/litefleet.json',dataset);
mkdirSync('.work/pinned',{recursive:true});
execFileSync('sh',['-c','git -C "$1" archive "$2" books/release-it/project | tar -x -C .work/pinned','prepare',repo,sha]);
// Each excerpt is cut from the pinned git object by declared inclusive line range, never retyped.
const storyboard=JSON.parse(readFileSync('storyboard.json'));
const excerpts=storyboard.sources.filter(x=>x.excerpt).map(({id,path,symbol,lines:[start,end]})=>{
 const src=execFileSync('git',['-C',repo,'show',`${sha}:${path}`],{encoding:'utf8'}).split('\n');
 return {id,path,symbol,start,end,lines:src.slice(start-1,end)};
});
writeFileSync('public/code.json',JSON.stringify({sha,excerpts},null,2)+'\n');
writeFileSync('evidence/provenance.json',JSON.stringify({sourceCommit:sha,siteBuildRebuilt:false,siteCheckoutCommitObserved:execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),siteAdaptation:catalogAdapted?'Existing production dist copied; Litefleet added to copied catalog only.':'Existing production dist copied unchanged; its catalog already lists Litefleet.',catalogAdapted,datasetInDistMatches:existsSync(`${repo}/pages/dist/architectures/litefleet.json`)&&readFileSync(`${repo}/pages/dist/architectures/litefleet.json`).equals(dataset),datasetSha256:execFileSync('sha256sum',[`${repo}/pages/public/architectures/litefleet.json`],{encoding:'utf8'}).split(' ')[0]},null,2)+'\n');
console.log('Prepared real site copy and pinned Go source:',resolve('.work/pinned/books/release-it/project'));
