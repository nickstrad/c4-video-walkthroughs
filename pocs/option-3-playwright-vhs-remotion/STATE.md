Goal/spec: Sol's POC brief /root/c4v-poc3.md, the Opus improvement brief /root/c4v-improve3.md, and the narration brief (voice the existing script with ElevenLabs, let the audio drive scene lengths, replace demo.mp4 in place); Option 3 in ../../overview.md.
Status: Opus narration pass complete on branch narration/option-3 (worktree /root/Software/c4video-work/narr-3). Verified and committed; not pushed or merged. No independent review of the narration pass yet.

Done:
- Sol's POC and the Opus improvement pass (claim-first three-act film) are on main.
- Narration pass (this branch's commit, "option-3: narrate the demo with ElevenLabs and time cuts from the voice"):
  - 8 lines (638 characters), voice Roger, eleven_multilingual_v2; mp3 + alignment committed in narration/;
  - scripts/retime.mjs times captions, cue-tied highlights and scene lengths from the alignment;
  - the composition plays per-line audio, and the browser scene has a 31-frame disclosed hold.
- Output: demo.mp4 45.67 s, 1,370 frames, 1280x720, 30 fps, H.264 + AAC (45.70 s), 5,163,807 bytes. Render 405.31 s at --concurrency=2.
- Verification passes (evidence/verification.json): the rebuild's checks plus narration text/alignment match, line spacing and tails, audio stream and duration, per-line loudness, silent pauses, full decode of both streams.

In progress: nothing. No background jobs.
Next steps (owner: Nick): listen to the narration (identifier pronunciation is unchecked by ear), decide on a cross-family review, merge narration/option-3.
Open decisions/blockers: none.

Resume/reproduce: follow NOTES.md "Reproduce" from this directory with nvm Node 22 on PATH. Do not re-run narrate.mjs for existing lines (it skips them; deleting narration/ files would spend credits). Rerender after changing storyboard.json, narration/ or src/; run `npm run retime` first if any narration file changed.
