Goal/spec: Sol's POC brief /root/c4v-poc3.md and the Opus improvement brief /root/c4v-improve3.md; Option 3 in ../../overview.md.
Status: Opus improvement pass complete on branch improve/option-3 (worktree /root/Software/c4video-work/improve-3). Verified, committed; not pushed or merged. No independent cross-family review of this pass yet.

Done:
- Sol's POC (0b85e6f, 708fe32, review handoff) merged on main via f4f1d25.
- Opus improvement pass (this branch's commit, "option-3: rebuild demo as claim-first three-act film"):
  - redesigned the film as title card → where (real site, cut to actions, live zoom on gw-breaker) → how (client.go 112–119, breaker.go 84–92) → proof (breaker_test.go 13–22, VHS go test) → end card;
  - made the composition storyboard-driven;
  - new Playwright and VHS captures.
- Output: demo.mp4 31.40 s, 942 frames, 1280x720, 30 fps, 2,292,596 bytes, no audio. Render 185.33 s at --concurrency=2.
- Verification passes (evidence/verification.json): byte-identical excerpts, C4 IDs, timeline continuity, 1x terminal, format, size and whole-file decode. Five frames were extracted from the render and inspected (evidence/inspection.md). Four real breaker tests pass.

In progress: nothing. No background jobs; the local site server is stopped.
Next steps (owner: Nick): decide whether to review this pass cross-family and merge improve/option-3 into main.
Open decisions/blockers: none.

Resume/reproduce: follow NOTES.md "Reproduce" from this directory with nvm Node 22 on PATH. Scratch (.work/: site copy, pinned export, VHS binary, stills) is ignored and regenerable. Rerender only after changing storyboard.json, src/ or a capture. If you re-record VHS, re-check proof-terminal.highlight.
