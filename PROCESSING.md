# Implementation Progress

## Current Status

The project has completed a first end-to-end prototype pass for the dynamic lyrics app.

The project now has an implemented `mp3 + lrc` path across backend and frontend, and the next step is to improve UX, warnings, and validation around that flow.

Implemented focus:

- source import flow
- local background jobs
- mock lyric alignment
- timed song JSON output for player consumption
- frontend import, job monitor, and player workflow

## Completed Work

### Backend Foundation

- created FastAPI app entry in `app/main.py`
- kept `main.py` as a simple local runner
- mounted `/media` for local audio access
- added project dependencies in `pyproject.toml`

### Storage and Database

- added SQLite initialization in `app/db/session.py`
- created `sources`, `jobs`, and `songs` tables in `app/db/tables.py`
- created local storage folders under `data/raw`, `data/normalized`, and `data/export`

### Source Import

- implemented audio upload flow in `app/api/routes_sources.py`
- implemented YouTube import job entrypoint
- added local `yt-dlp` import service in `app/services/youtube_import.py`
- added URL sanitization to strip playlist / radio parameters
- forced `yt-dlp` to use `--no-playlist`

### Audio Processing

- implemented audio normalization service in `app/services/audio_normalize.py`
- added `ffmpeg` usage when available
- added fallback copy behavior when `ffmpeg` is not installed
- added duration probing with `ffprobe` when available

### Lyrics Alignment

- implemented lyric text parsing in `app/services/lyrics_parser.py`
- validated translation line counts against non-empty lyric lines
- implemented mock line-level aligner in `app/services/aligner_mock.py`
- generated line timing, confidence, and placeholder `segments` / `notes`

### LRC Timing Import

- added paired bilingual LRC parsing in `app/services/lrc_parser.py`
- added line classification for original, translation, credit, and empty rows
- added block pairing with the agreed rule: original timestamp = `start`, following translation timestamp = `end`
- added fallback handling when a translation line is missing
- added metadata extraction for standard LRC title / artist fields
- added `POST /api/alignments/from-lrc` as the new LRC import entrypoint
- added `lrc_import` job support in `app/workers/job_runner.py`

### Background Jobs

- implemented local threaded job runner in `app/workers/job_runner.py`
- added support for `youtube_import` and `alignment` jobs
- added job status tracking with `queued`, `processing`, `done`, and `failed`
- added startup recovery that marks stale unfinished jobs as `failed`

### Song Export

- implemented frontend-ready song JSON builder in `app/services/song_builder.py`
- stored exported payload in SQLite and `data/export`
- exposed `GET /api/songs/{songId}` for player consumption

### Frontend Prototype

- added a React + Vite frontend under `frontend`
- added route wiring for import, job, and player pages
- built the import page for upload / YouTube source selection and lyric input
- connected the upload flow to `POST /api/alignments/from-lrc` when an `.lrc` file is provided
- built the job monitor page with polling and automatic workflow handoff
- added `lrc_import` job messaging and player redirection support
- added LRC warning display on the job page when the backend returns import warnings
- built the player page with audio playback, active-line highlighting, click-to-seek, translation toggle, and auto-scroll
- added frontend workflow persistence with session storage

### Documentation and Validation

- updated `README.md` with local run instructions and tool requirements
- verified imports and compilation with `uv run python -m compileall app main.py`
- ran smoke tests for upload -> alignment -> song JSON flow

### Backend Test Coverage

- added `pytest` as a dev dependency group in `pyproject.toml`
- added isolated backend test fixtures in `tests/backend/conftest.py`
- added parser tests for blank-line cleanup, empty input, and translation count validation
- added workflow tests for upload -> alignment -> song fetch and song 404 handling
- added workflow tests for upload -> LRC import -> song fetch
- added song builder tests for payload shape and export file persistence
- added API edge tests for source/job lookups, invalid YouTube payloads, failed sources, and alignment failure scenarios
- added LRC parser tests using paired bilingual rules and the `BANG BANG-MusicEnc.lrc` sample
- verified the backend suite with `uv run --group dev pytest tests/backend`

## Current API Coverage

- `GET /api/health`
- `POST /api/sources/upload-audio`
- `POST /api/sources/import-youtube`
- `GET /api/sources/{sourceId}`
- `POST /api/alignments`
- `POST /api/alignments/from-lrc`
- `GET /api/jobs/{jobId}`
- `GET /api/songs/{songId}`

## Current Limitations

- lyric timing is still mock timing, not real audio-to-lyrics alignment
- background jobs run in-process and are not yet durable worker jobs
- YouTube import depends on local `yt-dlp`
- audio normalization quality depends on local `ffmpeg`
- `segments` and `notes` are placeholders only
- frontend automated tests are not implemented yet

## Next Recommended Steps

1. improve the `.lrc` upload UX with validation, file-state feedback, and warning display
2. extend the data model to support segment-level timing and timed learning notes
3. add frontend automated tests for the import, job, and player flow
4. decide whether to keep pasted lyrics as a visible fallback or move it into an advanced path
5. improve backend warning granularity for LRC parsing edge cases

## Agreed LRC Interpretation Rule

The current planning baseline comes from files like `BANG BANG-MusicEnc.lrc:1`.

For this importer, each lyric block should be interpreted as:

- `{sentence start}` original lyric
- `{sentence end}` translated lyric

Implementation consequences:

- use the original line timestamp as the lyric `start`
- use the following translation line timestamp as the lyric `end`
- store the original line as `text`
- store the following translated line as `translation`
- ignore credit rows and empty spacer rows when building player lyrics
- if a translation line is missing, fall back to the next available original timestamp or source duration for `end`

This rule is intentionally specific to the paired bilingual LRC format that the project supports first; it is not a claim about all generic LRC files.
