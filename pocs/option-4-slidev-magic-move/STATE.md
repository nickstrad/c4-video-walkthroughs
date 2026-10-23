# Option 4 state

Goal/spec: Opus improvement pass per `/root/c4v-improve4.md` on Sol's Slidev + Shiki Magic Move POC, then a narration pass (real ElevenLabs voice, audio-driven timing). Story and references: [storyboard.md](storyboard.md). Reproduction, measurements, limitations and the kept/thrown-away account: [NOTES.md](NOTES.md) ("Improvement pass (Opus)", "Narration pass (Opus)").

Status: narration pass COMPLETE on branch `narration/option-4` (not pushed or merged). See NOTES.md "Narration pass (Opus)".

Done:
- Sol's original POC is on `main` (merge `3175195`).
- Improvement pass: rebuilt five-slide deck (payoff opener, C4 zoom, three-state Magic Move v0 → lesson-02 → v1 with callouts, recorded outage evidence, end card), caption band, retimed recorder with stronger checks. Recorded `demo.mp4`: 38.467 s, 1280×720, 2,104,574 bytes; seven frames regenerated from it; provenance check passes.
- Narration pass: five ElevenLabs takes (voice Roger, eleven_multilingual_v2, 2,274 characters) committed in `narration/`; recorder schedule driven by their alignment; `demo.mp4` re-rendered with an AAC track: 151.009 s, 1280×720, 6,789,314 bytes.

In progress: none. No background process is required.

Next steps, if extending: (1) independent cross-family review of this pass; (2) a deterministic frame renderer to remove up to ~0.7 s of capture-timing jitter; (3) a higher-resolution C4 subgraph render for the zoom.

Decisions/blockers: none open. Outage figures are quoted from `lessons/02-timeouts.md`, not re-run.

Resume: worktree `/root/Software/c4video-work/narr-4`, branch `narration/option-4`; stay inside `pocs/option-4-slidev-magic-move/`. `npm run sources` regenerates code and citations; `npm run narrate` reuses committed takes (calls ElevenLabs only for missing ones); `npm run record` builds, records on local port 4314, and stops its server.
