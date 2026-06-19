## Dynamic Lyrics Prototype

Dynamic Lyrics is a local full-stack prototype for studying songs with synchronized lyrics.

It already supports a private song library, importing audio, attaching lyrics and optional translations, running a backend timing flow, importing paired bilingual LRC timing, and opening a web player that highlights lines in sync with playback.

The current backend direction is `mp3 + lrc`, using paired bilingual LRC files as the main source of lyric timing.

## What It Does

- upload a local audio file or import a YouTube song source
- paste original lyrics and optional line-by-line translations
- create a background job for import and alignment
- monitor workflow progress in the browser
- list prepared songs in a private library
- open a synchronized player with active-line highlighting
- click any lyric line to seek playback to that point
- toggle translation visibility for study or focus mode
- remove duplicate or test songs from the library without deleting local media files

## Current Stack

- backend: FastAPI, Pydantic, JSON file storage
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

## Build Static Practice Site

Use this when you want to export a shareable, backend-free practice version for friends.

```bash
cd frontend
npm run build:practice
```

The export is written to `dist/practice-site`. It uses the existing React/Vite frontend styling, but runs in static practice mode:

- reads prepared song JSON from `data/export`
- copies available audio files into the static export
- skips songs whose audio files are missing
- disables maintainer-only import/delete routes
- stores each friend's calibration and chant edits in their browser `localStorage`

To export only specific songs, pass comma-separated song IDs:

```bash
cd frontend
npm run build:practice -- --songs=song_src_aaf2a49c_da3ed6,song_src_4671e574_dd8233
```

Preview the exported site locally from the repository root:

```bash
python3 -m http.server 8080 --directory dist/practice-site
```

Then open `http://localhost:8080`. Avoid opening `index.html` directly because browsers may block the static JSON files under `practice-data`.

## Optional Local Tools

- `ffmpeg` / `ffprobe` for audio normalization and duration detection
- `yt-dlp` for YouTube URL imports

If these tools are missing, some flows either fall back to a simpler path or are unavailable.

## Current User Flow

### Private Library Flow

1. Friends open `/` to browse prepared songs.
2. Friends choose a song card and open the existing `/player/:songId` synchronized lyrics player.
3. Maintainers open `/import` to add a prepared song from upload, YouTube, or Spotify-backed import flows.
4. After the import / LRC / alignment job completes, the generated song appears in the library if its source is ready.
5. Maintainers can use `Remove` on a library card to hide duplicate or test songs from the library.

Library entries are backed by file-based JSON records under `data/songs`, with related source state under `data/sources`. Local audio files live under `data/raw/...`; removing a song from the library deletes only the song JSON record and leaves the source record and local media file intact.

More detail: `docs/features/private-song-library/WORKFLOW.md`.

### Import-To-Player Flow

1. Choose a source by uploading audio, pasting a YouTube watch URL, or using Spotify metadata.
2. Provide or review an `.lrc` file that already carries lyric timing.
3. Create a sync job.
4. Watch import and LRC processing progress on the job page.
5. Open the generated player and study with synchronized lyric lines.

## API Coverage

- `GET /api/health`
- `POST /api/sources/upload-audio`
- `POST /api/sources/import-youtube`
- `POST /api/sources/import-spotify`
- `GET /api/sources/{sourceId}`
- `POST /api/alignments/from-lrc`
- `GET /api/jobs/{jobId}`
- `GET /api/songs`
- `GET /api/songs/{songId}`
- `DELETE /api/songs/{songId}`

## Development Status

Current state: working prototype

Implemented now:

- end-to-end import -> job -> player flow
- private library entry point at `/`
- maintainer import route at `/import`
- frontend pages for import, job monitoring, and playback
- frontend library listing, empty / loading / error states, and conservative song removal
- frontend upload flow wired to `audio + .lrc -> /api/alignments/from-lrc`
- job page warning display for `lrc_import` results
- line-based lyric display with translation toggle and auto-scroll
- backend export of player-ready song JSON
- backend song catalog listing and song deletion APIs
- backend LRC import job flow for paired bilingual `.lrc` files
- backend pytest coverage for parser, song export, API edge cases, and LRC import workflow

Still in progress:

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

- improve the frontend upload UX around `.lrc` validation and warnings
- improve job progress messages and overall feedback quality
- harden backend and frontend workflow validation
- add manual timing correction tools

### Mid Term

- support segment / word timing
- add manual timing correction tools
- add timed notes for vocabulary or phrase guidance
- evaluate piecewise LRC drift correction after global offset is stable

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
- library removal does not delete source rows or local media files
