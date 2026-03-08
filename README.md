## Dynamic Lyrics Prototype

Dynamic Lyrics is a local full-stack prototype for studying songs with synchronized lyrics.

It already supports importing audio, attaching lyrics and optional translations, running a backend timing flow, and opening a web player that highlights lines in sync with playback.

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
2. Paste original lyrics and optional matching translations.
3. Create a sync job.
4. Watch import and alignment progress on the job page.
5. Open the generated player and study with synchronized lyric lines.

## API Coverage

- `GET /api/health`
- `POST /api/sources/upload-audio`
- `POST /api/sources/import-youtube`
- `GET /api/sources/{sourceId}`
- `POST /api/alignments`
- `GET /api/jobs/{jobId}`
- `GET /api/songs/{songId}`

## Development Status

Current state: working prototype

Implemented now:

- end-to-end import -> job -> player flow
- frontend pages for import, job monitoring, and playback
- line-based lyric display with translation toggle and auto-scroll
- backend export of player-ready song JSON
- backend pytest coverage for parser, song export, API edge cases, and alignment workflow

Still in progress:

- replacing mock timing with real audio-to-lyrics alignment
- adding segment or word-level timing
- adding manual correction tools for low-confidence lines
- adding timed notes and guided singing features
- adding frontend automated tests and more durable job infrastructure

## Testing

Backend tests already cover:

- lyrics parsing, blank-line cleanup, and translation count validation
- upload -> alignment -> song JSON workflow
- song export payload shape and export file creation
- source, job, and song API success / 404 / 422 edge cases
- YouTube import failure handling and URL sanitization

Run backend tests with:

```bash
uv run --group dev pytest tests/backend
```

## Roadmap

### Near Term

- replace the mock aligner with a real alignment engine
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
