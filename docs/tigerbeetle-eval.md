# TigerBeetle as a test codebase for the POC demo menu

*2026-10-24, Opus. Asks whether github.com/tigerbeetle/tigerbeetle can feed
the demos in [poc-demo-list.md](poc-demo-list.md), and which of Nick's three
outstanding picks it satisfies. Every number below was measured on
2026-10-24 against `main` at `0450c32b2` (2026-10-14) and release tag
`0.17.10` (`33fa35310`, 2026-10-11), using a blobless clone in `/tmp` and the
GitHub API. Nothing in the framework was changed.*

## Verdict

TigerBeetle satisfies two of Nick's three picks outright and the third in part.
It is a strong repo for the git-driven demos (5, 7, 9 and 10). It cannot feed
anything that draws architecture until someone builds a C4 dataset for it, and
the current schema requires a dataset even for videos that never show one.

| # | Demo | Verdict | Evidence (one line) |
|---|---|---|---|
| 1 | Arc on/off | does not feed | A re-render of the existing litefleet video; a TigerBeetle version would need the full dataset (W1) and a new storyboard, which buys nothing over litefleet. |
| 2 | Two renderers 2-up | feeds with named work | Code Hike highlights Zig as-is (196 tokens, 7 colours on `on_request`); Motion Canvas hard-wires `@lezer/go` (`renderer-motion-canvas/src/code.tsx:9`), so it needs a Zig highlighter (W3), plus W1. |
| 3 | Full six-beat arc | feeds with named work | `repo-card` counts, `architecture` and `focus` all read the dataset; needs W1. Grounding material exists (§ 5). |
| 4 | Honest gains card | feeds with named work | Constants exist in files (`docs/concepts/performance.md`: "up to 8,190 transfers per query"); real before/after numbers exist only in commit messages and PR bodies (`cb518b1e2`: "load accepted = 303328 tx/s"; PR #3250's table: 265,856 → 295,335 tx/s). Evidence excerpts are path-and-blob only, so they need W2. |
| 5 | Shoutout styles | feeds as-is | `on_request` at `0.17.10`: 59 lines by 5 authors (sentientwaffle 26, Isaac Freund 13, batiati 12, Federico Lorenzi 4, Alex Kladov 4). No `.mailmap`, so the folds go in `credits.aliases` (an existing plan field), e.g. `kprotty` = King Butcher and `sentientwaffle` = `djg`. |
| 6 | Point-and-shoot | feeds with named work | This is the plan's "second pointer into a repo with no dataset". It needs decision 7 answered (thinner `point` arc) or W1; `git grep` neighbour discovery works on Zig without a grammar. |
| 7 | Code-evolution | feeds as-is (Remotion); named work for both renderers | `fn on_request` in `src/vsr/replica.zig` grows from 27 to 59 lines, with 9 distinct bodies across 21 sampled release tags (0.13.0 → 0.17.10). Motion Canvas needs W3. |
| 8 | Series pilot + chapters | feeds with named work | The § 6.1 playlist in story-arc-plan is the natural series, but both episodes use architecture beats, so it needs W1. |
| 9 | Change from a commit | feeds as-is | 12 commits quote a VOPR reproduction seed. Examples: `1717efc22` (`zig build vopr -Drelease -- 16386448353927633962`) and `cb518b1e2` (an LSM TOCTOU fix with a written bug analysis and a benchmark). |
| 10 | Change from a real PR | feeds with named work | PR #3778 closes 4 issues, touches 5 files and adds .NET and Java tests. PR #3867 has 3 commit authors and adds a test. The menu requires a repo with a C4 dataset, so it needs W1 (or a stub W0 if the `architecture` beat is skipped, which § 5.2 of the plan allows). |

**Legend.** "Feeds as-is" means the data the demo needs is in TigerBeetle
today, and the framework only needs **W0**, the shared prerequisite below.
"Named work" lists the extra items. Demo 1 is marked "does not feed" because a
TigerBeetle version adds nothing; litefleet remains its input.

**Named work items**

- **W0. Stub dataset (S, a few hours).** `sources.dataset` is a required field
  in `core/src/storyboard/schema.ts:22`, so any TigerBeetle storyboard needs a
  dataset file. Videos with no `architecture` or `focus` beat (demos 4, 5, 7
  and 9) only need a minimal one: a context view with about 5 elements and no
  source selectors. The alternative is to make the field optional, which is
  the decision-7 question.
- **W1. Real C4 dataset (L, several days).** Sized in § 5.
- **W2. Commit-message evidence (S–M).** Add an `evidence` excerpt that pins
  lines of a commit message instead of a file blob. A commit object is
  content-addressed, so the byte check is at least as strong as the blob
  check. PR bodies could reach the same check through the driver snapshot
  that item 8 already plans (`sources/driver.json`).
- **W3. Zig highlighter for Motion Canvas (S, unverified).** There is no
  official `@lezer/zig`. The third-party `codemirror-lang-zig` 0.1.0
  (Lezer-based, last published 2023-09) is a candidate. Nobody has tried it.

## Nick's three picks

| Pick | Satisfied? | Why |
|---|---|---|
| Multi-author repo (demo 5) | **Yes** | 145 distinct author names on non-merge commits, and 167 name/email pairs that fold to 136 people. No `.mailmap`, but the aliasing is real and foldable. |
| Repo that commits benchmark results (demo 4 strong form) | **Partly** | Benchmarks are recorded in commit messages and PR bodies (61 merged PRs mention `tx/s`), not in files. The only benchmark number in a committed file is CHANGELOG.md:390: "a ~8% improvement on the standard benchmark". Needs W2 for the strong form. |
| Meaty merged PR (demo 10) | **Yes, with a caveat** | #3778 meets every criterion except having several authors (1 author, 1 reviewer, plus a separate issue reporter). #3867 and #3618 cover the multi-person side. Caveat: no public PRs have merged since 2026-08-31 (see § 3). |

**Overall:** TigerBeetle is a good second codebase. Use it for the git-side
demos (5, 7, 9, 10) and keep litefleet for the architecture-side ones. It is
not a drop-in replacement for litefleet. Its blocker is the dataset (W0 to
start, W1 for anything that draws architecture), not its git history. The
cheapest useful route is W0 plus demo 5 or 9. That route also answers whether
`sources.dataset` should stay required, which is plan decision 7 in miniature.

---

## 1. Authorship (demo 5)

- **Commits:** 12,944 in total (`git log`), of which 9,924 are not merges.
  The history starts on 2020-04-09 ("Init", Joran Dirk Greef).
- **Distinct authors:** 145 by `git shortlog -sn --no-merges`. 167 distinct
  `(name, email)` pairs fold to **136 people** when pairs that share a name or
  an email are joined. 9 of those people appear under more than one name.
- **Top authors by commit count:** sentientwaffle 2,024; Alex Kladov 1,409;
  Joran Dirk Greef 1,141; batiati 1,120; Federico Lorenzi 478; Fabio Arnold
  477; kprotty 476. 34 people authored commits in the last 12 months.
- **Aliases:** for example, `sentientwaffle`/`djg` (same email);
  `batiati`/`Rafael Batiati` (3 emails); `kprotty`/`King Butcher` (linked
  through `king@coil.com`); `Alex Kladov`/`Aleksey Kladov`; `Joran Dirk Greef`
  with 3 emails; `Lewis Daly` with 4.
- **`.mailmap`:** absent. Plan § 4.2 already allows
  `credits.aliases` in the storyboard, so no framework change is needed.
- **`Co-authored-by`:** 290 trailers, so the item-8 trailer parsing gets real
  input.
- **Blame:** `src/vsr/client.zig` at 0.17.10 spreads across 8+ authors
  (sentientwaffle 266 lines, Joran Dirk Greef 197, kprotty 76, Isaac Freund
  60, …). That is enough for the "and N others" fold to show up.
- **Merges preserve authorship.** PRs land as merge commits (2,631
  first-parent "Merge pull request" commits), so blame names the real
  authors. A `credits.note` for squash merges is rarely needed.

## 2. Committed benchmark or performance numbers (demo 4)

- **In files:** CHANGELOG.md:390 ("~8% improvement on the standard benchmark",
  PR #3619), and constants such as "up to 8,190 transfers per query" and "a
  transfer object is 128 bytes" (`docs/concepts/performance.md`) or "The
  default is 8189" (client READMEs). These support the constants form of
  demo 4, not the before/after form.
- **No results files.** The 15 `*benchmark*` files are harnesses
  (`src/tigerbeetle/benchmark_load.zig` prints `load accepted = … tx/s`).
  Results go to devhub (`src/scripts/devhub.zig` pushes them to
  `tigerbeetle/devhubdb`, which is not public: the API returns 404) and to
  nyrkio.com.
- **In commit messages:** `cb518b1e2` (2025-02-25) has a "Benchmark before"
  block with `load accepted = 303328 tx/s` and p1–p100 batch and query
  latencies. `0adbcbf6a` (`--clients`) has `328409 tx/s`. `7d8c52208` shows
  the current output format.
- **In PR bodies:** #3250 ("LSM: Improve tail latency…") has before/after
  tables on two machine types, e.g. batch latency p99 174 ms → 100 ms.
  61 merged PRs mention `tx/s`.
- **Consequence:** an `evidence` excerpt today is `path` + `blob` + `lines`
  (`core/src/storyboard/schema.ts:59–66`), so none of these numbers can be
  pinned except the CHANGELOG line. That is W2.

## 3. Merged PRs (demo 10)

Scanned: the 800 most recently created merged PRs (merged between 2025-04-14
and 2026-08-31), via GraphQL.

- 14 of 800 (1.75%) formally close an issue. Bugs are mostly found by the
  VOPR, and fixes cite a seed instead of an issue.
- 263 change 2–6 files. 99 of those touch a file with test, fuzz or VOPR in
  its path; Zig tests are often inline `test "…"` blocks, so this undercounts.
- 78 have commits from ≥ 2 authors. 60 have reviews from ≥ 2 people other
  than the author.

**Example PRs**

| PR | Merged | Files | Issue | Tests | People |
|---|---|---|---|---|---|
| **#3778** Client fixes (.NET/Java overflow and GC-handle leaks) | 2026-06-03 | 5 (+75/−6) | closes #3755–#3758 (reported by jf-li00) | `IntegrationTests.cs` +59, `BatchTest.java` | author batiati, approved by sentientwaffle |
| **#3867** state machine: resolve timed pending transfers with imported events | 2026-08-25 | 2 (+39/−2) | none; the body states the bug (replicas crash on a replicated request) | `state_machine_tests.zig` +35 | commits by Chris Salzberg, Mazen Al-Hagri, batiati; approved by batiati |
| **#3618** vsr: jitter repair timeouts | 2026-04-02 | 4 (+57/−24) | none; a VOPR-found resonance, written up in the body | `replica_test.zig` | author chaitanyabhandari; reviews from matklad, sentientwaffle |

For a cold open on the issue, #3778 is the pick. Its four issues give
concrete, quotable problems, such as "Java Batch byte-length overflow truncates
oversized batches". #3206 ("clients hedge request", closes #444, 5 reviewers)
is meatier, but it changes 8 files and 344 lines in `replica.zig`, which is
too much for a 90 s diff.

**Caveat: the public PR flow stopped on 2026-08-31.** From 2026-07-08, `main`
advances mainly through 89 first-parent commits named "Merge commit '<sha>'
into tigerbeetle", authored by `git`. The few later "Merge pull request"
subjects use numbers that do not exist on GitHub (#240 → "Could not resolve
to a PullRequest"). Public PRs are still opened (#3941, 2026-09-30) but not
merged. Commit authorship survives the sync (since 2026-07-08: batiati 53
commits, sentientwaffle 44, Tobias Ziegler 39, …). So: pick PRs from before
September 2026, and do not expect new public PRs to drive future videos.

## 4. Release tags and symbol evolution (demo 7)

- **Tags:** 291 in total. 240 are `0.x.y` releases from `0.13.0`
  (2023-05-04) to `0.17.10` (2026-10-11); 23 are weekly tags and the rest
  are 2023 `release-…` tags.
- **Symbols measured** at 21 tags (every 12th release plus 0.17.10). Each
  row gives the function's line count and the number of distinct bodies:

| Symbol | 0.13.0 | 0.14.167 | 0.16.4 | 0.17.10 | Distinct bodies |
|---|---|---|---|---|---|
| `fn on_request` (`src/vsr/replica.zig`) | 27 | 30 | 41 | 59 | 9 |
| `fn on_prepare` (`src/vsr/replica.zig`) | 83 | 84 | 139 | 226 | 14 |
| `fn create_transfer` (`src/state_machine.zig`) | 112 | 106 | 238 | 268 | 16 |

`on_request` is the demo-7 candidate. It fits on screen, and 4 states (0.13.0
→ 0.14.167 → 0.16.4 → 0.17.1) show it growing. The other two are too long to
show whole and would need sub-ranges.

**Zig and the excerpt pinning.** Zig methods are indented inside their
struct. The existing fields handle this, so no core change is needed: `symbol`
is matched with `startsWith`, so it carries the indent
(`"        fn on_request("`), and `wholeFunction` uses the existing
`closing` field set to the indented `"    }"`.

## 5. The C4 dataset problem (plan decision 7)

TigerBeetle has no C4 dataset. The in-repo sources a dataset could be derived
from, measured with `wc -w`:

- `docs/ARCHITECTURE.md`, 6,361 words. Its "Overview" walks the request path
  (client → primary → prepare → WAL → replicate → `prepare_ok` → commit →
  execute → LSM forest → superblock checkpoint), which is close to a ready
  dynamic view. Its 26 "Design Decisions" sections are `focus` and `gains`
  narration.
- `docs/internals/`: vsr.md 2,346 words, lsm.md 2,173, data_file.md 1,412,
  sync.md 1,194, upgrades.md 632, testing.md 565, vopr.md 540.
  `TIGER_STYLE.md` has 4,244 words. In all, 27,772 words across architecture,
  internals and concepts docs.
- **Diagrams:** exactly one, a Mermaid `sequenceDiagram` of the VSR Normal
  protocol (`docs/internals/vsr.md:83`). It maps directly to a C4 dynamic
  view. There are no SVG, draw.io or Excalidraw files.
- **Code layout** suggests the containers and components: `src/vsr` (28
  files, 33.8k lines), `src/lsm` (40 files, 26.1k), `src/io` (6 files, 7.3k),
  `src/state_machine*` (3.2k), and `src/clients` with 7 language clients (c,
  dotnet, go, java, node, python, rust, ruby).

**How big the derivation is.** litefleet's dataset
(`framework/projects/litefleet/sources/litefleet.dataset.json`, 138 KB)
covers 7,005 lines of Go in 53 files. It has 49 elements, 84 relationships, 7
views, 102 source selectors and 7 documents. TigerBeetle has 161,990 lines of
Zig in 247 files, 23 times as much code, so the dataset has to be scoped, not
exhaustive. A useful scope would cover:

- context (application, cluster, operator)
- containers (replica, clients, data file, CDC, VOPR)
- two or three component views (VSR replica; LSM forest; state machine with I/O)
- the normal-protocol dynamic view

That comes to roughly 40–60 elements and about 100 selectors pinned at
0.17.10, the same order as litefleet. The prose already exists. The work is
choosing element boundaries and pinning the selectors line by line: **L,
several days**, mostly selectors. With W0 (a stub), demos 4, 5, 7 and 9 can
start without waiting for it.

## 6. Practicalities

- **Size and clone cost:** GitHub reports 58,117 KB. A `--depth=1` clone took
  0.85 s (2.4 MB `.git`). A blobless full-history clone has a 14 MB `.git` and
  an 11 MB checkout (620 files). Blame on a blobless clone is slow because it
  fetches blobs one at a time: 4 min 8 s for 59 lines of `replica.zig`, 44 s
  for `client.zig`. Ingest should use a full clone (about 57 MB).
- **Language:** Zig is 6.36 MB of 8.01 MB (79%) by GitHub's byte count,
  followed by Java 0.53 MB, Rust, C#, Python, Go, C, TypeScript and Ruby.
- **Highlighting:** Remotion/Code Hike 1.1.0 bundles a Zig grammar
  (`@code-hike/lighter` 1.0.1 `dist/grammar/zig.mjs`). `prepare.mjs` falls
  back to the file extension, so `.zig` → `zig` works without edits; this was
  checked by highlighting a real excerpt. Motion Canvas is Go-only today (W3).
- **License:** Apache-2.0, so excerpts can be quoted on screen with
  attribution.
