# Implementation Progress

## Current Status

The project has completed the first backend prototype pass for the dynamic lyrics app.

Implemented focus:

- source import flow
- local background jobs
- mock lyric alignment
- timed song JSON output for future frontend integration

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

### Background Jobs

- implemented local threaded job runner in `app/workers/job_runner.py`
- added support for `youtube_import` and `alignment` jobs
- added job status tracking with `queued`, `processing`, `done`, and `failed`
- added startup recovery that marks stale unfinished jobs as `failed`

### Song Export

- implemented frontend-ready song JSON builder in `app/services/song_builder.py`
- stored exported payload in SQLite and `data/export`
- exposed `GET /api/songs/{songId}` for player consumption

### Documentation and Validation

- updated `README.md` with local run instructions and tool requirements
- verified imports and compilation with `uv run python -m compileall app main.py`
- ran smoke tests for upload -> alignment -> song JSON flow

## Current API Coverage

- `GET /api/health`
- `POST /api/sources/upload-audio`
- `POST /api/sources/import-youtube`
- `GET /api/sources/{sourceId}`
- `POST /api/alignments`
- `GET /api/jobs/{jobId}`
- `GET /api/songs/{songId}`

## Current Limitations

- lyric timing is still mock timing, not real audio-to-lyrics alignment
- background jobs run in-process and are not yet durable worker jobs
- YouTube import depends on local `yt-dlp`
- audio normalization quality depends on local `ffmpeg`
- there is no frontend UI yet
- `segments` and `notes` are placeholders only

## Next Recommended Steps

1. replace the mock aligner with a real alignment engine
2. add clearer job progress messages for YouTube download and normalization
3. build the frontend import page, status page, and synchronized lyrics player
4. add manual correction support for low-confidence timing
5. extend the data model to support segment-level timing and timed learning notes
