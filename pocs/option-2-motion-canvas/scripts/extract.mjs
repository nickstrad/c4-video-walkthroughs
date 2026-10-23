// Asset stage: pull each storyboard snippet from git at the pinned commit
// and verify the blob, so the scene never contains hand-typed code.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

const board = JSON.parse(readFileSync(new URL('../storyboard/query-flow.storyboard.json', import.meta.url)));
const git = (...args) => execFileSync('git', ['-C', board.code.repo, ...args], {encoding: 'utf8'});

const resolved = git('rev-parse', `${board.code.tag}^{commit}`).trim();
if (resolved !== board.code.commit) throw new Error(`${board.code.tag} is ${resolved}, storyboard pins ${board.code.commit}`);

const out = {commit: board.code.commit, snippets: {}};
for (const s of board.snippets) {
  const blob = git('rev-parse', `${board.code.commit}:${s.file}`).trim();
  if (blob !== s.blob) throw new Error(`${s.file}: blob ${blob}, storyboard pins ${s.blob}`);
  const all = git('show', `${board.code.commit}:${s.file}`).split('\n');
  const [from, to] = s.lines;
  const text = all.slice(from - 1, to).map(l => l.replace(/\t/g, '    ')).join('\n');
  if (s.function && !all.slice(0, to).join('\n').includes(s.function)) throw new Error(`${s.function} not found in ${s.file}`);
  out.snippets[s.id] = {...s, text};
}
writeFileSync(new URL('../src/snippets.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`extracted ${Object.keys(out.snippets).length} snippets at ${out.commit}`);
