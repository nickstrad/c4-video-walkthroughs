# Story-arc plan: beats as plug-in components over the framework

*Planning run, 2026-10-23, Fable (planning seat). Plan only: nothing here is
implemented. It designs against the seams named in
[framework/README.md § Seams](../framework/README.md#seams-left-for-story-arc-components)
and takes audit-34 lift items 10 and 11 from
[docs/salvage-audit-34.md](salvage-audit-34.md). The storyboard format a future
AI mapping step must emit is the one in
[docs/platform-canvas.md](platform-canvas.md) § 1 (the `mapping` step), which is
core's `c4v-storyboard/1` plus the extensions below.*

## 0. The one-paragraph design

A video is a **storyboard that declares an arc**: an ordered list of beats, each
beat a group of scenes. Beats are the modular unit. A beat is a *storyboard
section* (data), backed by a *beat definition* in core (what scene kinds it may
hold, what it needs from the project, what it validates), and drawn by the
scene kinds the two renderers already register through `SCENE_KINDS` and
`RUNNERS`. Nothing in core names a renderer; nothing in a renderer names a
beat. Experimenting is editing `storyboard.json`: reorder beats, drop the
optional ones, swap a variant, add a new one, and `c4v verify` tells you
whether the result still holds together. The existing `acts` field becomes the
seam the arc hangs on, so the 14-scene litefleet storyboard keeps working
unchanged (an arc-less storyboard is one implicit beat). A pointer (repo,
commit, target) is a second way in: § 7 derives the arc from it and emits the
same storyboard, so point-and-shoot videos and authored ones share every step
after that.

```
                 storyboard.json
                 ┌──────────────────────────────────────────────┐
                 │ arc: [ repo-intro, architecture, focus,       │   data only;
                 │        deep-dive, gains, shoutout? ]          │   edit to experiment
                 │ acts/scenes: grouped under each beat          │
                 └───────────────┬──────────────────────────────┘
                                 ▼
   core  ┌─ beats/registry.ts ── BEATS: id → {kinds allowed, needs, validate} ─┐
         │  ingest/ (git log · blame · PR/issue JSON, pinned)                  │  pure + node-only
         │  storyboard/validate.ts (arc rules)   play.ts (beatAt, creditsAt…)  │  edges separated
         └───────────────────────────────┬────────────────────────────────────┘
                                         ▼  build/bundle.json (+ credits, drivers)
   renderers   SCENE_KINDS / RUNNERS: one entry per NEW scene kind
               (repo-card, change-intro, code-evolution, gains-card, credits, …)
               + one chrome layer (lower third) reading play.ts
```

## 1. Vocabulary and the composition model

### 1.1 Beats, arcs, scenes

- **Scene**: unchanged, the timed unit (one or more takes, cues).
- **Beat**: a named, ordered group of contiguous scenes with a **role** from a
  closed list. The role is what makes a beat a component: core knows what a
  `gains` beat needs and checks it; a renderer draws whatever scene kinds it
  contains. A beat is a storyboard `act` with a `role` and optional
  `variant`, so the lifted `acts` machinery (contiguity validation, timeline
  bounds, `actAt`) is reused rather than duplicated.
- **Arc**: the ordered list of beats, plus the arc's **pattern** (`walkthrough`
  for Nick's six-beat story; `change` for PR/issue/commit-driven stories; later
  patterns from § 6). A pattern is a *template of roles* with required and
  optional slots; the arc instance may omit optional slots and may insert
  extra beats where the pattern allows.

Nick's six beats map to six roles:

| # | Role | Nick's words | Required in `walkthrough` |
|---|---|---|---|
| 1 | `repo-intro` | discuss the repo as a whole | yes |
| 2 | `architecture` | system architecture, zoom to the point of the video | yes |
| 3 | `focus` | this element is the focus; what it does | yes |
| 4 | `deep-dive` | how code snippets affect the point | yes |
| 5 | `gains` | close with the gains this code gives | yes |
| 6 | `shoutout` | commit + git blame authors | optional |

Plus one **cross-cutting** component with no beat of its own: **act chrome**
(audit item 10, the lower-third act tracker), which reads the arc and draws
over every beat.

### 1.2 Schema extension (backward-compatible)

All additions are optional fields; `c4v-storyboard/1` stays the schema id.
Existing storyboards validate unchanged. The version bumps to `/2` only if a
field changes meaning, which nothing below does.

```ts
// schema.ts additions (sketch; names final enough to plan against)
export type Storyboard = {
  …existing…
  arc?: Arc;                       // NEW: declares the story shape
  acts?: Act[];                    // EXISTS; an act may now carry role/variant
  credits?: CreditsSpec;           // NEW: shoutout policy (see § 4)
  driver?: Driver;                 // NEW: the change that drives the story (§ 5)
  excerpts: ExcerptSpec[];         // EXISTS; gains `authorship?: true` (§ 4)
};

export type Arc = {
  pattern: "walkthrough" | "change" | string;   // open string; core knows the first two
  beats: string[];                              // act ids, in order
};
export type Act = {
  id: string; title: string;
  role?: BeatRole;                 // NEW; required for every act named in arc.beats
  variant?: string;                // NEW; per-role variant key, e.g. "code-evolution"
  optional?: boolean;              // NEW; documents that the arc still holds without it
};
export type BeatRole =
  | "repo-intro" | "architecture" | "focus" | "deep-dive" | "gains" | "shoutout"
  | "cold-open" | "investigation" | "change" | "verification";   // § 5 adds these
```

**Rules `validateStoryboard` adds** (all pure, in `validate.ts`):

1. If `arc` is present, every id in `arc.beats` is an act with a `role`, the
   acts appear in the storyboard in that order, and no scene lies outside a
   beat. (Acts not in `arc.beats` are allowed, e.g. an interlude, but then the
   arc must mark them optional.)
2. The pattern's required roles are all present, in the pattern's relative
   order. Optional roles may be absent. The pattern table lives in
   `core/src/beats/patterns.ts` as data.
3. Each beat's scenes use only the scene kinds its role allows, and each role's
   **needs** are satisfied (below). A role that needs excerpts with authorship
   fails verify if `credits` asks for blame data that was not ingested.
4. A storyboard with no `arc` is valid and renders as today.

### 1.3 Beat definitions live in core, once

`core/src/beats/registry.ts` exports `BEATS: Record<BeatRole, BeatDef>`:

```ts
type BeatDef = {
  role: BeatRole;
  kinds: SceneKind[];                       // scene kinds this beat may contain
  needs: ("dataset" | "code" | "git-log" | "git-blame" | "driver")[];
  variants?: Record<string, { kinds: SceneKind[]; needs?: … }>;
  validate?: (beat: Act, scenes: Scene[], sb: Storyboard) => string[];
  /** Narration seeds: which project data a producer may quote for this beat. */
  narrationSources: ("dataset.documents" | "dataset.model" | "excerpt" | "commit" | "pr" | "issue" | "credits")[];
};
```

This is the only place a role is spelled out. Renderers never read it; they
read scene kinds. The AI mapping step reads it to know what each beat is for.
Adding a beat role is: one entry here, one line in a pattern, and whichever
new scene kinds it introduces (registered in both renderers).

### 1.4 How a beat reaches both renderers

The rule from the README holds: **a renderer draws scene kinds, and the
interpreters stay generic.** Each beat below lists which scene kinds it uses.
Some are existing kinds; the new ones are each **one entry** in
`renderer-remotion/src/scenes.tsx` (`SCENE_KINDS`, a `shot()` plus optional
`Overlay`) and one in `renderer-motion-canvas/src/kinds.tsx` (`RUNNERS`). Every
timing question a new kind asks is a pure `play.ts` query, added once in core.
The two renderer-specific objects each new kind needs are already the pattern:
a region on the stage (`stage.ts` boxes / `screenLayout`) and a camera. New
kinds introduced by this plan:

| New scene kind | Used by beat | What it shows |
|---|---|---|
| `repo-card` | repo-intro | repo name, one-line purpose, pinned commit, element/container counts from the dataset; optional context view faded in behind |
| `change-card` | cold-open / change (§ 5) | an issue or PR header: number, title, author, state, pinned SHA, labels |
| `code-evolution` | deep-dive (variant) | one symbol across 2–4 pins, morphing state to state (audit item 11) |
| `diff-view` | change (§ 5) | before/after excerpt pair from the driver's base and head commits |
| `gains-card` | gains | 2–4 claim lines, each citing an excerpt id or an evidence excerpt; optional metric chips |
| `credits` | shoutout | commit line + author rows with share bars (§ 4) |

And one **chrome** element, not a scene kind: `lower-third` (§ 2.7).

### 1.5 What stays common across every beat (shared machinery)

- **Narration**: unchanged. Every beat's text is `caption`/`speech`/`lines`
  on its scenes; takes are committed per scene; cues are phrases. No beat
  carries its own narration mechanism.
- **Citations**: every on-screen provenance string comes from
  `citation()` or the new `creditLine()` in core, never typed.
- **Context inheritance** (`contextOf`), **state panel**, **hops**, **captions**
  all keep working inside any beat.
- **Verify gate**: `c4v verify` is the acceptance gate for a storyboard whether
  a human or the mapping step wrote it.

## 2. One component per beat

Each entry: purpose · inputs → outputs · schema it needs · scene kinds in both
renderers · narration · data dependencies.

### 2.1 `repo-intro` (beat 1: the repo as a whole)

- **Purpose.** Thirty seconds that answer "what is this repo and why should I
  watch". Sets the pinned commit on screen from the first frame so every later
  claim is anchored.
- **Inputs.** `sources.code` (repo, tag, commit); `sources.dataset` (title,
  `documents` prose for the context diagram, element counts). Optional:
  `git-log` summary (commit count, first/last dates) from ingestion (§ 3).
- **Outputs.** 1–3 scenes: `repo-card` (new), then optionally
  `architecture-overview` on the context view.
- **Schema.** No new scene fields beyond the `repo-card` kind:
  `{ kind: "repo-card", view?: string, facts?: ("commit"|"elements"|"containers"|"commits"|"first-commit"|"languages")[] }`.
  The facts list is what the card may print; values come from the bundle's new
  `repo` block (§ 3.1), never from the storyboard text.
- **Renderers.** Remotion: `shot()` with no diagram (or the context view at
  `FULL` behind, dimmed) and an `Overlay` card. Motion Canvas: a runner that
  sets a `header: {kind: 'card'}` and a new card node. Both read facts through
  `play.ts` `repoFactsOf(bundle)`.
- **Narration.** 1–2 lines, the producer writes them from
  `dataset.documents[context].plain` and the repo README excerpt (as an
  `evidence` excerpt, so what is quoted is byte-pinned too).
- **Data.** dataset; code pin; git-log (optional).

### 2.2 `architecture` (beat 2: the system, zooming to the point)

- **Purpose.** Walk the C4 levels down to the view that contains the focus
  element. This is the existing option-1 move, extended across levels.
- **Inputs.** The dataset's views and the `detail.diagramId` links between
  them (the dataset already encodes context → containers → components).
- **Outputs.** A chain of `architecture-overview` scenes, one per level, each
  optionally with `elementId` to pre-light the element that opens the next
  level, and ending on the view the `focus` beat uses.
- **Schema.** `architecture-overview` gains `descend?: { elementId: string, cue?: string }`:
  light this element at the cue, and the next scene's view must be its detail
  view (validated through `dataset.diagrams[].nodes[].detail.diagramId`). No
  new kind.
- **Renderers.** Existing kind; the transition rule (camera for same view,
  crossfade for a different one) is already in both. A "descend" is a zoom
  into the element then a crossfade to the child view, so each renderer adds
  one branch to its existing overview shot/runner.
- **Narration.** One line per level; the producer draws on
  `dataset.documents` for that diagram.
- **Data.** dataset only.

### 2.3 `focus` (beat 3: the highlighted element and what it does)

- **Purpose.** Name the element, say what it does, show its neighbours. The
  existing `focus-element` scene is this beat's core.
- **Inputs.** `elementId`, its `description`, its relationships in the view,
  its `sourceIds` (the dataset's source selectors) so the deep dive is
  pre-announced.
- **Outputs.** `focus-element`, optionally followed by `follow-request` on a
  dynamic view that passes through the element (as litefleet does).
- **Schema.** `focus-element` gains `responsibilities?: string[]` for an
  optional on-screen list (spoken as `lines`, so each is cue-timed). Optional
  `badge` already exists.
- **Renderers.** Existing kinds. The responsibilities list is a small overlay
  in Remotion and a list node in Motion Canvas, both fed by `captionAt` lines
  (no new text source).
- **Narration.** 1–3 lines from the element's `description` and the document
  prose.
- **Data.** dataset.

### 2.4 `deep-dive` (beat 4: how code snippets affect the point)

- **Purpose.** The technical centre. Existing `code-explanation` scenes with
  `focus` or `steps`, plus two variants.
- **Variants.**
  - `default`: `code-explanation` runs over 1–3 excerpts, context strip kept
    (as litefleet s5–s10 and n-acquire).
  - `code-evolution` (**audit item 11**): one symbol across commits. New scene
    kind `code-evolution` with `{ excerpts: string[], states: { excerpt: string, label: string, callout?: string, cue?: string }[] }`.
    The excerpts share `symbol` and `path` and differ in `at` (per-excerpt pins,
    lift 3). Core validates the shared symbol and emits
    `evolutionOf(bundle, sceneId)` in `play.ts`: ordered states with absolute
    times and the line-level diff between consecutive states (a pure LCS over
    excerpt lines, computed in core so both renderers morph the same lines).
    Remotion animates with Code Hike's token transition; Motion Canvas with
    its `Code` edits. The citation per state comes from `citation()`.
  - `diff` (§ 5): `diff-view` over a base/head excerpt pair.
- **Schema.** New kind `code-evolution`; `code-explanation` unchanged.
- **Renderers.** `code-explanation` exists. `code-evolution` is one new
  registry entry each, reading only `evolutionOf`. The feel to match is the
  option-4 Magic Move (audit 4.5, REFERENCE).
- **Narration.** Existing lines/steps; for evolution, one line per state.
- **Data.** code (multi-pin); dataset for the context strip.

### 2.5 `gains` (beat 5: what this code buys)

- **Purpose.** Close the argument: claims, each tied to something shown.
- **Inputs.** Claims as `lines`, each naming an excerpt id (code or
  `evidence`) it rests on; optional metric chips from evidence excerpts (a
  benchmark table in the repo, a test output quoted at the pin).
- **Outputs.** One `gains-card` scene: `{ kind: "gains-card", claims: { lineId: string, excerpt: string, metric?: { label: string, value: string } }[], view?: string }`.
  Each claim appears when its line is spoken (the timeline already gives
  line starts), with the excerpt's citation under it.
- **Validation.** Every claim's `excerpt` exists; a `metric.value` must appear
  verbatim in that excerpt's text (so the number on screen is in the pinned
  bytes). This is the no-invented-claims rule applied to the close.
- **Renderers.** One new entry each: card overlay (Remotion) and card node
  (Motion Canvas), reading `claimsOf(bundle, sceneId)` from `play.ts`.
- **Narration.** The claim lines.
- **Data.** code (evidence excerpts); optionally the dataset view faded behind.

### 2.6 `shoutout` (beat 6, optional: commit and blame credits)

- **Purpose.** Credit the people whose lines were on screen, at the commit the
  video pinned.
- **Inputs.** The credits block of the bundle (§ 4).
- **Outputs.** One `credits` scene: `{ kind: "credits", scope: "video" | "beat" | "excerpt", excerpt?: string }`.
- **Renderers.** One entry each: a card listing the base commit line and
  author rows, with share bars sized from `creditsAt(bundle, scope)`.
- **Narration.** One or two lines ("Based on commit …; the code shown was
  written by …"). The author names in the speech are generated by core into
  the storyboard text at mapping time, **and** verify checks that each name
  spoken is in the ingested credits, so the voice cannot credit the wrong
  person.
- **Data.** git-blame, git-log.

### 2.7 Act chrome: the lower-third act tracker (audit item 10)

- **Purpose.** Tell the viewer where they are in the arc: a beat label, one
  chip per beat with the current one lit, fading across the scenes of a beat.
- **Not a scene kind.** It is a chrome layer drawn by each renderer's
  composition root (`Walkthrough.tsx` layer list; `Stage` in Motion Canvas),
  gated by `arc` being present. It reads only `actAt` (exists) and a new
  `arcProgressAt(bundle, t)` → `{ beats: {id,title,role,state: "done"|"current"|"todo"}[], index, within: 0..1 }`.
- **Schema.** `arc.chrome?: { lowerThird?: boolean; labels?: "title" | "role" }`
  (default on when `arc` exists; labels default to act titles).
- **Placement.** Remotion: a strip above the captions (`bottom: 18` is the
  caption row; the lower third sits at roughly y 640–660, a new `LOWER_THIRD`
  box in `stage.ts`). Motion Canvas: a new region in `screenLayout`. Both
  take theme tokens, not literal colours (the audit's adaptation note).
- **Interaction with the state panel.** The panel is top-right; no clash.
  With a code pane at `CODE_ALONE`, the pane bottom is y 608, so the strip
  fits without moving anything.

### 2.8 Narration summary across beats

| Beat | Text comes from | Spoken as |
|---|---|---|
| repo-intro | dataset documents, README evidence excerpt | 1–2 lines |
| architecture | dataset documents per view | 1 line per level |
| focus | element description, relationships | lines |
| deep-dive | excerpt walk; evolution states | steps / focus cues / lines |
| gains | claim lines tied to excerpts | lines |
| shoutout | generated credit line, verified against credits | 1–2 lines |
| cold-open / change (§ 5) | issue/PR title and body quotes as evidence excerpts | lines |

In every case the producer (human or AI) writes the words; core only
verifies that names, numbers and quoted text trace to pinned data.

## 3. Ingestion: repo data core does not yet read

Today `code-source/git.ts` reads blobs and resolves refs. The arc needs three
more read-only sources, each node-only, each behind a pure type the bundle
carries.

### 3.1 `ingest/repo.ts` → `bundle.repo`

`git log` summary at the pin: commit count to the pinned SHA, first and last
commit dates, top-level languages by file extension (counted from `git
ls-tree -r`), the README's first paragraph as an evidence excerpt candidate.
Output `RepoFacts`, used by `repo-card`.

### 3.2 `ingest/blame.ts` → `bundle.credits` (§ 4)

`git blame --porcelain -L start,end <commit> -- path` per excerpt, at the
excerpt's own pin. Pure aggregation afterwards.

### 3.3 `ingest/driver.ts` → `bundle.driver` (§ 5)

A PR, issue or commit, fetched once and **snapshotted into the project**
(`sources/driver.json`) the way the dataset is, so builds are offline and
reproducible. The snapshot records the API URL, the fetch time and a sha256;
verify checks the snapshot's sha256 against the storyboard, not the live API.

**Platform note.** All three run in the sandbox against the pinned clone
(`checkoutFor`), as the canvas's `ingest` step. PR and issue fetches use the
GitHub App token the canvas already provides for cloning.

## 4. The shoutout data pipeline

### 4.1 What is credited

Exactly the excerpts that appear on screen: every `ExcerptSpec` referenced by
any scene in the storyboard, over its `lines` range, at its own commit
(`at.commit`, else `sources.code.commit`). Nothing is blamed that is not shown.
Evidence excerpts are included only when `authorship: true` is set on them
(prose authorship is usually not the point).

### 4.2 Pipeline

1. **Blame per excerpt** (node): `git blame --porcelain -L a,b <commit> -- <path>`.
   Collect per line: author name, author email, commit SHA, author time.
   Store under `bundle.credits.excerpts[id] = { lines: BlameLine[] }`.
2. **Identity folding** (pure): map `(name, email)` pairs to one identity using
   the repo's `.mailmap` at the pin if present (`git check-mailmap` honours
   it when `blame` runs; the storyboard may also carry
   `credits.aliases: { canonical: string, matches: string[] }[]`).
3. **Aggregation** (pure, `creditsOf(bundle, scope)`):
   - `excerpt` scope: lines per author for one excerpt.
   - `beat` scope: union of the beat's excerpts.
   - `video` scope: union of all shown excerpts.
   Each result: `{ base: { commit, tag, authoredAt, subject }, authors: { name, lines, share, excerpts: string[], firstTouched: date }[] }`,
   sorted by lines, ties by first touch. `share` is lines/total.
4. **Policy** (`storyboard.credits`): `{ scope: "video" | "per-beat" | "per-excerpt", minShare?: number (default 0.05, below which authors fold into "and N others"), showEmail?: false, showCommits?: boolean }`.
5. **Verify**: the committed `bundle.credits` must reproduce from the pinned
   repo (same lines, same authors), like the excerpt byte checks. Spoken
   names in the shoutout scene must be in the credits.

### 4.3 What it renders as

- The `credits` scene kind (§ 2.6): a base-commit line generated by
  `creditLine(base)` → `tag · sha7 · subject · date`, then author rows with a
  share bar and the excerpt ids they touched. Per-excerpt credits can also be
  shown inline: an optional `byline: true` on a `code-explanation` scene draws
  a small "lines by …" under the code header, fed by `creditsOf(bundle, {scope: "excerpt", excerpt})`.
- The name is the git author name. It is not a GitHub login unless the driver
  ingestion (§ 5) supplies a mapping from commit SHA to GitHub user, in which
  case the login is shown as a secondary line.

## 5. Change-driven stories: a PR, an issue or a commit drives the video

### 5.1 The driver

```ts
export type Driver =
  | { kind: "pr";     repo: string; number: number; base: string; head: string; snapshot: string }
  | { kind: "issue";  repo: string; number: number; fixedBy?: { commit: string } | { pr: number }; snapshot: string }
  | { kind: "commit"; repo: string; commit: string; parent?: string; snapshot: string };
```

`snapshot` names `sources/driver.json`, the frozen fetch: title, body, author
login, state, labels, created/merged dates, the list of changed files with
per-file additions/deletions (PR and commit), linked issues (from the PR
body's "fixes #n" and the timeline), and for a commit its subject, body and
parent. For a PR, `base` and `head` are SHAs frozen at request time, the
canvas's provenance rule applied to both ends.

A driver makes the excerpt pins meaningful in pairs: an excerpt may say
`at: { ref: "driver.base" }` or `at: { ref: "driver.head" }` and core resolves
these to the snapshot's SHAs. This is the only schema change to `ExcerptSpec`
beyond `authorship`.

### 5.2 The `change` pattern

| Role | Required | What changes vs `walkthrough` | What stays |
|---|---|---|---|
| `cold-open` | yes | new: `change-card` with the issue (or PR) header; the problem statement quoted as an evidence excerpt from the issue body | narration machinery, chrome |
| `architecture` | optional | same beat; the "point" is the element(s) whose files the diff touched (core suggests them by matching changed paths to `dataset.sources[].path`) | overview kind, descend |
| `investigation` | optional | the `focus` beat renamed by role: where the bug lived, `code-explanation` at `driver.base` | focus-element, code-explanation |
| `change` | yes | the deep dive: `diff-view` pairs (base/head of the same symbol) or `code-evolution` when the PR has several commits worth stepping | context strip, steps, cues |
| `verification` | optional | tests added or changed in the diff as `code-explanation` at head; or an evidence excerpt of CI output quoted from the PR | evidence excerpts |
| `gains` | yes | claims cite the diff and the issue's acceptance criteria | gains-card |
| `shoutout` | optional, **default on** | credits are the PR author plus blame at head over the shown excerpts | credits pipeline |

Roles in a `change` story are different names for the same beat machinery:
`cold-open` and `investigation` are beat defs whose allowed kinds overlap
`repo-intro` and `focus`, with `driver` added to their `needs`. No renderer
knows the difference.

### 5.3 Mapping each driver onto beats

- **Issue** → cold open is the issue (title, body quote, reporter, opened
  date); investigation is at the base of the fixing change; change is the
  fixing PR/commit's diff; gains quote the issue's closing comment or the
  tests; shoutout credits the reporter (from the snapshot) and the fix's
  authors (from blame at head). If `fixedBy` is absent, the arc stops after
  investigation and the pattern marks it `open-issue` (a valid shorter arc).
- **PR** → cold open is the PR header plus its linked issue if any; change is
  the diff; verification is its test changes; shoutout credits the PR author,
  reviewers (from the snapshot) and blame at head.
- **Commit** → cold open is the subject and body; change is `parent → commit`
  diffs; shoutout is the committer plus blame.

### 5.4 Authorship in change stories

Two sources, kept distinct on screen: **blame** (who wrote the lines shown,
from git, at head) and **driver roles** (author, reviewers, reporter, from the
snapshot). The credits scene shows driver roles first, then blame rows. Verify
checks the PR author's commits appear in the blame of at least one head-side
excerpt; if not, the storyboard must say so (a `credits.note` line), because
"this person's PR" and "this person's lines" can differ (squash merges,
co-authors). `Co-authored-by` trailers in the commit messages are parsed and
credited.

### 5.5 What the mapping step emits

The same storyboard, with `driver`, an `arc` of pattern `change`, excerpts
pinned at `driver.base` / `driver.head`, and `credits` policy. The validation
gate is unchanged. The producer gets `BEATS` and `PATTERNS` as its
instructions, so it cannot invent a beat shape core will reject.

## 6. Addendum: other patterns for an entertaining software story

### 6.1 A TigerBeetle playlist, one aspect per video

TigerBeetle (github.com/tigerbeetle/tigerbeetle) is a financial transactions
database in Zig built around a few strongly-held design decisions, which is
what makes it a good north star: every aspect is a story with a reason. The
sketch below is from what I know of the project plus a quick read of its
docs index; each video names what a builder must verify in the repo at a
pinned commit before writing a storyboard.

| # | Video (aspect) | Arc pattern | Likely focus in the code | Verify first |
|---|---|---|---|---|
| 1 | Why a database for only debits and credits | `walkthrough` | the `Account`/`Transfer` structs and the state machine | the exact struct layout and the state machine file at the pin |
| 2 | TigerStyle: the rules the code is written under | `convention` (§ 6.3) | assert density, static allocation at startup, no recursion | the TIGER_STYLE doc at the pin, and pick three functions that show it |
| 3 | The VSR consensus protocol: one request's journey | `walkthrough` with `follow-request` | the VSR replica, prepare/commit path | the replica's message handlers; whether a dynamic view can be built for the path |
| 4 | The LSM forest: how writes become reads | `walkthrough` | LSM tree and manifest | the tree/manifest modules and their compaction entry points |
| 5 | The VOPR: thousands of simulated worlds | `test-campaign` (§ 6.3) | the simulator and its fault injectors | the simulator entry point; that a run can be shown as evidence output |
| 6 | io_uring and Direct I/O: zero-syscall I/O | `walkthrough` | the I/O layer per OS | the Linux io_uring backend file and its submission path |
| 7 | State sync and upgrades without downtime | `walkthrough` or `code-evolution` | sync and the upgrade protocol | the Sync and Upgrades internals docs still describe the pinned code |
| 8 | Anatomy of a bug fix found by the VOPR | `change` | one merged PR with a VOPR seed in its description | find a real PR with a seed reproduction and tests |
| 9 | Clients and the wire protocol | `walkthrough` | the client library and message framing | which client languages are in-tree at the pin |
| 10 | The data file on disk | `walkthrough` with a `layout` variant | superblock, grid, WAL zones | the DATA_FILE internals doc matches the pinned code |

Grounding read on 2026-10-23: the repo's `docs/internals` index (ARCHITECTURE,
TIGER_STYLE, VSR, LSM, Sync, Upgrades, Data File, Testing, VOPR), the
performance page (LSM trees, io_uring, Direct I/O) and the talks page
(deterministic simulation with network and storage fault injection). Sources:
[docs/TALKS.md](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TALKS.md),
[docs.tigerbeetle.com/about/performance](https://docs.tigerbeetle.com/about/performance),
[a mirror's docs/internals index](https://upd.dev/DKB/tigerbeetle/src/branch/encryption/docs/internals)
(third-party copy; confirm against the official repo at the pin).

A C4 dataset for TigerBeetle does not exist in Nick's book-notes format; the
platform canvas's open decision 4 (generate C4 from code or require it)
decides whether this playlist is even startable. Assume for planning that a
dataset is produced once per series (§ 6.2).

### 6.2 Common, per-video, per-series

- **Common across all videos, series and repos** (framework): the schema, the
  beat registry and patterns, narration and timeline, pinning and citations,
  credits, verify and proof, both renderers, the act chrome, the stage
  regions and theme tokens.
- **Unique per series/repo** (project-level, declared once, inherited by every
  video in the series): the repo and its C4 dataset, the series theme
  (accent colour, title treatment, narrator voice), the intro/outro cards,
  the credits policy, pronunciation lexicon entries ("TigerBeetle", "VOPR"),
  the aliases for author identities, and a **series storyboard**: an ordered
  list of video ids with cross-references ("as we saw in episode 3").
- **Unique per video**: the pin (each video can pin its own commit; a series
  may also pin once), the arc instance (which beats, which variants), the
  focus element, the excerpts, the narration text, the driver if any.

This argues for one new project-level file, `series.json`, alongside several
`videos/<slug>/storyboard.json`, with `c4v build <project> --video <slug>`.
The series file is data; nothing in a renderer reads it, because core folds
its values into the bundle (theme tokens, intro/outro cards, lexicon).

### 6.3 Pattern suggestions, each judged

| Pattern | What it is | Judgement | Why |
|---|---|---|---|
| **Cold open on a failure** | start with the crash, the bug, the slow query (an evidence excerpt or a terminal take), then rewind | **variant of `cold-open`** (change pattern) and allowed as an optional first beat in `walkthrough` | It is beat 1 with a different data source; no new machinery |
| **Follow one request end to end** | the option-2 move at full length, across C4 levels | **already a component** (`follow-request` + `descend`) | Covered by beats 2–4 |
| **Code evolution** (one function across versions) | audit item 11 | **variant of `deep-dive`** | Decided above |
| **Convention tour** ("TigerStyle", "how this repo handles errors") | three or four excerpts that each show the same rule | **new pattern `convention`**: `repo-intro → rule-card → deep-dive×N → gains` | Needs one new scene kind, `rule-card` (the rule as an evidence excerpt from the style doc); otherwise reuses beats |
| **Test campaign** ("the VOPR", "what the fuzzer found") | explain a test harness and show it running | **new pattern `test-campaign`**, but only after media-floor holds exist | The "show it running" beat needs the deferred terminal take (audit 3.14, holds from lift 6). Until then, the run is quoted as evidence |
| **Before/after benchmark** | two evidence excerpts and a metric chip | **variant of `gains`** (`gains-card` already takes metrics) | No new kind |
| **Tour by numbers** (counts, sizes, ages) | the repo-card facts as a beat | **folded into `repo-intro`** | Same data |
| **Series intro/outro cards and "previously on"** | consistent openers, cross-episode references | **series-level machinery** (`series.json`) | Per-series data, not a beat |
| **Live site / UI tour** | option 3's browser capture | **out of scope** for this plan | Platform canvas rates it L and opt-in; needs per-repo runtimes |
| **Two-person dialogue narration** | a questioner and an explainer | **out of scope** (narration provider seam) | A second voice is a `takes.ts` change, orthogonal to beats; worth a note, not a component |
| **Interactive chapter markers** on YouTube | emit chapter timestamps from `timeline.acts` | **series-level machinery**, S | Pure function over the timeline; feeds the publish step |

**Strongest two**: the **convention tour** (it makes the "why this repo is
written this way" video, the one most repos deserve and the TigerStyle video
needs) and **series machinery with chapter markers** (it is what turns single
videos into the playlist Nick is aiming at, for the cost of one data file and
one pure function).

## 7. Point-and-shoot entry mode: a pointer in, a video out

Nick's addition after the draft: he wants to point at something interesting
in a codebase and get a video for it, with no storyboard authoring and no arc
selection up front. This section specifies that mode as a **front door** onto
everything above: it derives a `walkthrough` arc from a pointer, emits an
ordinary storyboard, and hands over to the pipeline already planned. Nothing
in a renderer changes except one ribbon (§ 7.4).

### 7.1 The input: a pointer

The only required input is a pointer: a repo, a pinned commit, and a target.
An optional one-line note says why the thing is interesting.

```ts
export type Pointer = {
  repo: string;                       // owner/name, as sources.code.repo
  commit: string;                     // a SHA; a tag or branch given at the CLI is
                                      // resolved to its SHA at point time and both are kept
  target:
    | { kind: "file";    path: string }
    | { kind: "symbol";  path: string; symbol: string }       // function, method, type
    | { kind: "range";   path: string; lines: Range }
    | { kind: "element"; elementId: string; diagramId?: string }   // a C4 diagram element
  why?: string;                       // one line, optional; becomes draft claim 1 (§ 7.2)
  dataset?: Storyboard["sources"]["dataset"];   // optional; see decision 7 when absent
};
```

Paths are repo-root paths at the pin (what `git ls-tree` prints), so a
pointer into litefleet reads `books/release-it/project/internal/engine/exec.go`;
`sources.code.stripPrefix` is applied for display only, as today. Two ways in,
both producing the same `pointer.json` under the project:

```
c4v point <project> --repo nickstrad/book-notes --at release-it/v1-hardened \
  --target 'books/release-it/project/internal/engine/exec.go:func (e *Engine) Query' \
  --why "every query is guarded before it touches SQLite"

c4v point <project> --pointer pointer.json
```

`--target` is parsed as `path`, `path:symbol`, `path:a-b` (a range) or
`element:<id>`; `--why` is free text. On the platform (canvas § 1) the
pointer is the job's admit payload instead of a storyboard, and it carries
the same provenance rule: the SHA is frozen at request time.

### 7.2 How the arc is derived from the pointer

Derivation is split in two so the shape is testable without a model: a
**deterministic skeleton** that core computes from the pointer, the pinned
tree and the dataset, then the **AI mapping step** that fills words and
drafts the close inside the skeleton's bounds. The skeleton is where the
existing beats are chosen; the model never picks beats.

**Step 1, resolve the target to a locus** (`path`, `lines`, `symbol`):

- `symbol` → the line where `symbol` starts, through to the symbol's closing
  line, under the existing excerpt rule (the symbol is declared at or above
  the range; `wholeFunction` and `closing` as the excerpt format already
  has them). Found by
  `git grep -n` over the pinned tree first; Tree-sitter when the language has
  a grammar wired in (decision 8).
- `range` → as given; `symbol` is the nearest declaration above `lines[0]`,
  else a description (an evidence excerpt).
- `file` → the file's top-level declarations, ranked by size and by how many
  other files reference them; the top one becomes the locus and the next two
  become deep-dive candidates.
- `element` → the element's `sourceIds` → `dataset.sources[].path` (and
  `notes`, which in the book-notes format names the symbol) → the first
  source's path and symbol become the locus; the rest become candidates.

**Step 2, resolve the locus to the dataset** (the inverse of step 1's last
case). Collect dataset sources whose `path` equals the locus path, then the
elements and **relationships** that cite them. litefleet's `exec.go` is cited
by three relationships and no element, so the rule must walk relationship
endpoints: an element that cites the source directly wins; else the
endpoints of citing relationships that are inside the system (not external);
ties go to the deepest element (longest `parentId` chain), which for `exec.go`
is `nd-engine` through `n-engine-handles`. The **focus view** is the deepest
diagram whose nodes include that element (`node-components`), and the
**descent chain** is the `detail.diagramId` path from the context view to it
(`context → containers → node-components`), which is what the `architecture`
beat's `descend` (§ 2.2, item 6) already walks.

**Step 3, find the neighbours** for the deep dive, read-only at the pin
(`ingest/neighbors.ts`, node-only like § 3): callers and callees of the locus
symbol inside the repo, found by `git grep -nw <name>` over the pinned tree
and filtered to lines that are not the declaration. Rank: same file, then
same directory, then the rest, with tests last; keep the top two as excerpt
candidates and record the full ranked list in `derived.candidates` (§ 7.3).
Every candidate is turned into an `ExcerptSpec` by the existing pin and
symbol machinery (`pinExcerpts`), so it is byte-checked like any excerpt. If
the dataset relationship that cites the locus has an id, it goes on the
excerpt as `relationshipId` and `datasetSourceId`, exactly as litefleet's
`query-guards` excerpt does by hand.

**Step 4, lay the beats** (all existing roles; `walkthrough` pattern):

| Beat | Derived from | What the skeleton emits |
|---|---|---|
| `repo-intro` | `bundle.repo` (§ 3.1, item 4) and the README's first paragraph as an evidence excerpt | one `repo-card` scene, facts `commit, elements, containers, commits`; narration empty |
| `architecture` | the descent chain from step 2 | one `architecture-overview` per level with `descend` on the element that opens the next; narration empty |
| `focus` | the element from step 2, its `description`, its relationships in the focus view | one `focus-element` with `responsibilities` seeded from the description's clauses; one `follow-request` if a dynamic view passes through the element (litefleet: `usage-flow` does) |
| `deep-dive` | the locus excerpt plus the top neighbours from step 3 | `code-explanation` scenes, `default` variant, one per excerpt, the locus first, context strip on the focus view |
| `gains` | **drafted**, see below | one `gains-card` whose every claim carries `draft: true` |
| `shoutout` | credits policy per decision 1 | present only if the default says so; its names are generated and verified as in § 2.6 |

**Gains are drafted, never silently invented.** The close is the one beat a
pointer cannot determine, because "what this code buys" is a judgement. The
skeleton therefore emits claim *slots*, each with the evidence it may rest
on, and the mapping step writes a sentence per slot. Slots, in order:

1. The `why` note, verbatim, citing the locus excerpt (only if `why` was given).
2. The element's `description` from the dataset, citing the locus excerpt.
3. The doc comment or docstring immediately above the locus symbol, as an
   evidence excerpt (pinned bytes, so the quote is checkable).
4. Test names that reference the symbol (from step 3's grep, tests bucket), as
   an evidence excerpt of the test file's relevant lines.

A slot with no evidence is dropped, not filled. Each emitted claim is
`{ lineId, excerpt, draft: true, basis: "why" | "description" | "doc-comment" | "tests" }`;
the § 2.5 validation (claim cites an existing excerpt; a metric value must
appear verbatim in it) applies unchanged, so a draft can still only say what
the pinned repo contains. The flag is visible in three places:

- **Storyboard**: `draft: true` on each claim and `draft: true` on the `gains`
  act, so a reader of the JSON sees it before anything renders.
- **Verify**: `c4v verify` reports every draft and **fails** unless run with
  `--allow-drafts` (decision 6 fixes whether fail or warn). `c4v proof`
  refuses an MP4 built from a storyboard with drafts, so an unconfirmed close
  cannot be published through the pipeline.
- **Render**: both renderers draw a `DRAFT` ribbon over a draft claim on the
  gains card, from `claimsOf` (which already returns the claim; it gains the
  flag). This is the only renderer change the mode needs.

Confirming is editing: the author rewrites or keeps the sentence and deletes
the `draft` flag; the act's flag clears when no claim carries one (verify
checks they agree). Nothing else in the storyboard is marked draft, because
nothing else was invented: beats 1–4 are facts and quotes from the pin, and
their narration lines are checked the way every line is (§ 2.8).

**Step 5, the AI fills the words.** The mapping brief (item 11) gets a
point-and-shoot addendum: given the skeleton and `derived.candidates`, write
the narration for each scene from that beat's `narrationSources`, write one
sentence per gains slot from its basis, and optionally swap a neighbour for
another candidate from the ranked list. It may not add scene kinds, beats or
excerpts the skeleton did not offer; `c4v verify` enforces that by comparing
the result against `derived` (same arc, excerpt ids drawn from the candidate
set). Locally the step is a `claude -p` run over the brief; on the platform it
is the canvas's mapping sandbox, unchanged.

### 7.3 The intermediate artifact is an ordinary, editable storyboard

`c4v point` writes `storyboard.json` in the § 1.2 format (schema
`c4v-storyboard/1`, `arc.pattern: "walkthrough"`), plus one new optional
block that records where it came from:

```ts
derived?: {
  from: Pointer;                              // the pointer, SHA frozen
  at: string;                                 // ISO time of derivation
  by: string;                                 // "c4v point <version>" or the mapping agent id
  locus: { path: string; lines: Range; symbol: string };
  element: { id: string; via: "element" | "relationship"; sourceId: string };
  candidates: { excerpts: ExcerptSpec[]; ranked: string[] };   // the neighbours it could have used
};
```

`derived` is informational: validation does not depend on it except for the
step-5 bound check, and deleting it turns the storyboard into a hand-written
one. From here the video is like any other: reorder or drop beats in `arc`,
swap the deep-dive variant to `code-evolution`, add a `cold-open`, hand-tune
any line, then `narrate`, `build`, `verify`, `proof`. A point-and-shoot video
can be re-beated or hand-tuned exactly like the litefleet storyboard.

Re-pointing never clobbers edits: if `storyboard.json` exists, `c4v point`
writes `storyboard.derived.json` beside it and prints a diff summary; `--force`
replaces. The pointer file itself stays in the project so a series (§ 6.2)
can list its videos as pointers and re-derive them at a new pin.

### 7.4 What is reused and what is new

Reused as planned, unchanged:

- **Ingestion** (§ 3): `bundle.repo` for the repo card (item 4) and blame for
  the optional shoutout (item 5); the pinned checkout and `pinExcerpts` from
  `code-source` for every excerpt the mode emits.
- **The beat registry and patterns** (item 1): the skeleton is a `walkthrough`
  arc over existing roles; `BEATS[role].kinds` and `needs` are what the
  derivation consults to know what each beat may contain.
- **The AI-mapping brief** (item 11): the same generated document, with one
  addendum; the model still reads `BEATS` and `PATTERNS`.
- **Scene kinds**: `repo-card`, `architecture-overview` with `descend`,
  `focus-element`, `follow-request`, `code-explanation`, `gains-card`,
  `credits`. No new kind.
- **The verify gate, both renderers, the act chrome**, as they are.

Genuinely new:

- `Pointer` type and `pointer.json`; the `c4v point` command and its
  `--target` parser.
- `core/src/derive.ts`: pointer → locus → element and view chain → skeleton.
  Pure over the dataset and a tree listing; the only I/O is through
  `code-source` and `ingest/neighbors.ts`.
- `ingest/neighbors.ts`: callers and callees at the pin by `git grep`, ranked.
- The `draft` flag on claims and acts, the verify rule and `--allow-drafts`,
  the proof refusal, and the `DRAFT` ribbon in both renderers.
- The `derived` block and the step-5 bound check.
- The brief addendum and a litefleet fixture: the pointer above must derive a
  storyboard that verify accepts, and its beats 1–3 must land on the same
  element and view the hand-written litefleet storyboard uses.

### 7.5 Worked example: litefleet at `Query`

The pointer in § 7.1 resolves as follows at `release-it/v1-hardened`
(`9367863`): locus `exec.go` lines 130–149, symbol `func (e *Engine) Query`,
which is the existing `query-guards` excerpt; sources `src-23`, `src-42`,
`src-46`, cited by relationships only; element `nd-engine` (deepest endpoint),
view `node-components`, chain `context → containers → node-components`;
neighbours are the callees `Handle` and `acquire` (the latter is the
hand-written `n-acquire` excerpt, which is why item 12's proof expects the
derived deep dive to overlap the authored one) and the callers of `Query`.
A name-only grep at this pin also returns the gateway's `Client.Query` in
`nodeclient/client.go` and its use in `api/handlers.go`, a different method
with the same name: the same-directory ranking pushes them below the engine
hits, but it is the imprecision decision 8 weighs. Gains slots: the `why`
note; the `nd-engine` description ("Epoch check, per-database lanes,
tenant/node limits; 2 second statement deadline"); the five-line doc comment
above `Query` (lines 125–129 at the pin, which says what the function
guarantees about partial writes); and the engine tests that name `Query`.

## 8. Build sequence

Seats follow the repo's conventions: Opus for correctness-sensitive core and
first renderer ports, Sol for supporting code and the second renderer entry
once the first fixes the interface, Luna for data files and docs. Each item is
a fresh agent in its own worktree with a cross-family review, per the global
protocol. Effort: S under half a day, M about a day, L several days.

| # | Item | Scope | Depends on | Effort | Seat | Proof it is done |
|---|---|---|---|---|---|---|
| 1 | **Arc schema + beat registry + patterns** | `schema.ts` (`arc`, `Act.role/variant/optional`), `beats/registry.ts`, `beats/patterns.ts`, arc rules in `validate.ts`, `arcProgressAt` in `play.ts`, `bundle.arc` passthrough | nothing | M | Opus | `npm test` adds arc tests; litefleet storyboard without `arc` still builds byte-identically; a litefleet storyboard **with** a 5-beat `walkthrough` arc over the existing 14 scenes (no new kinds) passes `verify` |
| 2 | **Lower-third act chrome in both renderers** (audit 10) | `LOWER_THIRD` region + layer in Remotion; region + node in Motion Canvas; theme tokens | 1 | M | Opus (Remotion), then Sol (Motion Canvas port) | litefleet re-rendered with the arc from item 1 shows the tracker in both MP4s; both pass `c4v proof`; dumb-views lint passes; stills committed |
| 3 | **End-to-end arc on litefleet** (the early proof) | `repo-card`, `gains-card` scene kinds in core + both renderers; litefleet storyboard gains beat 1 and beat 5 scenes with new takes | 1, 2 | M | Opus | litefleet renders a full 5-beat arc in both renderers from one storyboard; `verify` and `proof` pass; the new takes are committed (TTS spend reported) |
| 4 | **Repo ingestion** (`ingest/repo.ts`, `bundle.repo`, `repoFactsOf`) | git log/ls-tree facts; `repo-card` reads facts instead of storyboard text | 3 | S | Sol | `verify` reproduces `bundle.repo` from the pinned repo; the repo-card shows the commit count and date |
| 5 | **Blame ingestion + credits + `credits` scene kind** (beat 6) | `ingest/blame.ts`, aliases, `creditsOf`, `creditLine`, policy, verify checks, scene kind in both renderers | 3 | M | Opus (core + Remotion), Sol (Motion Canvas) | litefleet gets an optional shoutout beat; `bundle.credits` reproduces from git; a spoken name not in credits fails verify; both renders pass proof |
| 6 | **`architecture` descend + `focus` responsibilities** | `descend` on overview scenes, validation against `detail.diagramId`; responsibilities overlay | 1 | S | Sol | litefleet beat 2 descends context → containers → node-components in both renderers |
| 7 | **Code-evolution scene kind** (audit 11) | `evolutionOf` with a pure line diff in core; Code Hike token transition; Motion Canvas `Code` edits; a litefleet example using `acquire` across two pins (needs a second tag; choose one with Nick) | 1 | L | Opus | a three-state morph renders in both engines from one scene; states' citations differ in sha7; proof passes |
| 8 | **Driver ingestion + `change` pattern + `change-card` + `diff-view`** | `ingest/driver.ts`, snapshot, `driver.base/head` pins, pattern roles, two scene kinds | 1, 5 | L | Opus | a second project (a real litefleet or book-notes PR, chosen with Nick) renders a `change` arc end to end in both renderers; the snapshot sha is verified |
| 9 | **Series machinery** | `series.json`, `--video` builds, theme tokens into the bundle, chapter markers from acts | 3 | M | Sol | two litefleet videos build from one series file; a chapters file matches the timeline's acts |
| 10 | **Convention pattern + `rule-card`** | pattern entry, one kind, docs | 3, 9 | S | Sol | a litefleet "how litefleet guards every query" video renders with three excerpts under one rule |
| 11 | **AI-mapping instructions from the registry** | generate the producer brief (`BEATS`, `PATTERNS`, schema) as a document the mapping step reads; a fixture storyboard it must reproduce | 1, 8 | S | Luna | the brief is generated, not hand-written; `verify` accepts the fixture |
| 12 | **Point-and-shoot entry mode** (§ 7) | `Pointer` + `pointer.json`, `c4v point`, `derive.ts` (locus → element → view chain → skeleton), `ingest/neighbors.ts`, the `draft` flag with its verify rule, `--allow-drafts` and proof refusal, `DRAFT` ribbon in both renderers, `derived` block, brief addendum, litefleet fixture | 3, 4, 6; 11's `walkthrough` half (11 can ship that before 8 lands) | M | Opus (derive, draft rule, bound check), Sol (neighbours, `c4v point`, ribbons in both renderers), Luna (brief addendum, fixture) | `c4v point` on litefleet at `Query` emits a storyboard that `verify` accepts with `--allow-drafts` and rejects without; its beats 1–3 land on `nd-engine` and `node-components` like the hand-written storyboard; after a `claude -p` mapping run and `narrate`, both renderers render it and the DRAFT ribbon is visible in committed stills; deleting the drafts passes `verify` and `proof` clean |

Items 1–3 are the spine and should land first, in order. Items 4, 5 and 6
are independent of each other after 3. Items 7 and 8 are the two L items and
can run in parallel on different seats. 9–11 close the playlist loop. Item 12 is
sequenced after the end-to-end proof (3) and its two small dependencies (4,
6); it needs only the `walkthrough` half of 11, so it can land before the
change pattern (8) and is the first item that makes a video without an
authored storyboard.

## 9. Open decisions for Nick

1. **Credits default.** Should `shoutout` be on by default for every arc, or
   off unless the storyboard asks? (Plan assumes: off in `walkthrough`, on in
   `change`.)
2. **Evolution example pin.** Item 7 needs a second litefleet tag with a
   changed `acquire` (or another symbol). Which tag pair, or should the first
   evolution example come from a different repo?
3. **Change-driven proof repo.** Item 8 needs one real PR or issue with a
   fixing commit. Which repo and PR, and does the GitHub App token path from
   the canvas apply, or is a one-off `gh api` snapshot fine for the proof?
4. **Series file before or after the TigerBeetle dataset?** The playlist in
   § 6.1 cannot start until canvas open decision 4 (C4 dataset: required or
   generated) is settled. Should item 9 wait for that, or ship on litefleet?
5. **Lower-third placement vs captions.** Above the caption row (plan) or
   replacing the view header at the top? A one-frame mock decides it.
6. **Gains draft gate.** Should `verify` fail on any `draft: true` (plan),
   so an unconfirmed point-and-shoot close cannot reach `proof`, or warn and
   rely on the on-screen ribbon? And is confirmation just deleting the flag
   by hand, or a `c4v confirm` that records who and when in `derived`?
7. **Pointers into repos with no C4 dataset.** Refuse (plan: the mode needs an
   element and a view), derive a thinner arc with `architecture` and `focus`
   optional (a new `point` pattern), or generate the dataset first (canvas
   open decision 4)?
8. **Neighbour discovery.** `git grep` at the pin for every language (plan:
   cheap, language-agnostic, imprecise) or Tree-sitter call graphs for the
   languages the mapping sandbox already has grammars for? Also the cap: two
   neighbours by default, or let the `why` note's length set it?
