Goal/spec: /root/c4v-poc3.md; Option 3 in ../../overview.md.
Status: complete; artifacts validated, independent review NITS/no blockers, review worktree cleaned. No push or merge.

Done:
- 0b85e6f: storyboard, real Playwright/VHS recordings, exact pinned code, Remotion composition and final MP4, three inspected frames, reproduction and evidence. Source: release-it/v1-hardened = 936786399d7bab3ebbfa845b9a07df02b41ed363.
- 708fe32: separate durable project knowledge and indexed reusable scripts.
- Final review/handoff commit: Claude Opus 5.5 independent review result and dispositions, caption consistency check, evidence labels and this state. Review inspected 0b85e6f; later changes are documentation/metadata/checks, with composition/video unchanged.
- Output: demo.mp4, exactly 32 s, 1280x720, 30 fps, 960 frames, 1,617,487 bytes, H.264. Render took 468.42 s at concurrency 2. No audio/narration track.
- Four real pinned breaker tests pass; Playwright route/page-error assertions pass; exact source mapping, C4 IDs, caption consistency, complete video decode, media properties, size and hashes pass. Final frames visually inspected. See evidence/verification.json and evidence/inspection.md.
- Book-notes stayed clean (before/after git-status captures). Local capture server and review process stopped; fresh review worktree removed. No other project's worktree was changed.

In progress: nothing.
Next steps: none for this POC. Full-build requirements and limitations are in NOTES.md.
Open decisions/blockers: none for the requested proof. Future owner: source-pin a rebuilt site bundle, implement focus/zoom and syntax-aware storyboard generation, add narration and isolated live-outage demonstrations.

Resume/reproduce: branch poc/option-3 at /root/Software/c4video-work/option-3. Run commands from this POC directory as documented in NOTES.md. There is no background job to resume or relaunch. Scratch exports, dependencies and verbose review transcript are ignored under .work/ and node_modules/; tracked artifacts are self-contained. Final measured source/video checks are in scripts/verify.mjs; rerender only for a new composition/capture.
