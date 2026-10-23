import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='.work/site';
function walk(path){return readdirSync(`${root}/${path}`,{withFileTypes:true}).flatMap(e=>{const p=path?`${path}/${e.name}`:e.name;return e.isDirectory()?walk(p):[{path:p,sha256:createHash('sha256').update(readFileSync(`${root}/${p}`)).digest('hex')}];});}
writeFileSync('evidence/site-manifest.json',JSON.stringify(walk(''),null,2)+'\n');
