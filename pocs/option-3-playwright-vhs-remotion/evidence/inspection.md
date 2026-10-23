Opus improvement pass. I inspected the five final-output PNGs in `frames/`, all extracted from `demo.mp4` at 1280x720. I also looked at contact sheets of the whole film and at frame-level checks of every browser cut point and scene transition.

- **Title** (frame at 2.4 s): the claim headline and the three act cards are fully visible by frame 10. No clipping.
- **Architecture** (end of the browser act, after the push-in): this is real site footage. The inspected Control circuit breaker node is legible, along with the route-client edge into it and the inspector. The inspector shows the breaker.go source and the full pinned revision. The lower third does not cover the node or the inspector. At each cut point (the frame before each logged click) no "Arranging diagram…" list flash appears.
- **Code** (guard, final step): all nine lines, the line numbers and the `@ 9367863` chip are visible. Line 89 is struck through in amber with the note "fn() … never runs". The client and test excerpts fit without wrapping; the test is drawn at 17 px because line 19 is long.
- **Terminal**: the command, all four RUN/PASS pairs, `PASS` and `ok litefleet/internal/breaker` are visible. The highlight box sits exactly on the `TestOpensAfterConsecutiveFailures` PASS line. There is no `(ins)` prompt marker.
- **End**: the three checks, the caveat and the toolchain line all fit inside the safe margins.

Apparent 2x2 "doubled" cells in one ffmpeg `tile` contact sheet came from the sheet itself. The same frames extracted alone were clean.
