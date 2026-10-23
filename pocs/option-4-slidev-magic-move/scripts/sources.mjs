import {execFileSync} from 'node:child_process';
import {writeFileSync, readFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const repo = process.env.SOURCE_REPO || '/root/Software/book-notes';
const pinned={
  'release-it/v0-flawed':'6076a82a59355b4ed7afbc5d29d3bbc12da6a944',
  'release-it/lesson-02':'8e716278b152a31e0f0d4a81b3d20a8ff6091467',
  'release-it/v1-hardened':'936786399d7bab3ebbfa845b9a07df02b41ed363',
};
const base = 'books/release-it/';
const definitions = [
  ['wiring', 'release-it/v1-hardened', 'project/cmd/gateway/main.go', 'main', 27, 31],
  ['flawed', 'release-it/v0-flawed', 'project/internal/nodeclient/client.go', 'New', 24, 26],
  ['deadlines', 'release-it/lesson-02', 'project/internal/nodeclient/client.go', 'New', 26, 28],
  ['hardened', 'release-it/v1-hardened', 'project/internal/nodeclient/client.go', 'New', 36, 42],
  ['before', 'release-it/v1-hardened', 'lessons/02-timeouts.md', 'recorded before (lesson-01)', 101, 104],
  ['after', 'release-it/v1-hardened', 'lessons/02-timeouts.md', 'recorded after (lesson-02)', 113, 117],
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
  if(id.startsWith('cite_')) {
    const entry=manifest.find(x=>x.id===id.slice(5));
    if(!entry) throw Error(`Unknown citation ${id}`);
    return `${entry.ref.slice('release-it/'.length)} · ${entry.commit.slice(0,7)} · ${entry.path.slice(base.length)}:${entry.start}–${entry.end} · ${entry.symbol}`;
  }
  const item=manifest.find(x=>x.id===id);
  if(!item) throw Error(`Unknown source ${id}`);
  return item.code.trimEnd();
});
writeFileSync('slides.md',deck);
console.log(`Verified ${manifest.length} exact git ranges and generated slides.md`);
