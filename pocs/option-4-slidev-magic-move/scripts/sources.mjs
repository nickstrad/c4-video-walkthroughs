import {execFileSync} from 'node:child_process';
import {writeFileSync, readFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const repo = process.env.SOURCE_REPO || '/root/Software/book-notes';
const pinned={'release-it/v0-flawed':'6076a82a59355b4ed7afbc5d29d3bbc12da6a944','release-it/v1-hardened':'936786399d7bab3ebbfa845b9a07df02b41ed363'};
const base = 'books/release-it/project/';
const definitions = [
  ['flawed', 'release-it/v0-flawed', 'internal/nodeclient/client.go', 'New', 24, 26],
  ['wiring', 'release-it/v1-hardened', 'cmd/gateway/main.go', 'main', 27, 31],
  ['hardened', 'release-it/v1-hardened', 'internal/nodeclient/client.go', 'New', 36, 42],
  ['transport', 'release-it/v1-hardened', 'internal/httpx/client.go', 'NewClient (excerpt)', 19, 26],
  ['checks', 'release-it/v1-hardened', 'lab/verify/02-timeouts.sh', 'top-level checks', 75, 78],
];
mkdirSync('sources', {recursive:true});
const manifest = definitions.map(([id, ref, suffix, symbol, start, end]) => {
  const commit = execFileSync('git', ['-C', repo, 'rev-parse', `${ref}^{commit}`], {encoding:'utf8'}).trim();
  if(commit!==pinned[ref]) throw Error(`Source tag drift: ${ref} resolved to ${commit}`);
  const path = base + suffix;
  const content = execFileSync('git', ['-C', repo, 'show', `${commit}:${path}`], {encoding:'utf8'});
  const code = content.split('\n').slice(start-1,end).join('\n')+'\n';
  writeFileSync(`sources/${id}.txt`, code);
  return {id, ref, commit, path, symbol, start, end, sha256:createHash('sha256').update(code).digest('hex'), code};
});
writeFileSync('sources/manifest.json', JSON.stringify(manifest,null,2)+'\n');
const deck = readFileSync('slides.template.md','utf8').replace(/@@(\w+)@@/g, (_,id) => {
  if(id==='cite_evolution') {
    const before=manifest.find(x=>x.id==='flawed'), after=manifest.find(x=>x.id==='hardened');
    return `${before.symbol} · ${before.path.slice(base.length)} · ${before.commit.slice(0,7)}:${before.start}–${before.end} → ${after.commit.slice(0,7)}:${after.start}–${after.end}`;
  }
  if(id.startsWith('cite_')) {
    const entry=manifest.find(x=>x.id===id.slice(5));
    if(!entry) throw Error(`Unknown citation ${id}`);
    const version=entry.ref.includes('v0')?'v0':'v1';
    return `${version} · ${entry.commit.slice(0,7)} · ${entry.path.slice(base.length)}:${entry.start}–${entry.end} · ${entry.symbol}`;
  }
  const item=manifest.find(x=>x.id===id);
  if(!item) throw Error(`Unknown source ${id}`);
  return item.code.trimEnd();
});
writeFileSync('slides.md',deck);
console.log(`Verified ${manifest.length} exact git ranges and generated slides.md`);
