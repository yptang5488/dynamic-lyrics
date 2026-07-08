# Dynamic Lyrics

Dynamic Lyrics is a local-first practice tool for organizing songs, importing LRC lyrics, and playing synchronized lyrics with translations, notes, and chant cues.

The project is currently a working prototype. Its main goal is to help maintainers build a personal practice library quickly and export a backend-free static practice site for sharing.

## Features

- Local private song library and synchronized lyrics player
- Audio upload, YouTube import, and Spotify metadata import flows
- LRC import and synced lyrics search
- Original lyrics, translations, lyric offset, partial timing shifts, line notes, and chant events
- Dedicated player path for YouTube-backed songs
- Backend-free static practice site export

## Tech Stack

- Backend: FastAPI, Pydantic, file-based JSON records
- Frontend: React, TypeScript, Vite, React Router, TanStack Query
- Jobs: in-process local worker
- Optional tools: `ffmpeg`, `ffprobe`, `yt-dlp`

## Project Structure

```text
app/          FastAPI backend, API routes, services, local job runner
frontend/     React/Vite frontend
scripts/      data export, chant/LRC maintenance, utility scripts
data/         local songs, sources, raw media, exported practice data
tests/        backend pytest coverage
docs/         feature notes and implementation plans
```

## Run Locally

Backend:

```bash
uv run python main.py
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The backend serves API routes under `/api` and local media under `/media`.

## Typical Workflow

1. Open `/import` to upload audio, paste a YouTube URL, or import from Spotify metadata.
2. Add or search for matching LRC lyrics.
3. Start the import job and review progress on the job page.
4. Open the generated song from `/` and practice in the synchronized player.
5. Adjust lyric offset, timing, notes, or chant events when needed.

## Static Practice Site

Build a shareable static site from the local song records:

```bash
cd frontend
npm run build:practice:fresh
```

This refreshes `data/export` from `data/songs`, copies available audio, and writes the site to `dist/practice-site`.

Preview it from the repository root:

```bash
python3 -m http.server 8080 --directory dist/practice-site
```

Then open `http://localhost:8080`.

## Tests

Run backend tests:

```bash
uv run --group dev pytest tests/backend
```

Run frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

## Notes

- Song data is stored as JSON records under `data/songs` and exported practice data under `data/export`.
- Local media is stored under `data/raw` and served through the backend during development.
- YouTube import requires `yt-dlp`; audio probing or normalization depends on `ffmpeg` / `ffprobe`.
- Jobs are local in-process tasks, so this is not yet a production-grade worker system.
