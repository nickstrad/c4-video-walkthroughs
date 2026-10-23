# Edit real footage without faking it

Cut, don't speed. A uniformly sped-up browser clip still carries load spinners and layout flashes, and every real action plays too fast to follow. Log each Playwright action with a wall-clock time taken just before `newPage()`; Playwright's recording then lines up with that log to about one frame (the video ran ~1 frame ahead here). Keep only the window from "view is ready" to "just before the click navigates", at 1x, and let the composition draw the click from the logged coordinates. Navigation starts on the click frame, so end the window ~0.1 s before the logged click, not after it.

Playwright does not draw a cursor. Move the mouse to the target with `mouse.move(..., {steps})`, log the box centre, then click. The composition overlays a marker at that point. That way the viewer sees what was clicked without anyone painting into the page.

The book-notes diagram canvas pans on a plain wheel and zooms on ctrl+wheel at the pointer. Click "Fit View" after each drill-down so the next click target is on screen. A ctrl+wheel zoom at a point just right of the inspected node gives a legible close-up from the real renderer. A small push-in in Remotion afterwards is a camera move on real pixels, and NOTES should say so.

Charm VHS 0.10.0 wrote 25 fps here despite `Set Framerate 30`. Time terminal scenes by probed duration, not frame count. Warming the Go build cache in a `Hide` block removes compile dead time. Keep `-count=1`, so the tests themselves still execute on camera. A root `~/.inputrc` with `show-mode-in-prompt on` puts `(ins)` in every prompt. Run `bind 'set show-mode-in-prompt off'` off camera. VHS regexes are delimited by `/`, so match `/` in a path with `.` instead of `\/`.

Drive the composition from the storyboard (scene frames, captions, highlight lines, cut segments) and let `normalize.mjs` write the measured timings back. Then the storyboard cannot drift from the render, and `verify.mjs` can check continuity and that no caption text is hard-coded in the composition.
