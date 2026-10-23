# Evidence interpretation

`commands.json` is the builder's manually recorded exit-code summary, not a tool-generated command ledger. Actual output is retained in the capture, test, VHS, render and verification logs. `book-notes-before.txt` was produced by `git -C /root/Software/book-notes status --porcelain`; its zero-byte content means the checkout was clean before work. It remained clean at handoff.

`vhs.log` is raw output from the successful second capture. It contains a warning that its timeout directive was placed too late; that run used the default 15-second wait and visibly passed. The delivered `demo.tape` moves `Set WaitTimeout 60s` before the first command (`Hide`), so future runs get the intended timeout. That placement correction does not change the recorded terminal test output.

`review.json` preserves the independent review's result and machine-readable completion metadata. Its full verbose transcript (including embedded image payloads) is retained locally in ignored `.work/review-transcript.json`; the checked-in result excludes that redundant payload. `review-stderr.log` is empty because the review process produced no stderr. Usage gauge captures are observations before review dispatch; Muse's subscription gauge was unavailable.
