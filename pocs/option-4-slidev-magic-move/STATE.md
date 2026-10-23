# Option 4 state

Goal: execute `/root/c4v-poc4.md`; six-slide Slidev + Shiki Magic Move POC. Story and exact references: [storyboard.md](storyboard.md).

Status: source-backed deck built and all six slides visually inspected; final video recording is running.

Done: five source ranges and diagram bytes verified; deck, reproducible extractor and recorder built; all six 720p slide screenshots inspected without clipping. Shared Chromium cache restored after Playwright helper installation; future installs must disable cache GC.

In progress: final timed capture and MP4 encoding. Raw recorder evidence appears in `evidence/render.json` when complete.

Next: inspect extracted MP4 frames and animation evidence; independent cross-family review in an isolated review worktree; finalize NOTES.md; commit artifacts and reusable findings.

Blockers: none. Voice intentionally stubbed. The fault-injection lab is not executed. A caught upstream FloatingVue patch error is documented in NOTES.md.

Resume: branch `poc/option-4`, supplied `/root/Software/c4video-work/option-4` worktree; work only inside this POC. Check `ps -eo pid,etime,args` for `node scripts/record.mjs`; do not start another recorder on port 4314. If dead, `npm run record` from this directory. See NOTES.md for prerequisites. Current checkpoints are in git history.
