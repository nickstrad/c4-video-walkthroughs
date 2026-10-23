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
unchanged (an arc-less storyboard is one implicit beat).

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

## 7. Build sequence

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

Items 1–3 are the spine and should land first, in order. Items 4, 5 and 6
are independent of each other after 3. Items 7 and 8 are the two L items and
can run in parallel on different seats. 9–11 close the playlist loop.

## 8. Open decisions for Nick

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
