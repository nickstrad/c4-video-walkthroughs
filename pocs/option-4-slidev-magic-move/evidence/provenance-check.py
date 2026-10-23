# One-off independent check; run from the POC directory with Python 3.
import json, hashlib, subprocess, os
from pathlib import Path
entries = json.loads(Path('sources/manifest.json').read_text())
for entry in entries:
    text = subprocess.check_output(['git','-C',os.environ.get('SOURCE_REPO','/root/Software/book-notes'),'show',entry['commit']+':'+entry['path']],text=True)
    snippet = '\n'.join(text.splitlines()[entry['start']-1:entry['end']])+'\n'
    assert snippet == entry['code'] == Path('sources/'+entry['id']+'.txt').read_text()
    assert hashlib.sha256(snippet.encode()).hexdigest() == entry['sha256']
    assert snippet.rstrip() in Path('slides.md').read_text()
print(f'PASS: all {len(entries)} manifest ranges match git, local excerpts, hashes, and deck')
original=Path('/root/Software/book-notes/docs/diagram-site/evidence/item-2/screenshots/litefleet-gateway-components-1600-canvas.png')
assert original.read_bytes()==Path('public/c4-gateway.png').read_bytes()
print('PASS: architecture PNG is byte-identical to diagram-site evidence')
