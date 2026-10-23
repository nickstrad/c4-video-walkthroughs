# C4 → Video Walkthroughs

**Goal:** turn the C4 diagrams of a software project into a polished, narrated
video walkthrough — automatically. The tool reads a project's C4 diagram,
uses AI to map each architecture element to the real code that implements it,
decides what is worth explaining, and produces a storyboarded video that moves
between the diagram, the code, and (where useful) the running software.

The audience is hiring managers and recruiters: a 60–90 second project
overview and a 4–6 minute technical walkthrough per project, published to
YouTube as a resume booster that shows both the software and the AI-driven
way it was built and explained.

**Non-negotiable design requirement:** every code scene references a real
file/function at a specific commit. No invented code, no generic narration —
each claim in the video traces to source a viewer can open.

## The pipeline (shared by every option)

1. **Ingest** — C4 diagram images plus the diagram source (the book-notes /
   ts-db datasets are JSON; Mermaid, Structurizr or SVG also work) and the
   repository at a pinned commit.
2. **AI mapping (the step this project builds)** — an agent interprets the
   diagram, finds the files/functions implementing each element, chooses the
   one consequential story to tell (a request path, a design tradeoff, a test
   that proves behavior), and emits a structured storyboard: scenes, code
   ranges, narration text, timings.
3. **Assets** — code snippets extracted at exact ranges, diagram renders,
   optional recordings of the software actually running, narration audio with
   word/phrase timing.
4. **Render** — scenes composed into an MP4 with animated code highlighting,
   camera moves between diagram and code, captions, and narration synced to
   the visuals.
5. **Publish** — upload to YouTube with a title/description generated from
   the storyboard.

The four options below differ in stages 3–4: how the scenes are built and
rendered. The AI mapping stage (stage 2) is common — Claude Agent SDK plus a
syntax-aware extractor — in all four.

## Option 1 — Code Hike + Remotion *(best overall fit)*

*Visual result: a component lights up in the C4 diagram, the camera moves
into its implementing function, and the relevant lines animate alongside the
explanation.*

- **Claude Agent SDK** — the AI step: image understanding of the diagram plus
  repository tools to find the implementing files/functions and generate the
  narration and structured scene plan.
- **Tree-sitter** — extracts real functions and exact source ranges from
  TypeScript, Go or Rust, so every scene is anchored to verified code at a
  pinned commit.
- **Code Hike** — turns annotated snippets into readable walkthrough scenes
  with animated highlights and transitions; its documented Remotion
  integration matches this pipeline directly.
- **Remotion** — composes diagram, code, camera moves, titles and audio in
  React and renders the finished video unattended through its Node.js API.
- **ElevenLabs** — generates the narration and returns timing data the
  renderer uses to sync code highlights, scene changes and captions to the
  voice.

*Why first choice: reusable scene types — "architecture overview," "follow a
request," "code explanation," "test evidence" — get built once and populated
per repo.*

## Option 2 — Motion Canvas *(best for detailed animated explanations)*

*Visual result: requests travel between components, queues fill, state
changes — and the source code highlights at the exact moment the narration
explains it.*

- **Claude Agent SDK** — the analysis stage emits TypeScript animation scenes
  from the diagram and verified code, focused on one meaningful execution
  path per video.
- **Motion Canvas** — a dedicated animation engine with a code component that
  animates code changes, exact selections and highlighting in sync with the
  diagram animation.
- **Lezer** — language-aware syntax highlighting inside Motion Canvas; its
  JavaScript grammar configures for TypeScript and JSX.
- **ElevenLabs** — voiceover plus timing data, so animation cues land on
  phrases like "the transaction commits here."
- **@motion-canvas/ffmpeg** — exports the animation and audio track into the
  finished MP4.

*Tradeoff: more automation work — the documented workflow leans on its
editor, so fully unattended rendering needs extra orchestration.*

## Option 3 — Playwright + VHS + Remotion *(best for demonstrating working software)*

*Visual result: the video moves between the architecture, the relevant code,
and the actual application or terminal demonstrating the behavior.*

- **Claude Agent SDK** — chooses a demonstrable scenario from the repo,
  identifies the implementation behind it, and generates the narration and
  the recording scripts.
- **Playwright** — runs and records real browser workflows automatically, so
  the video shows what a user experiences while the narration explains the
  components underneath.
- **Charm VHS** — produces terminal videos from text scripts (commands,
  pauses, styling): CLI tools, SQLite queries, API requests, test runs.
- **Remotion** — stitches the recordings together with C4 diagrams, code
  excerpts, animated callouts and titles into one coherent walkthrough.
- **ElevenLabs** — narrates what each demonstration shows and why the
  implementation matters, with timing controlling the surrounding scenes.

*Why it suits a systems portfolio: show a concrete operation succeeding,
then explain the design and code that make it possible — evidence first.*

## Option 4 — Slidev + Shiki Magic Move *(best for producing a series quickly)*

*Visual result: a polished narrated technical presentation — C4 diagrams,
progressive reveals, animated code transitions.*

- **Claude Agent SDK** — generates a Markdown presentation from the diagram
  and repo: selected code excerpts, narration script, a proposed duration
  per scene.
- **Slidev** — turns the Markdown into a developer-oriented presentation with
  architecture visuals, source code and reusable layouts.
- **Shiki Magic Move** — animates transitions between code snippets with
  line highlighting, so viewers follow changes and land on the relevant
  logic.
- **Playwright** — scripts slide advancement and records the presentation,
  driven by the narration timings so each reveal lands on cue.
- **ElevenLabs** — narration per slide/section, supplying the audio and the
  timing track.
- **FFmpeg** — combines the recorded presentation and narration into the
  final MP4 (Slidev's own CLI exports decks and images, not video).

*Why consider it: a consistent presentation format with less bespoke
animation design — the fastest route to covering several projects.*

## Suggested path

Start with **Option 1** for the animated explanations, then add **Option
3's** recording tools (Playwright/VHS) so videos can cut from explanation to
the software actually working. Options 2 and 4 remain valuable: Motion
Canvas when one mechanism deserves a deep animated treatment, Slidev when a
project needs a solid video fast.

## Proofs of concept

One POC per option, built against a real project from this portfolio (the
book-notes C4 datasets and their repos). Each POC must produce: a short demo
video (10–30 s), still frames proving the signature visual rendered, and a
notes file recording what worked, what didn't, and what the full build would
need. Videos and frames are linked here so they can be watched from GitHub.

**Watch all four on a phone:** https://nickstrad.github.io/c4-video-walkthroughs/
(GitHub Pages; see [Demo site](#demo-site) below).

| Option | Builder | Status | Demo |
|---|---|---|---|
| 1 — Code Hike + Remotion | Opus | **works end to end** — 25 s, 720p: C4 view, component lights up, camera zooms in, real function with animated line focus | [walkthrough.mp4](https://github.com/nickstrad/c4-video-walkthroughs/blob/main/pocs/option-1-codehike-remotion/demo/walkthrough.mp4) |
| 2 — Motion Canvas | Opus | **works end to end, fully unattended** — 26.6 s, 720p: request packet animates the query flow, then real code highlights in sync; no editor needed | [demo.mp4](https://github.com/nickstrad/c4-video-walkthroughs/blob/main/pocs/option-2-motion-canvas/demo.mp4) |
| 3 — Playwright + VHS + Remotion | Sol, rebuilt by Opus | **works end to end** — 31.4 s, 720p: claim-first title card → live site inspection of the breaker → stepped code excerpts → terminal running the real tests (Opus rebuild at Nick's direction) | [demo.mp4](https://github.com/nickstrad/c4-video-walkthroughs/blob/main/pocs/option-3-playwright-vhs-remotion/demo.mp4) |
| 4 — Slidev + Shiki Magic Move | Sol, rebuilt by Opus | **works end to end** — 38.5 s, 720p: five-slide deck recorded to MP4; a three-state Magic Move (v0 → lesson-02 → v1) is the centerpiece (Opus rebuild at Nick's direction) | [demo.mp4](https://github.com/nickstrad/c4-video-walkthroughs/blob/main/pocs/option-4-slidev-magic-move/demo.mp4) |

All four POCs were built against litefleet at `release-it/v1-hardened`
(`9367863`) on 2026-10-22; each folder's `NOTES.md` records what worked,
what didn't, measurements, and what the full build needs. POC 3's notes flag
one honest caveat: the diagrams site's catalog did not yet contain the real
datasets at capture time, so it appended litefleet to a local copy of the
site bundle only.

*Narration note: the POCs stub the ElevenLabs step (captions/titles instead
of voice) until an API key is provided; the timing-driven sync is designed
so the voice track drops in without rework.*

## Demo site

https://nickstrad.github.io/c4-video-walkthroughs/ is a single hand-written,
dependency-free page (`site/index.html`), dark and mobile-first: one card per
POC with an inline `<video controls playsinline preload="metadata">`, a poster
frame, duration, and a full-width "open full screen" link. The Pages workflow
(`.github/workflows/pages.yml`) assembles only the page, the four demo MP4s
and four posters (copied from each POC's `frames/`) into the artifact. It
redeploys on pushes that touch `site/`, the demo videos or frames.

All four MP4s are H.264 High 720p with the `moov` atom ahead of `mdat`
(faststart), so they stream without a full download.

Verified live on 2026-10-23 after run
[39968001539](https://github.com/nickstrad/c4-video-walkthroughs/actions/runs/39968001539)
(commit `747f235`, build and deploy succeeded): the index returns 200 and
references all four videos; every poster returns 200; every video returns
200 with `video/mp4` and the full committed byte size, and answers
`Range: bytes=0-1023` with 206 and a correct `Content-Range` — the byte-range
support iOS Safari needs. Not yet checked on a physical iPhone.
