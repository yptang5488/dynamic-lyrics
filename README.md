## Dynamic Lyrics Prototype

Dynamic Lyrics is a local full-stack prototype for studying songs with synchronized lyrics.

It already supports importing audio, attaching lyrics and optional translations, running a backend timing flow, importing paired bilingual LRC timing, and opening a web player that highlights lines in sync with playback.

The current backend direction is `mp3 + lrc`, using paired bilingual LRC files as the main source of lyric timing.

## What It Does

- upload a local audio file or import a YouTube song source
- paste original lyrics and optional line-by-line translations
- create a background job for import and alignment
- monitor workflow progress in the browser
- open a synchronized player with active-line highlighting
- click any lyric line to seek playback to that point
- toggle translation visibility for study or focus mode

## Current Stack

- backend: FastAPI, Pydantic, SQLite, local file storage
- frontend: React, TypeScript, Vite, React Router, TanStack Query
- jobs: in-process local worker threads
- media tooling: optional `ffmpeg`, `ffprobe`, and `yt-dlp`

## Run Locally

### Backend

```bash
uv run python main.py
```

The backend serves API routes under `/api` and local media files under `/media`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs through Vite and talks to the local backend during development.

## Optional Local Tools

- `ffmpeg` / `ffprobe` for audio normalization and duration detection
- `yt-dlp` for YouTube URL imports

If these tools are missing, some flows either fall back to a simpler path or are unavailable.

## Current User Flow

1. Choose a source by uploading audio or pasting a YouTube watch URL.
2. Preferred path: provide an `.lrc` file that already carries lyric timing.
3. Fallback path: paste original lyrics and optional matching translations.
4. Create a sync job.
5. Watch import and timing progress on the job page.
6. Open the generated player and study with synchronized lyric lines.

## API Coverage

- `GET /api/health`
- `POST /api/sources/upload-audio`
- `POST /api/sources/import-youtube`
- `GET /api/sources/{sourceId}`
- `POST /api/alignments`
- `POST /api/alignments/from-lrc`
- `GET /api/jobs/{jobId}`
- `GET /api/songs/{songId}`

## Development Status

Current state: working prototype

Implemented now:

- end-to-end import -> job -> player flow
- frontend pages for import, job monitoring, and playback
- line-based lyric display with translation toggle and auto-scroll
- backend export of player-ready song JSON
- backend LRC import job flow for paired bilingual `.lrc` files
- backend pytest coverage for parser, song export, API edge cases, and alignment workflow

Still in progress:

- wiring the frontend import flow to upload `.lrc` directly
- adding segment or word-level timing
- adding manual correction tools for low-confidence lines
- adding timed notes and guided singing features
- adding frontend automated tests and more durable job infrastructure

## LRC Input Rule

The backend now targets paired bilingual LRC files like `BANG BANG-MusicEnc.lrc:1`.

The working rule for that format is:

- `{sentence start}` original lyric
- `{sentence end}` translated lyric

That means the importer should interpret each block as:

- `start = original line timestamp`
- `end = translation line timestamp`
- `text = original line text`
- `translation = following translated line text`

Credits, metadata-like lines, and empty spacer lines should be ignored for player lyrics.

The current backend implementation also applies these practical rules:

- translation lines without a preceding original line are ignored with a warning
- if a translation line is missing, `end` falls back to the next original timestamp or source duration
- standard `[ti:]` and `[ar:]` metadata can be used to fill song title and artist

## Testing

Backend tests already cover:

- lyrics parsing, blank-line cleanup, and translation count validation
- upload -> alignment -> song JSON workflow
- upload -> `from-lrc` -> song JSON workflow
- paired bilingual LRC parsing, classification, and timing block building
- song export payload shape and export file creation
- source, job, and song API success / 404 / 422 edge cases
- YouTube import failure handling and URL sanitization

Run backend tests with:

```bash
uv run --group dev pytest tests/backend
```

## Roadmap

### Near Term

- wire the frontend import page to the new `from-lrc` backend flow
- improve job progress messages and error feedback
- harden backend and frontend workflow validation

### Mid Term

- support segment / word timing
- add manual timing correction tools
- add timed notes for vocabulary or phrase guidance

### Later

- add guided singing / cheering modes
- move from in-process jobs to a more durable worker model
- expand test coverage and deployment readiness

## YouTube Import Notes

- watch URLs are normalized to a plain `https://www.youtube.com/watch?v=...` form
- playlist and radio parameters are ignored during import

## Current Limitations

- lyric timing is still mock timing, not real alignment
- background jobs run in-process and are not durable across all failure cases
- YouTube import depends on local `yt-dlp`
- audio normalization quality depends on local `ffmpeg`
- `segments` and `notes` in lyric lines are placeholders only
- frontend automated tests are not implemented yet
