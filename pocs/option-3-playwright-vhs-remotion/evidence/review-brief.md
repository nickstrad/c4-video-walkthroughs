Fresh independent cross-family review of Option 3 POC built by Codex.
Use Opus, high effort. Read-only review: do not change tracked files, commit, push, merge, publish, delegate, or modify book-notes. This is an independent review unit, not a new builder/planner. You are in your own detached git worktree. Node dependencies may be symlinked from the builder's checkout. No API key or paid-tier changes.

Scope: pocs/option-3-playwright-vhs-remotion/ only. Read its STATE.md and NOTES.md first, then /root/c4v-poc3.md and ../../overview.md for acceptance criteria. All work and output must remain under this POC directory. Source read access: /root/Software/book-notes at tag release-it/v1-hardened. Do not alter it. No need to inspect other POCs or the VM environment. You may run project verification (writes evidence only in your own worktree) and read real pinned git objects. Do not redo long rendering or install tools.

Check:
- Real pinned source, function and line references, dataset element/view IDs; honest claims about what unit tests prove.
- Real Playwright workflow and VHS tape plus recordings, evidence, local-only catalog adaptation, no fabricated results.
- Remotion composition and output: 15–40 sec, 720p, H.264, <10 MB, concurrency=2 evidenced.
- Inspect the three final PNG frames using Read's image capability; assess text legibility, clipping, overlaps and scene content.
- Reproducible scripts/notes, narration stub, retained measured timing and sizes, source immutability and scope.
Run node scripts/verify.mjs from the POC root if practical; verification writes local evidence only. Check raw capture late-frame evidence too. Full code rendering is unnecessary.

Return PASS / NITS / FAIL and concise findings with file/line references and checks performed. Distinguish blockers from optional improvements. Do not fix anything. The parent will commit review findings and clean up this worktree.
