import {execFileSync} from 'node:child_process';
import {writeFileSync, readFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const repo = process.env.SOURCE_REPO || '/root/Software/book-notes';
const pinned={'release-it/v0-flawed':'6076a82a59355b4ed7afbc5d29d3bbc12da6a944','release-it/v1-hardened':'936786399d7bab3ebbfa845b9a07df02b41ed363'};
const base = 'books/release-it/project/';
const definitions = [
  ['flawed', 'release-it/v0-flawed', 'internal/nodeclient/client.go', 'New', 24, 26],
  ['wiring', 'release-it/v1-hardened', 'cmd/gateway/main.go', 'main (excerpt)', 27, 31],
  ['hardened', 'release-it/v1-hardened', 'internal/nodeclient/client.go', 'New', 36, 42],
  ['transport', 'release-it/v1-hardened', 'internal/httpx/client.go', 'NewClient (excerpt)', 19, 26],
  ['checks', 'release-it/v1-hardened', 'lab/verify/02-timeouts.sh', 'top-level assertions (excerpt)', 75, 78],
];
mkdirSync('sources', {recursive:true});
const manifest = definitions.map(([id, ref, suffix, symbol, start, end]) => {
  const commit = execFileSync('git', ['-C', repo, 'rev-parse', ref], {encoding:'utf8'}).trim();
  if(commit!==pinned[ref]) throw Error(`Source tag drift: ${ref} resolved to ${commit}`);
  const path = base + suffix;
  const content = execFileSync('git', ['-C', repo, 'show', `${commit}:${path}`], {encoding:'utf8'});
  const code = content.split('\n').slice(start-1,end).join('\n')+'\n';
  writeFileSync(`sources/${id}.txt`, code);
  return {id, ref, commit, path, symbol, start, end, sha256:createHash('sha256').update(code).digest('hex'), code};
});
writeFileSync('sources/manifest.json', JSON.stringify(manifest,null,2)+'\n');
const deck = readFileSync('slides.template.md','utf8').replace(/@@(\w+)@@/g, (_,id) => {
  const item=manifest.find(x=>x.id===id);
  if(!item) throw Error(`Unknown source ${id}`);
  return item.code.trimEnd();
});
writeFileSync('slides.md',deck);
console.log(`Verified ${manifest.length} exact git ranges and generated slides.md`);
