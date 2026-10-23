# Source-backed Slidev browser recordings

This POC's source manifest is the contract between story and code. Extract ranges
with `git show <full-commit>:<path>`, preserve bytes, and generate screen citations
from that same metadata. Resolve tags with `^{commit}` and reject drift from the
expected SHA. Do not let hand-maintained captions silently outlive the code.

Slidev 53's Magic Move renderer creates a `pre.shiki-magic-move-container` whose
tokens do not sit inside a `code` element. Wrapping ordinary `pre code` fixes the
static slide but leaves the animated version clipped. Apply wrapping to the Magic
Move container too, then check the settled token bounds and an actual video frame.
The original long Go constructor line was clipped until this distinction was fixed.

Slidev keeps hidden slides preloaded. A first-match `.slidev-page` locator may wait
for the wrong page; use visible content and assert the expected scene. A wrapper can
exist while the loading spinner still shows. Wait for the actual heading, not only
the wrapper or `networkidle`. Also, `?print=false` enables print mode because Slidev
checks the presence of the query key.

Warm every scene before recording. The development server can fail an initial lazy
module request transiently while dependencies compile; bounded warm-up reloads help,
but inspect errors and fail if the scene never loads. This POC now builds and serves a static deck to avoid development-server
compilation and hot reload during capture. Use the same approach for production.

Magic Move duration includes token delays, so a nominal one-second transition may
settle later. Log active browser animations, inspect motion and settled frames from
the actual MP4, and leave some time for the final code to be read. Shared CPU load
also introduces click and video timing drift: browser capture is wall-clock work.

Environment-specific Playwright cache behavior belongs in the VM store entry
`playwright-shared-cache.md`, not in this project's architecture knowledge.

## Click-driven overlays without extra clicks

Callouts, captions and citations that must change with a Magic Move step can bind
to `$clicks` (`:class="{ on: $clicks === 1 }"`) instead of using `v-click`. They
then follow the Magic Move's own clicks and register none of their own. A slide
with no click-consuming element can still take timed clicks with `clicks: N` in its
frontmatter; this deck uses that for the C4 zoom, a CSS transform on a wrapper around
the unmodified image. The first slide gets the default theme's `cover` layout
unless `layout: default` is set, which shifts its padding.

Magic Move tokens start moving a few hundred milliseconds after the click and
settle well after the nominal duration. For a mid-morph still, sample several
timestamps from the MP4 and pick one where both old and new tokens are visible.
