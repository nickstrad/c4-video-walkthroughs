# Evidence interpretation

`commands.json` is the latest builder's manually recorded exit-code summary, not a tool-generated command ledger. Actual output is retained in the capture, test, VHS, render and verification logs. `book-notes-before.txt` was produced by `git -C /root/Software/book-notes status --porcelain`; its zero-byte content means the checkout was clean before work. It remained clean at handoff.

`vhs.log` is raw output from the Opus improvement pass's VHS take (`demo.tape` as committed). `capture.log` is empty because the final Playwright capture printed nothing. `browser-video-check.png` and `terminal-check.png` are late frames from the raw browser and VHS recordings. `book-notes-after.txt` is empty: the checkout was clean when this pass finished.

`review.json` preserves the independent review of Sol's earlier build `0b85e6f` (it does not cover the Opus improvement pass): its result and machine-readable completion metadata. Its full verbose transcript (including embedded image payloads) is retained locally in ignored `.work/review-transcript.json`; the checked-in result excludes that redundant payload. `review-stderr.log` is empty because the review process produced no stderr. Usage gauge captures are observations before review dispatch; Muse's subscription gauge was unavailable.

Narration pass: `narration.json` is written by `scripts/retime.mjs` (per-line characters, aligned end, start frame, holds). `render.log`, `render-time.txt`, `verify.log`, `verification.json` and the `frames/` stills are from the narrated render. `inspection.md` predates narration and describes the captions-only cut.
