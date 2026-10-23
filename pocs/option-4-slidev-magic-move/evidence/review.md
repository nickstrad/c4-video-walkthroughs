# Review: Option 4 (Slidev + Shiki Magic Move) at snapshot 3661c76

## Verified
- **Source grounding.** `sources/manifest.json` records five ranges, each with the full commit, path, symbol, line range, SHA-256 and the exact code. The deck's code blocks match those excerpts character for character. Every block in `slides.md` comes from a `@@id@@` placeholder in `slides.template.md`. I confirmed that `book-notes/.git/refs/tags/release-it/v0-flawed` and `v1-hardened` contain exactly `6076a82…` and `936786399…`. The `revision` field in `public/litefleet.json` also names `9367863`.
- **Tag-drift protection.** `scripts/sources.mjs:16-17` resolves each tag and throws if it no longer matches the pinned SHA. It then reads by commit, not by tag, so drift fails closed.
- **Magic Move.** The block at `slides.md:96-111` morphs v0 `New` (lines 24–26) into v1 `New` (lines 36–42) in the same file. Both sides are real code. It takes one click, at 16 s.
- **Click schedule.** `record.mjs:66-84` advances at 4, 8, 12 s, clicks at 16 s, advances at 19 and 23 s, and ends at 28 s. This matches `storyboard.md`. The recorder also checks the code text before and after the morph, and that animations are running at 16.35 s (lines 70-80), which is useful telemetry.
- **C4 image.** `provenance-check.txt` confirms the image is byte-identical to the diagram-site evidence file.
- **Narration stub.** Every slide has speaker notes, and slide 6 labels the stub on screen.
- **Recording and MP4.** Playwright `recordVideo` is followed by an FFmpeg trim and an H.264/yuv420p/faststart encode at 720p, then three frames are extracted.
- **No fabricated results.** Slide 6, its narration, `NOTES.md:40-41` and `storyboard.md:30-32` all say the fault-injection checks were not run. The deck also avoids implying a 2.5 s end-to-end bound, and its Go timeout descriptions are accurate (slide 1: `http.Client{}` has no overall timeout; slide 5: `Client.Timeout` covers body reads).
- **Screenshots.** On slides 2, 3, 4, 6 (and 5), nothing is clipped and all text stays inside the frame. Slide 3 wraps one long Go line visually; it's still readable, and the wrapping is disclosed.

## Material bugs
None found.

## Nits
1. **Unfinished placeholder in NOTES.md.** `NOTES.md:77` says "Render measurements and visual inspection results follow below after validation", but nothing follows yet. Fill this in, or remove it, before landing. STATE.md already lists this as the next step.
2. **Hand-written source labels.** The `<div class="source">` labels are typed by hand in `slides.template.md` (lines 29, 50, 69, 93, 110, 127): short SHAs, line ranges and symbols. Neither `sources.mjs` nor `provenance-check.py` checks them. If someone changes a range in `definitions`, the code updates but the on-screen citation silently goes stale. Generating the labels from the manifest would fix this.
3. **Annotated tags would fail falsely.** `sources.mjs:16` uses `rev-parse <ref>` rather than `<ref>^{commit}`. It works today because the tags are lightweight. If they were ever re-tagged as annotated, the drift check would fail even though the commit is unchanged. It fails safe, but it's a rough edge.
4. **Trim timing.** `record.mjs:92` assumes the raw video ends exactly at t=28 s. The delay from `context.close()` can push the frame times at 16.35 s and 18 s later by up to a few hundred milliseconds. The mid-morph frame could then show an already-finished state. The coordinator's frame check covers this.
5. **Chromium version fallback.** The fallback at `record.mjs:32-37` picks the newest cached headless shell by string sort. That build may not match Playwright 1.61.1. The executable is logged in `render.json`, so this is acceptable for a POC.
6. **Hard-coded repo path.** `provenance-check.py` uses `/root/Software/book-notes` and ignores `SOURCE_REPO`.

## Limitations (disclosed, not defects)
- The C4 node labels are too small to read at 720p (slide 2). The deck shows the boundary; it doesn't let you read the diagram.
- After the morph, slide 4 will wrap the long v1 line the same way slide 3 does. How the wrapped lines look while animating can only be judged from the MP4 frames.
- The speaker notes are longer than the 4–7 s slots allow. `NOTES.md:53-54` acknowledges this.
- Slidev logs a FloatingVue patch error at startup. It is caught, documented and harmless.
- There is no voice or audio mux; that's out of scope.
- The 20–45 minute per-project figure is labelled as an estimate, not a measurement.

## Verdict: **NITS**
The implementation meets the acceptance criteria. The source pinning holds up, the before/after code is authentic, and the deck makes no false reliability claims. Nit 1 should be fixed before landing, and nit 2 is worth fixing. The rest are optional. This assumes the coordinator's separate MP4 checks (duration, size, animation telemetry, frames) pass.