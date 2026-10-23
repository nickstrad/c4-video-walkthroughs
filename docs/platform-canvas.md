# Platform canvas: the four POCs on an all-Vercel video platform

*Written 2026-10-23 by Opus. It checks the four proofs of concept against
Nick's platform sketch. Every platform limit quoted here was read from the
official documentation on 2026-10-23 (see [Sources](#sources)). Every POC fact
comes from that POC's `NOTES.md`.*

**The sketch, unchanged.** A Next.js app on Vercel with Postgres (Neon,
through the Vercel Marketplace) is the front door. Users sign up, register a
GitHub repo and request a walkthrough. HTTP handlers only enqueue work and
report status. A durable workflow (Vercel Workflow; Inngest is the
alternative) drives the pipeline. Heavy compute runs in Vercel Sandbox
microVMs against the repo at a pinned commit, and the finished MP4 goes to
Vercel Blob.

**The short answer.** The sketch holds up. Two documented limits shape it:

1. **A workflow step cannot hold a render.** A step runs as a Vercel
   Function, which has a hard limit of 800 s on Pro (1800 s in beta) and
   300 s on Hobby. A 4–6 minute walkthrough takes roughly 15–35 minutes to
   render at the speeds the POCs measured. So the sandbox runs the render
   *detached*, and the workflow waits on a hook without using any compute.
2. **Hobby is a demo tier only.** It allows 5 Active CPU hours a month,
   45-minute sandbox sessions and 10 concurrent sandboxes. That is enough
   for a handful of full-length videos a month. Anything beyond that needs
   Pro.

| Option | Fit | Effort to platform-ready |
|---|---|---|
| 1 — Code Hike + Remotion | **clean** | **S** |
| 2 — Motion Canvas | workable with effort | **M** |
| 3 — Playwright + VHS + Remotion | **poor** as a general path; workable as an opt-in add-on | **L** |
| 4 — Slidev + Magic Move | workable with effort | **M** |

**Orchestrator:** Vercel Workflow.

---

## 1. Reference architecture

```
 Browser ──HTTP──► Next.js on Vercel (route handlers, server actions)
                     │  writes job row, calls start(videoWorkflow, [jobId])
                     │  reads status from Postgres; never renders
                     ▼
               Postgres (Neon)  ◄──── status/step/artifact rows ────┐
                     │                                              │
                     ▼                                              │
            Vercel Workflow run  (one per job, durable, replayed)   │
   ┌───────────────────────────────────────────────────────────────┐│
   │ admit ─► prepare ─► ingest ─► mapping ─► [approve?] ─► assets ││
   │   ─► narration ─► render (detached; wait on hook) ─► publish  ││
   └───────┬──────────────────────────────┬────────────────────────┘│
           │ short steps (Functions)      │ Sandbox SDK calls        │
           ▼                              ▼                          │
   Claude / ElevenLabs APIs     Vercel Sandbox microVM (custom image)│
                                 repo cloned at pinned SHA           │
                                 extract → layout → render → ffmpeg ─┘
                                        │ put() MP4, frames, JSON
                                        ▼
                                  Vercel Blob ──► playback / download
```

### Job model (Postgres)

Postgres is the product's source of truth. Workflow observability is for
operators; users read only Postgres.

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, github_login | Auth through GitHub OAuth. |
| `github_installations` | user_id, installation_id | A GitHub App gives scoped, short-lived clone tokens for private repos. |
| `projects` | id, user_id, repo (`owner/name`), diagram_path, default_ref | `diagram_path` names the C4 source in the repo (JSON, Mermaid or Structurizr). |
| `jobs` | id, project_id, **commit_sha**, kind (`overview`/`technical`), renderer (`opt1`…), status, workflow_run_id, sandbox_name, cost_cents, error | The SHA is resolved from the ref *at request time* and frozen. That freezing is the provenance guarantee. Add a unique key on (project, sha, kind, renderer, storyboard hash) so repeat requests reuse earlier work. |
| `job_steps` | job_id, step, status, attempt, started_at, finished_at, metrics (jsonb) | One row per workflow step. `metrics` holds things like render seconds, frames, tokens, characters. |
| `artifacts` | job_id, kind (`storyboard`, `snippets`, `audio`, `captions`, `mp4`, `frame`), blob_url, sha256, bytes, duration_s | Every stage writes its output here. Retries rehydrate from these rows. |

### Step graph: where each step runs and why

| Step | Runs in | Why |
|---|---|---|
| **admit** | Workflow step (Function) | Checks global and per-user caps in Postgres. If full, it sleeps and retries. Vercel Workflow documents no per-key concurrency control (I found none), so admission lives in Postgres. |
| **prepare** | Workflow step → `Sandbox.create` | Creates a non-persistent sandbox from a custom image, with a `git` source at the pinned `revision`. The step only issues SDK calls, so it finishes in seconds. |
| **ingest** | Sandbox command | Reads the C4 source and source selectors with `git show <sha>:<path>`, as every POC's extractor already does. The sandbox has the repo; a Function does not. |
| **mapping** (AI) | Sandbox, detached command running the Claude Agent SDK | The agent needs repository tools: grep, Tree-sitter, file reads. Model wait time is not billed as Active CPU. Its output is `storyboard.json`, uploaded to Blob. Agent sessions can run past 800 s, so this step must be detached too. |
| **validate** | Sandbox command | Schema check plus the POCs' extractor checks: the tag resolves to the SHA, blob hashes match, ranges fall inside the function, and declaration lines match. A failure here throws `FatalError`, because retrying the same storyboard cannot fix it. |
| **approve** *(optional)* | Workflow hook | Waits for a human to approve the storyboard before money is spent on TTS and render (see [Open decisions](#9-open-decisions-for-nick)). |
| **narration** | Workflow step (Function) | Calls the ElevenLabs timestamps endpoint per line and writes audio and cue JSON to Blob. These are short HTTP calls with no binaries. Audio durations become scene durations. |
| **assets** | Sandbox | Code extraction, diagram layout (elkjs), highlighting, and option-specific captures. |
| **render** | Sandbox, **detached** | Start the command, record `cmdId`, then `await` a hook. When done, the sandbox POSTs to `/api/jobs/:id/callback`, which calls `hook.resume`. A slow fallback poll catches a sandbox that dies silently. |
| **publish** | Sandbox → Blob, then Workflow step | The sandbox uploads the MP4 and frames to Blob; the step records artifacts and marks the job done. It also stops the sandbox. YouTube upload is a later, separately approved step. |

**Passing data between steps.** Pass Blob URLs, not bytes. Workflow allows
50 MB per step input/output, but the run state has a 2 GB limit and slows
down past 1 GB.

**Failure and retries.** Steps retry 3 times by default. Completed steps are
replayed from the event log rather than re-run. One sandbox serves the whole
job. Because each stage checkpoints its outputs to Blob, a retry that finds
the sandbox gone can create a fresh one and rehydrate from the `artifacts`
rows. Job sandboxes are created with `persistent: false`. A persistent
sandbox (the default) snapshots on every stop and bills Snapshot Storage.

**Status and observability.** Each step writes `job_steps` rows at its start
and end. The UI polls a cheap `GET /api/jobs/:id` that reads Postgres. Render
progress comes from the sandbox command's log stream (`Command.logs()`): a
step can sample it, or the render script can POST progress to the same
callback route. Operators use the Workflows observability tab (every step,
input, output and error is recorded) and the Sandboxes dashboard.

**Scaling.**
- `start()` is cheap, and queued runs are unlimited, so request spikes simply
  queue.
- Only **admit** throttles. Mapping and render sandboxes run concurrently, up
  to the admission cap.
- The hard ceilings are far away: 10,000 concurrent sandboxes on Pro, and a
  vCPU allocation rate that starts at 150 vCPUs/min (18 × 8-vCPU sandboxes)
  and ramps to 5,000.
- What actually limits throughput is spend (§8). The caps exist to bound
  money, not capacity.

---

## 2. Orchestration: Vercel Workflow vs Inngest

| Concern for this workload | Vercel Workflow | Inngest |
|---|---|---|
| Long renders | No step can hold a render: the step runs as a Function (800 s on Pro). Run duration and `sleep` have **no limit**, and hooks wait without using compute. | Same constraint. Inngest's own ceiling is 2 h per step, "subject to the function host's shorter timeout", which on Vercel is the same 800 s. `step.waitForEvent` covers the wait. |
| Sandbox hand-off | `defineHook` plus an API route that calls `hook.resume`. The run lives in the same deployment as the app. | The sandbox sends an Inngest event; `waitForEvent` matches it with a CEL expression. Works, but needs one more vendor's keys in the sandbox. |
| Step caching | Step inputs and outputs are recorded in an event log and replayed deterministically. Payload limit **50 MB**. | Step results are memoized. Step output limit **4 MiB**; run state **32 MiB**. Either is fine if steps pass Blob URLs. |
| Retries | 3 by default; `maxRetries`, `FatalError`, `RetryableError(retryAfter)`. | Configurable retries. Equivalent. |
| Flow control | **Nothing documented for per-key concurrency.** Build it in Postgres (the *admit* step). | **Built-in concurrency keys** (`key: "event.data.accountId"`), and waiting steps don't hold a slot. This is Inngest's real advantage for multi-tenant fairness. |
| Ops and cost | In the Vercel dashboard, with no extra account. $0.02 per 1K events; a normal step costs 3 events, so one job is roughly 50–200 events, about $0.001–0.004. | A separate account. Free tier: 5 concurrent steps, 50k executions. Pro starts at **$99/mo** with 100 concurrent steps. |

**Recommendation: Vercel Workflow.** It has the same long-render constraint
as Inngest, solved the same way (a detached sandbox plus a hook). It is
native to the all-Vercel stack, allows payloads 12× larger, and costs pennies
at POC volume. Inngest's one clear win, per-tenant concurrency keys, takes
about 30 lines of Postgres admission code for a platform with few tenants.
Revisit Inngest only if the platform becomes truly multi-tenant and fair
scheduling starts to matter.

---

## 3. Sandbox constraints (from the docs) and what each one decides

| Constraint (as documented) | Value | What it permits or rules out |
|---|---|---|
| Max session duration | **Hobby 45 min; Pro/Ent 24 h** | Pro fits any walkthrough. On Hobby, a 6-minute Option 3 video (about 36 min of render plus capture and setup) is at the edge. *Remotion's page says "5 hours on the Pro and Enterprise plans"; Vercel's own pricing page says 24 h and is the authority.* |
| Default timeout | **5 min**; set with `timeout`, extend with `extendTimeout()` | Every job sandbox must set an explicit timeout sized to the render, or it dies at 5 minutes. |
| vCPU / memory | 1 or an even number from 2–32 vCPUs, **2 GB per vCPU**; max Hobby 4/8 GB, Pro 8/16 GB | The POCs peaked at 265–650 MB RSS plus one Chromium. 4 vCPU / 8 GB is the right default, and 8 vCPU helps only Remotion (parallel frames). |
| Disk | **64 GB** ephemeral NVMe | Plenty. The largest `node_modules` (Option 1) is 866 MB including Chrome. |
| Images | Managed images are Ubuntu-based (`ubuntu:26.04`), plus **custom OCI images from VCR, `linux/amd64` only**; `ENTRYPOINT`/`CMD` are not run | Bake Chromium, FFmpeg, fonts and the `node_modules` of each toolchain into one custom image. This removes Option 1's 3 min 23 s Chrome download and Option 4's 2 min cold install from every job. Every POC binary is amd64. |
| Snapshots | Expire **30 days after last use**; $0.08/GB-month; region-bound | Use the custom image for the toolchain, not snapshots. Snapshots suit a warm per-repo cache (e.g. a Go module cache for Option 3). |
| Persistence | **On by default**; every stop snapshots | Job sandboxes must pass `persistent: false`, or each job leaves a billed snapshot behind. |
| Concurrency | **Hobby 10; Pro 10,000** | Never the bottleneck on Pro. |
| Active CPU | **Hobby 5 h/month included**; Pro $0.128 per vCPU-hour | A render is CPU-bound, so it bills close to wall time × vCPUs. One 25-minute render at 4 vCPUs is about 1.5–1.7 CPU-hours, so Hobby covers roughly **3 renders a month**. |
| Network | Egress `allow-all` by default; `deny-all` or a domain allow-list; downloads are free | The mapping sandbox allows only the Anthropic API and GitHub. The render sandbox allows only Blob and the callback URL. Option 1's highlight step already runs offline. |
| Git source | `source: {type:'git', url, revision, depth, username, password}` | The pinned SHA goes straight into `revision`. Option 4 needs **three** revisions (v0, lesson-02, v1), so it needs history, not `depth: 1`. |
| Commands | `runCommand({detached:true})` → `Command`; `logs()` streams; `wait()`; `sudo` | This is the detached-render pattern. Logs give render progress. |
| Workflow step time (Functions) | **Hobby 300 s; Pro 800 s, 1800 s beta** | No synchronous render inside a step. Every sandbox-heavy stage is detached plus a hook. |
| Function body | **4.5 MB** request/response | Never stream an MP4 through a route handler. Serve Blob URLs (Blob reads support byte ranges, which the Pages site already relies on). |

Unverified: whether Playwright's bundled Chromium installs cleanly on the
managed Ubuntu 26.04 image. To avoid the question, base the custom image on
Microsoft's Playwright image, which ships Chromium and its libraries, and
push it to VCR.

---

## 4. Option 1 — Code Hike + Remotion

**How it renders today.** Node 22 only. Remotion 4.0.538 drives its own
Chrome Headless Shell and bundled FFmpeg; no system FFmpeg is needed. The
25 s, 750-frame 720p video took **76–122 s** at `--concurrency=2` on a shared
4-vCPU box (about 3–5× realtime). Peak RSS was about 650 MB, and
`node_modules` is 866 MB. The first still downloaded Chrome (**3 min 23 s**).
It ran fully unattended from the CLI, with no display and no tty. Code Hike
highlighting was moved into a Node script because the browser build fetched
themes from `lighter.codehike.org`. Renders are now offline.

**Mapping to the steps.**

| Step | Option 1 piece |
|---|---|
| ingest | `scripts/extract.mjs` (`git show`, all six validity checks) |
| mapping | emits `storyboard.json` (the shape already exists) |
| assets | `layout.mjs` (elkjs), `highlight.mjs` (Code Hike) |
| narration | replaces `cues` in `src/storyboard.ts`; scene durations come from audio |
| render | `renderMedia` through `@remotion/renderer`, or `@remotion/vercel` |

**What it takes.**
- Make the extractor's inputs parameters. It reads
  `/root/Software/book-notes` or `BOOK_NOTES`. Point it at the sandbox
  checkout (`/vercel/sandbox`) and a `diagram_path`.
- Switch from CLI renders to `bundle()` once, then `renderMedia` /
  `renderStill`. The NOTES already call for this, because each CLI still
  re-bundles (about 30 s).
- Bake Chrome Headless Shell and `node_modules` into the custom image.
- Optionally adopt Remotion's first-party **`@remotion/vercel`**:
  `renderMediaOnVercel({detached: true, vercelBlob})` renders inside the
  sandbox and uploads straight to Blob, and `getRenderProgress()` reports
  progress. It does not cover the extract, layout and highlight steps, so
  those still run as sandbox commands first.
- Add an `<Audio>` track per scene once narration exists.

**Friction and risks.**
- *Render time vs the step limit.* At 3–5× realtime, a 5-minute video takes
  15–25 minutes, over the 800 s step limit. Detached render plus a hook is
  mandatory. Remotion's detached mode matches this pattern.
- *Licence.* Remotion is free for an individual or an organisation of up to
  3 people. A company of 4 or more, or a productised service, needs a licence:
  "Automators" costs $0.01 per successful render with a **$100/month
  minimum**. That is free for Nick's portfolio, but a real cost if this
  becomes a product.
- *Network.* Keep highlighting in Node. Calling `highlight()` at render time
  would fail under a `deny-all` network policy.
- *Legibility.* Edge labels are about 7 px at 720p, so render at 1080p. That
  costs about 2.25× the pixels and more render minutes.

**Verdict: clean · S.** Everything already runs headless. The only platform
work is packaging and parameterising, and Remotion has a documented
Vercel Sandbox path.

---

## 5. Option 2 — Motion Canvas

**How it renders today.** Motion Canvas 3.17.2 renders in the *editor
page*. `scripts/render.mjs` starts Vite programmatically, opens `/?render`
in headless Playwright Chromium and waits for `#render[data-rendering]` to
clear and the MP4 to stop growing. Frames stream to the Vite server, which
pipes them to the static FFmpeg from `@ffmpeg-installer/ffmpeg`. The 26.6 s,
798-frame video took **92–132 s** wall time (156 s cold), about 3.5–5×
realtime. The Node process used about 265 MB plus Chromium, and
`node_modules` is 303 MB. It ran fully unattended, with no display. Output
was **byte-identical** across repeat renders.

**Mapping.** Ingest → `extract.mjs` (blob-SHA checks). Mapping → the
storyboard JSON (not TSX; the NOTES are firm on this). Assets → snippets plus
**layout, which does not exist yet**: node positions are a hand-written
`POS` table for seven nodes. Narration → `audio` in `makeProject`,
`includeAudio: true`. Render → `render.mjs`.

**What it takes.**
- **Generate the layout** from the C4 JSON (reuse Option 1's elkjs layout).
  Without it, Option 2 cannot render any repo but litefleet. This is the bulk
  of the M.
- Harden the render harness, as the NOTES list: a free port, `project.meta`
  per output size, output name per job, a timeout and retry, and browser
  errors surfaced as failures. Redirect stdout to a file; piped output lost
  log lines in two runs.
- Bake Chromium, fonts (output depends on installed fonts; DejaVu was used
  here) and a pre-bundled Vite cache into the image. That removes the cold
  156 s run.
- Build generic scene interpreters (`follow-request`, `state-change`,
  `code-explanation`) and multi-scene projects for overview-length videos.

**Friction and risks.**
- *An undocumented render trigger.* The `?render` query parameter was found
  by reading `@motion-canvas/ui/dist/main.js`. A minor upgrade can remove it,
  so pin the version and keep a render smoke test in the image build.
- *Single-browser, sequential frames.* Unlike Remotion, it does not use extra
  vCPUs. A 5-minute video takes about 17–25 minutes whatever the sandbox
  size, so it is always a detached render.
- *An editor page as a renderer.* A harmless `virtual:settings` timeout error
  appears in every run. Error detection must allow-list it without masking
  real failures.
- *An upside.* Byte-identical output means a content hash of
  (storyboard, image digest) can skip a re-render entirely.

**Verdict: workable with effort · M.** It packages cleanly into a sandbox.
The effort is the missing generic layout and a fragile, undocumented render
trigger.

---

## 6. Option 3 — Playwright + VHS + Remotion

**How it renders today.** Three toolchains and four binaries:

- **Playwright** headless Chromium records the live diagrams site, served
  locally from a copy of book-notes `pages/dist`.
- **VHS 0.10.0**, built with Go and needing **ttyd** plus **FFmpeg**, runs
  `go test` on the pinned repo inside a terminal. Root Chromium inside VHS
  needs `VHS_NO_SANDBOX=true`.
- **Remotion** composes the result.

Shell scripts post-process with system `ffmpeg`. The 31.4 s video took a
**185 s** render (about 6× realtime, max RSS 468 MB). On top of that come the
captures, which play in real time (a 14.4 s browser take and a 5.4 s
terminal take), a Go build-cache warm-up, and `normalize.mjs`, which writes
the measured clip lengths back into the storyboard. Everything was headless;
VHS supplies its own pseudo-terminal through ttyd. Two values were set **by
inspection**: the terminal PASS-line highlight box, and the cut points chosen
from the action log.

**Mapping.** Ingest → `prepare.mjs`, which needs *the diagram site* as well
as the dataset. Mapping → storyboard plus *recording scripts* (Playwright
actions, a VHS tape). Assets → **run the user's software**: serve the site,
run the tests, record. `normalize` must run *before* narration fitting,
because the captured clips fix their own lengths. Render → Remotion, then
`finalize.sh` strips the silent AAC track.

**What it takes.**
- A **per-repo runtime environment**. The POC needed Go 1.26 for one Go
  repo. An arbitrary user repo needs its own language toolchain, dependency
  install, build and start command: a "devcontainer for every repo" problem.
  Snapshots per repo help with warm caches; they don't solve detection.
- A hosted, **pinned diagram site** to record. The POC recorded Nick's
  book-notes site, whose build commit was never established. Other users have
  no such site, so the platform would have to build and serve one, or drop
  the "where" act.
- AI-written Playwright and VHS scripts that work on the first run against
  an unseen app, plus automatic replacements for the two by-inspection
  values (a terminal-grid-derived highlight; cuts from the action log).
- An image with Go (and other toolchains), ttyd, VHS, FFmpeg, Chromium and
  Remotion. It is the heaviest image of the four.

**Friction and risks.**
- *Running untrusted user code with secrets nearby.* Running the user's
  tests or server is what the sandbox exists for. But that code must never
  share a sandbox with the Anthropic or GitHub tokens used by mapping. It
  needs its own sandbox with `deny-all` or a narrow allow-list. That means a
  second sandbox per job.
- *Duration.* About 6× realtime for the render alone. A 6-minute video is
  about 36 minutes of render plus capture and setup, which breaks Hobby's
  45-minute session.
- *Real-time capture is non-deterministic.* Playwright's video ran about one
  frame ahead of the wall-clock log, and VHS wrote 25 fps despite
  `Set Framerate 30`. Every re-record means re-measuring.
- *Coverage.* Many repos have no UI or CLI worth demonstrating, and many
  test suites need services such as Docker or databases. Option 4 avoided
  Docker/Toxiproxy for exactly this reason.

**Verdict: poor as a general path · L.** The composition half is Option 1's
Remotion and ports cleanly. The capture half depends on knowing how to run
each user's software, so make it an opt-in "demo recipe" a project declares
(commands, port, test target). That is the overview's suggested path:
Option 1 first, with Option 3's recorders added later.

---

## 7. Option 4 — Slidev + Shiki Magic Move

**How it renders today.**
- `scripts/sources.mjs` extracts pinned ranges from three tags.
  `slides.template.md` generates `slides.md`.
- `record.mjs` runs a Slidev **static build** (14.4 s), serves it with
  `vite preview` on localhost, warms and screenshots every click state in
  headless Chromium, then **records in real time** with Playwright
  `recordVideo` on a fixed schedule.
- **System FFmpeg** trims and encodes.

The full run (build, warm-up, recording, encode, frames) took **107.6 s** for
38.5 s of video. The cold dependency install took about 2 minutes. It ran
headless, with no display. The schedule is hard-coded in `storyboard.md` and
`record.mjs`. The diagram is a pre-rendered **PNG** from book-notes evidence,
cropped with CSS.

**Mapping.** Ingest → `sources.mjs` (tag-drift checks; needs multiple
revisions). Mapping → a Markdown deck from a template, the cheapest format
for an LLM to emit. Assets → excerpts plus a **diagram image that must now be
rendered** from the C4 source. Narration → voice clips drive the click
schedule; at present, the notes read aloud need about twice the caption
timings. Render → `record.mjs` plus FFmpeg.

**What it takes.**
- Replace the fixed schedule with a timing file that narration and browser
  actions share (as the NOTES list), and generate `slides.md` from a
  storyboard schema.
- Add a diagram render step. Reuse Option 1's elkjs layout to export an SVG
  or PNG of the selected subgraph at high resolution, which also fixes the
  unreadable edge labels.
- Mux audio (`ffmpeg`) and export subtitles.
- Bake FFmpeg, Chromium and the correct Playwright FFmpeg helper into the
  image. The NOTES record that Playwright 1.61.1 needed its own
  FFmpeg 1011, and that a browser install once garbage-collected a shared
  Chromium. A pinned image removes both hazards.
- Clone with enough history to reach every revision the deck morphs through.

**Friction and risks.**
- *Real-time recording, not frame rendering.* Click delays reached
  0.21–0.23 s under load, and the NOTES call it non-deterministic. A
  dedicated sandbox removes neighbour load. Size it to at least 2 vCPUs so
  that Chromium, `vite preview` and the recorder don't starve each other.
  Output cannot be content-hashed for caching.
- *Floor on duration.* Recording can never beat 1× plus the warm-up pass. It
  is still the fastest option measured (about 2.8× including build), so a
  5-minute deck is about 14 minutes, still over the 800 s step limit.
  Detached render.
- *Slidev quirks.* Its dev server failed under repeated captures, so stay on
  the static build. `?print` in any form switches to print mode. A
  FloatingVue error is caught and logged on every run.

**Verdict: workable with effort · M.** It packages easily and has the
cheapest mapping output. The effort is making the schedule data-driven and
adding a diagram renderer. Live recording stays a quality risk.

---

## 8. Cost and scaling drivers

Per-video estimates for a **5-minute technical walkthrough at 720p**. The
render ratios are the POCs' measurements on a shared 4-vCPU box. The token
and character counts are my assumptions, labelled as such.

| Driver | Basis | Per video |
|---|---|---|
| **Sandbox, render** | 4 vCPU / 8 GB, about 90% CPU: CPU 4 × 0.9 × $0.128 + memory 8 × $0.0212 ≈ **$0.63/hour** | Opt 1 ≈ 15–25 min → $0.16–0.26 · Opt 2 ≈ 17–25 min → $0.18–0.26 · Opt 3 ≈ 30–40 min, two sandboxes → $0.35–0.45 · Opt 4 ≈ 14 min → $0.15 |
| **Sandbox, mapping** | 2 vCPU / 4 GB, mostly waiting on the model: Active CPU is near zero, so memory dominates, at $0.085/hour | 10–20 min → about $0.02–0.03 |
| **LLM, mapping** *(assumption)* | Opus 5.5: $4/MTok input, $0.20/MTok cache hits, $20/MTok output. Assume about 2M input tokens (90% cache hits) and 50k output for an agent exploring a repo | about **$0.36 + $0.80 + $1.00 ≈ $2**; about $1 on Sonnet 5.5 ($2 / $10 per MTok) |
| **TTS** | ElevenLabs v3 / Multilingual v2 at **$0.08 per 1K characters**; Flash at $0.04. 5 minutes ≈ 750 words ≈ 4,500 characters | about **$0.36** (Flash $0.18). Each regeneration after an edit pays again. |
| **Workflow** | $0.02 per 1K events; about 50–200 events per job | under $0.01 |
| **Blob** | The POCs encode at 0.26–0.58 Mb/s, so 5 minutes ≈ 10–22 MB. Storage $0.023/GB-month; transfer about $0.05/GB (iad1 example) | Storage is negligible (1,000 videos ≈ 22 GB ≈ $0.51/month). 1,000 views ≈ $1.10. YouTube carries the real audience. |
| **Remotion licence** (Opt 1/3) | Free for Nick. Productised: $0.01 per render, $100/month minimum | $0 now; $0.01 + minimum later |

**A video costs about $2.50–3.** About 70–80% of that is the **LLM mapping
step**, not compute. Render minutes are a rounding error until 1080p or
long-form batches.

**What breaks first as usage grows:**
1. **Hobby quotas, immediately.** 5 Active CPU hours a month is about
   3 renders. Then come the 45-minute sessions, Blob's 1 GB, and the 300 s
   Function limit. Hobby stops new sandboxes outright when the quota runs
   out.
2. **LLM spend and quality**, at tens of videos a month. Mapping cost grows
   with repo size and agent turns. Each unreviewed storyboard risks a
   published false claim (Option 1's "ten vs six responsibilities" slip
   passed every code-anchor check).
3. **The ElevenLabs plan cap.** Creator includes 275k characters a month,
   about 60 five-minute videos; edits multiply it.
4. **Per-repo environments** (Option 3 only). Failure rates rise with every
   new language or test harness.
5. Platform ceilings come much later: sandbox concurrency (10,000), Blob
   operation rates (Pro 75 advanced ops/s), Workflow run creation
   (1,000/s). None is near.

---

## 9. Open decisions for Nick

1. **Plan tier.** Hobby cannot run this beyond a demo (§3, §8). Pro is
   $20/month with that amount in usage credit. *Recommendation: Pro before
   any user-facing launch.*
2. **Human approval gate.** Should every job pause after mapping for a
   storyboard review (a Workflow hook) before paying for TTS and render, and
   before anything goes out under a user's name? It costs latency and buys
   correctness. *Recommendation: on, at least for the POC platform.*
3. **Multi-tenancy.** Is this Nick-only (one GitHub user, his repos), invited
   users, or open sign-up? Open sign-up adds per-user spend caps, abuse
   controls on mapping (an LLM agent on arbitrary repos) and a stronger case
   for Inngest's concurrency keys. Nick-only needs none of that.
4. **Diagram input contract.** All four POCs read Nick's book-notes C4 JSON
   with source selectors. Do registered repos have to provide that format,
   or should the platform also generate C4 from the code? The answer changes
   the ingest step's scope more than any renderer choice does.
5. **Option 3's role.** Opt-in demo recipe per project, or drop it from v1?

The orchestrator is *not* an open decision; the evidence favours Vercel
Workflow (§2).

---

## Sources

All read 2026-10-23.

- Vercel Sandbox overview and system specs — https://vercel.com/docs/sandbox
- Sandbox pricing, resource, runtime, concurrency and API quotas — https://vercel.com/docs/sandbox/pricing
- Sandbox images (managed images, VCR custom images, `linux/amd64`) — https://vercel.com/docs/sandbox/concepts/images
- Sandbox snapshots — https://vercel.com/docs/sandbox/concepts/snapshots
- Sandbox persistence (`persistent: false`) — https://vercel.com/docs/sandbox/concepts/persistent-sandboxes
- Sandbox JS SDK (`git` source, `runCommand` detached, `logs`, `networkPolicy`) — https://vercel.com/docs/sandbox/sdk-reference
- Vercel Workflows — https://vercel.com/docs/workflows
- Workflow concepts (steps, sleep, hooks, skew protection) — https://vercel.com/docs/workflows/concepts
- Workflow pricing and limits — https://vercel.com/docs/workflows/pricing
- Workflow SDK errors and retries — https://workflow-sdk.dev/docs/foundations/errors-and-retries
- Vercel Functions limits (duration, memory, 4.5 MB body) — https://vercel.com/docs/functions/limitations
- Vercel Blob pricing and limits — https://vercel.com/docs/vercel-blob/usage-and-pricing
- Postgres on Vercel (Marketplace; Vercel Postgres moved to Neon) — https://vercel.com/docs/postgres
- Inngest usage limits — https://www.inngest.com/docs/usage-limits/inngest
- Inngest pricing — https://www.inngest.com/pricing
- Inngest concurrency — https://www.inngest.com/docs/guides/concurrency
- Inngest `step.waitForEvent` — https://www.inngest.com/docs/reference/functions/step-wait-for-event
- Remotion on Vercel Sandbox — https://www.remotion.dev/docs/vercel-sandbox and https://www.remotion.dev/docs/vercel/render-media-on-vercel
- Remotion terms (licence threshold, Automators pricing) — https://www.remotion.dev/docs/terms
- Claude API pricing — https://platform.claude.com/docs/en/about-claude/pricing
- ElevenLabs API pricing — https://elevenlabs.io/pricing/api

**Not verified:**
- Per-key concurrency in Vercel Workflow (none found).
- Playwright Chromium support on the managed Ubuntu 26.04 image.
- Whether ElevenLabs' timestamps endpoint costs more than plain TTS.
- How Remotion render speed scales from 2 to 8 vCPUs in a sandbox. The POC
  measured only `--concurrency=2` on a shared box.
