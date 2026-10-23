# Reusable work scripts

Run from this POC directory, using Node 22.23.2 and `npm ci`.

| Script | Purpose | Entry point |
|---|---|---|
| `scripts/sources.mjs` | Extract pinned ranges, reject tag drift, generate code and citations in the deck | `npm run sources` |
| `scripts/narrate.mjs` | Generate one ElevenLabs take (MP3 + character alignment) per slide from `narration/script.json`; reuses saved takes, never re-calls the API for them | `npm run narrate` |
| `scripts/record.mjs` | Build Slidev, serve static output, warm and inspect scenes, record timed slides/clicks, encode 720p MP4, extract frames and telemetry | `npm run record` |
| `evidence/provenance-check.py` | Independently compare manifest, hashes, git snippets, deck and architecture-image bytes | `python3 evidence/provenance-check.py` |

`SOURCE_REPO` overrides the book-notes clone for the source scripts. `CHROMIUM_PATH`
overrides the recorder browser; `FFMPEG` overrides its encoder. FFprobe must be on
PATH. The recorder owns port 4314; no other Slidev process should use that port.
The recording script fails on a missing code state, a morph with no active
animation, clipped tokens or overlapping callouts in any code state, a missing
final slide, or uncaught page errors. Scene times are computed from the narration alignment (`LEAD`, `TAIL`, `HOLD`, `CLICK_LEAD` and cue phrases in `narration/script.json`); it mixes the takes onto the video at each slide's actual start and fails if any take would run past its slide.

These helpers are reusable scaffolding; the story-specific ranges, slide schedule,
architecture asset and output names must be adapted for another project. See
[NOTES.md](../NOTES.md) for the complete reproduction procedure and limitations.
