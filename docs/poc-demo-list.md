# POC demo list: small videos that show what the framework produces

*2026-10-24, Opus. A menu of small demos to build before choosing codebases.
Each one makes a framework property you can't see today show up on screen. Item
numbers refer to the build sequence in
[story-arc-plan.md § 8](story-arc-plan.md#8-build-sequence). Effort is the
plan's scale: S is under half a day, M is about a day, L is several days.
Nothing here is built.*

**Feed** says whether litefleet (book-notes `release-it/*`, already pinned
and voiced) can supply the input, or whether the demo waits on Nick picking a
codebase. One fact checked for this list: `func (e *Engine) Query` in
`internal/engine/exec.go` changes across the release-it lesson tags (v0-flawed,
lesson-02, 03, 04, 06, 08, 10, 12). That means litefleet can feed
code-evolution, which answers plan decision 2 without a second repo.

Ordered by what to build first.

### 1. Arc on, arc off (act tracker A/B)
- **Exercises:** the arc schema, beat registry and patterns (item 1), and the
  lower-third act chrome (item 2). The 14 existing scenes are grouped into a
  5-beat `walkthrough` arc, with no new scene kinds.
- **Artifact:** the existing ~102 s litefleet video re-rendered with the
  tracker, in Remotion. Nick sees the same video with and without beat chips
  in the lower third, the current beat lit, and the strip clearing captions
  and the code pane. He judges the placement (decision 5) and whether the
  tracker earns its pixels.
- **Input:** none. **Feed: litefleet.**  **Effort: M.**

### 2. Same storyboard, two renderers (side by side)
- **Exercises:** the core/renderer boundary, and that `play.ts` lands every
  cue on the same word in both engines. Uses the item 1–2 output; nothing new.
- **Artifact:** one ~102 s 2-up MP4 (an ffmpeg `hstack` of the Remotion and
  Motion Canvas renders, lower third included), plus a still per beat. Nick
  judges the visual style, the code morph against the crossfade, and the
  typography, so he can pick a default renderer before the work doubles.
- **Input:** none. **Feed: litefleet.**  **Effort: S** (once 1 exists).

### 3. Full six-beat arc, end to end
- **Exercises:** items 3, 4 and 6. These add a `repo-card` with facts read
  from git (commit count, dates), an `architecture` descent from context to
  containers to node-components, `focus` responsibilities, and a `gains-card`
  closing on claims tied to excerpts.
- **Artifact:** a ~2:15 litefleet video in one renderer (Remotion). Nick sees
  the whole story shape for the first time, from "what is this repo" to "what
  this code buys". He judges pacing per beat and whether the close convinces.
  It needs new TTS takes, so the spend is reported.
- **Input:** none. **Feed: litefleet.**  **Effort: M.**

### 4. Honest gains card
- **Exercises:** the `gains` beat's validation (§ 2.5): every claim cites an
  excerpt, and a metric chip's value must appear verbatim in pinned bytes.
  Also the before/after benchmark variant (§ 6.3).
- **Artifact:** a 20–30 s close with 3 claims and 2 metric chips. The chips
  quote an evidence excerpt, such as a limit or deadline constant in the code
  ("2 second statement deadline"), or a recorded test or benchmark output.
  The demo also includes one deliberately invented number, which `c4v verify`
  rejects; that rejection is committed as the second artifact. Nick judges
  whether metrics that can be traced back to the code read as convincing or
  as too dry.
- **Input:** a repo whose committed files contain real numbers (a benchmark
  table, test output). **Feed:** litefleet works for constants. A
  benchmark-backed version waits on a codebase that commits benchmark results.
  **Effort: S** (on top of 3).

### 5. Shoutout styles (credits)
- **Exercises:** item 5. Blame per excerpt, identity folding, the
  `creditsOf` scopes (video, per-beat, per-excerpt), the inline `byline: true`
  under code headers, and verify rejecting a spoken name that is not in the
  credits.
- **Artifact:** three 10–15 s endings rendered from one storyboard, one per
  scope, plus one deep-dive scene with a byline. Nick sees share bars, the
  `tag · sha7 · subject · date` line and the "and N others" fold, and picks
  the default (decision 1).
- **Input:** litefleet runs it, but it has a single author, so every bar
  shows 100%. For the styles to mean anything, it waits on a **multi-author
  repo** with a `.mailmap` or aliased identities. **Feed: litefleet for
  plumbing; codebase for the real look.**  **Effort: M.**

### 6. Point-and-shoot from one pointer
- **Exercises:** item 12 (`c4v point`, `derive.ts`, `ingest/neighbors.ts`,
  the draft gate, the `DRAFT` ribbon). It also re-runs items 3, 4, 6 and 11
  (the walkthrough half of 11).
- **Artifact:** a ~90 s video derived from the § 7.5 pointer
  (`exec.go:Query`, "every query is guarded…"), rendered twice: once with the
  `DRAFT` ribbon on the gains card, and once after the drafts are confirmed.
  The demo also commits a diff of the derived storyboard against the
  hand-written one. Nick judges how close a no-authoring video gets, and
  whether the draft gate is the right friction (decision 6).
- **Input:** a pointer. **Feed: litefleet** (the fixture the plan already
  names). A second pointer into a repo with no dataset would show decision 7
  live. **Effort: M** (the item's own size; the demo is its proof).

### 7. One function through time (code-evolution)
- **Exercises:** item 7: `evolutionOf`, the line diff computed in core, Code
  Hike token transitions and Motion Canvas `Code` edits, and per-state
  citations whose sha7 differs from state to state.
- **Artifact:** a 30–45 s deep-dive variant in both renderers. `Engine.Query`
  morphs across 3–4 pins (v0-flawed → lesson-02 deadlines → lesson-06
  bulkheads → v1-hardened), with one callout per state. Nick judges whether
  the morph reads as a story and how many states fit before it becomes noise.
- **Input:** a tagged release history in which one symbol changes.
  **Feed: litefleet** (the lesson tags; this settles decision 2).
  **Effort: L.**

### 8. Two-episode series pilot with chapter markers
- **Exercises:** item 9 (`series.json`, `--video` builds, series theme tokens
  folded into the bundle, chapter markers from `timeline.acts`), and item 10
  as episode 2's pattern.
- **Artifact:** two short episodes, 60–90 s each, sharing an intro/outro card
  and an accent colour. Episode 1 is the Query walkthrough. Episode 2 is the
  convention tour "how litefleet guards every query" (`rule-card` plus three
  excerpts), and it says "as we saw in episode 1". The demo also produces a
  YouTube-style `chapters.txt` per episode. Nick judges whether two videos
  feel like a playlist and whether the chapters line up with the beats.
- **Input:** none. **Feed: litefleet.**  **Effort: M** (9 plus 10, given 3).

### 9. Change-driven, from a commit (litefleet)
- **Exercises:** item 8 with a `commit` driver: the `change` pattern
  (cold-open → change → verification → gains → shoutout), `change-card`,
  `diff-view` at `driver.base`/`driver.head`, and the snapshot sha check.
- **Artifact:** a ~75 s video on `e602a08` ("cap and stream query answers").
  It opens on the commit header and diffs `Query` against its parent. Nick
  judges whether the change story's shape differs enough from a walkthrough
  to earn its own pattern.
- **Input:** a commit with a message worth quoting. **Feed: litefleet.**
  **Effort: L** (item 8. The PR demo below then costs only a snapshot).

### 10. Change-driven, from a real PR
- **Exercises:** item 8 with a `pr` driver. Driver roles (author and
  reviewers) appear apart from the blame rows, along with `Co-authored-by`
  parsing, the `credits.note` for squash merges, and linked-issue cold opens.
- **Artifact:** a ~90 s video. It cold-opens on the linked issue's quoted
  problem, then the PR header, the diff, the tests added, and the credits
  with reviewers. Nick judges whether a PR makes a better hook than a
  walkthrough. That judgement is the strongest signal for which codebases to
  pick.
- **Input:** a **meaty merged PR** (it fixes a linked issue, changes 2–6
  files, adds tests, and has several authors or reviewers) in a repo with a C4
  dataset. **Feed: waits on Nick** (decision 3). **Effort: S** after 9.

## At a glance

| # | Demo | Items | Length · renderer | Feed | Effort |
|---|---|---|---|---|---|
| 1 | Arc on/off | 1, 2 | 102 s · Remotion | litefleet | M |
| 2 | Two renderers 2-up | (1, 2) | 102 s · both | litefleet | S |
| 3 | Full six-beat arc | 3, 4, 6 | ~2:15 · Remotion | litefleet | M |
| 4 | Honest gains card | 3 (§ 2.5) | 20–30 s · Remotion | litefleet / codebase w/ benchmarks | S |
| 5 | Shoutout styles | 5 | 3×15 s · Remotion | litefleet plumbing; multi-author repo | M |
| 6 | Point-and-shoot | 12 (+11) | ~90 s · Remotion | litefleet | M |
| 7 | Code-evolution | 7 | 30–45 s · both | litefleet (lesson tags) | L |
| 8 | Series pilot + chapters | 9, 10 | 2×60–90 s · Remotion | litefleet | M |
| 9 | Change from a commit | 8 | ~75 s · Remotion | litefleet | L |
| 10 | Change from a real PR | 8 | ~90 s · Remotion | **waits on Nick** | S after 9 |

**What Nick needs to pick, and for which demo:** a multi-author repo
(demo 5's real look), a repo with committed benchmark results (demo 4's strong
form), and a meaty merged PR in a repo with a C4 dataset (demo 10). The other
seven need nothing new.
